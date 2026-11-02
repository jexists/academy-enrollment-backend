import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcryptjs';
import { In, Repository } from 'typeorm';
import type { AuthUser } from '../../common/auth.types.js';
import type { AppEnv } from '../../config/env.js';
import { AppUser } from '../users/app-user.entity.js';
import { LoginHistory } from '../users/login-history.entity.js';
import {
  APP_ROLES,
  newPasswordProblem,
  wrongAppMessage,
} from './auth-rules.js';
import type { AppKind, ChangePasswordDto, LoginDto } from './auth.dto.js';

const LOGIN_FAILED = '이메일 또는 비밀번호가 맞지 않아요.';
const INACTIVE = '사용이 중지된 계정이에요. 원장님께 문의하세요.';

export interface SessionUser extends AuthUser {
  email: string;
  mustChangePassword: boolean;
}

export interface LoginResult {
  token: string;
  user: SessionUser;
}

export interface ClientInfo {
  ip: string | null;
  userAgent: string | null;
}

@Injectable()
export class AuthService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppEnv, true>,
    @InjectRepository(AppUser) private readonly users: Repository<AppUser>,
    @InjectRepository(LoginHistory)
    private readonly history: Repository<LoginHistory>,
  ) {}

  /** 서버를 처음 켤 때 .env의 원장 계정이 없으면 만든다 (공통5: 최초 관리자) */
  async onApplicationBootstrap() {
    const email = this.config.get('ADMIN_EMAIL', { infer: true }).toLowerCase();
    if (await this.users.existsBy({ email })) return;
    const passwordHash = await bcrypt.hash(
      this.config.get('ADMIN_PASSWORD', { infer: true }),
      10,
    );
    await this.users.save(
      this.users.create({ email, passwordHash, name: '한원장', role: 'ADMIN' }),
    );
    this.logger.log(`원장 계정(${email})을 만들었어요`);
  }

  async login(dto: LoginDto, client: ClientInfo): Promise<LoginResult> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('lower(user.email) = :email', { email })
      .getOne();
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await this.record(email, user ?? null, false, client);
      throw new UnauthorizedException(LOGIN_FAILED);
    }
    return this.issueAndRecord(user, dto.app, client);
  }

  /** 로컬 전용: 비밀번호 없이 데모 계정으로 로그인 (DEMO_LOGIN=true일 때만) */
  async demoLogin(
    email: string,
    app: AppKind,
    client: ClientInfo,
  ): Promise<LoginResult> {
    this.assertDemo();
    const user = await this.users.findOneBy({ email: email.toLowerCase() });
    if (!user) throw new NotFoundException('없는 데모 계정이에요.');
    return this.issueAndRecord(user, app, client);
  }

  /** 로그인 화면에 보여 줄 데모 계정 목록 */
  async demoAccounts(app: AppKind) {
    this.assertDemo();
    const users = await this.users.find({
      where: { role: In(APP_ROLES[app]) },
      order: { role: 'ASC', id: 'ASC' },
    });
    return users.map((user) => ({
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
    }));
  }

  async me(userId: number): Promise<SessionUser> {
    const user = await this.users.findOneByOrFail({ id: userId });
    return this.toSession(user);
  }

  /** 비밀번호 변경. 임시 비밀번호였다면 변경 강제가 풀린다 (공통8) */
  async changePassword(
    userId: number,
    dto: ChangePasswordDto,
  ): Promise<SessionUser> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .getOneOrFail();
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new BadRequestException({
        message: '입력한 내용을 다시 확인해 주세요.',
        fieldErrors: { currentPassword: '지금 비밀번호가 맞지 않아요.' },
      });
    }
    const problem = newPasswordProblem(dto.currentPassword, dto.newPassword);
    if (problem) {
      throw new BadRequestException({
        message: '입력한 내용을 다시 확인해 주세요.',
        fieldErrors: { newPassword: problem },
      });
    }
    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.mustChangePassword = false;
    await this.users.save(user);
    return this.toSession(user);
  }

  /** 사용 중지·다른 화면 계정이면 실패로 기록하고 막는다 */
  private async issueAndRecord(
    user: AppUser,
    app: AppKind,
    client: ClientInfo,
  ): Promise<LoginResult> {
    try {
      const result = await this.issue(user, app);
      await this.record(user.email, user, true, client);
      return result;
    } catch (error) {
      await this.record(user.email, user, false, client);
      throw error;
    }
  }

  private async issue(user: AppUser, app: AppKind): Promise<LoginResult> {
    if (!user.isActive) throw new UnauthorizedException(INACTIVE);
    const wrongApp = wrongAppMessage(user.role, app);
    if (wrongApp) throw new ForbiddenException(wrongApp);
    const session = this.toSession(user);
    const payload: AuthUser = { id: user.id, role: user.role, name: user.name };
    return { token: await this.jwt.signAsync(payload), user: session };
  }

  private toSession(user: AppUser): SessionUser {
    return {
      id: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      mustChangePassword: user.mustChangePassword,
    };
  }

  private async record(
    email: string,
    user: AppUser | null,
    success: boolean,
    client: ClientInfo,
  ) {
    await this.history.insert({
      email,
      userId: user?.id ?? null,
      success,
      ip: client.ip,
      userAgent: client.userAgent?.slice(0, 300) ?? null,
    });
  }

  private assertDemo() {
    if (!this.config.get('DEMO_LOGIN', { infer: true }))
      throw new NotFoundException('데모 로그인을 쓸 수 없어요.');
  }
}
