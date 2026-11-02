import { ConflictException, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { EntityManager } from 'typeorm';
import { AppUser, type Role } from './app-user.entity.js';
import { tempPassword } from './temp-password.js';

export interface IssuedAccount {
  user: AppUser;
  /** 새로 만든 계정의 임시 비밀번호. 화면에 한 번만 보여 준다 */
  password: string;
}

/** 계정 만들기·임시 비밀번호 발급 (학생 등록·직원 계정에서 같이 쓴다) */
@Injectable()
export class AccountsService {
  async findByEmail(m: EntityManager, email: string): Promise<AppUser | null> {
    return m
      .getRepository(AppUser)
      .createQueryBuilder('user')
      .where('lower(user.email) = :email', {
        email: email.trim().toLowerCase(),
      })
      .getOne();
  }

  /** 임시 비밀번호로 계정을 만든다. 첫 로그인 때 비밀번호를 바꿔야 한다 */
  async create(
    m: EntityManager,
    email: string,
    name: string,
    role: Role,
    prefix = 'Tmp',
  ): Promise<IssuedAccount> {
    if (await this.findByEmail(m, email))
      throw new ConflictException(`이미 쓰는 이메일이에요. (${email})`);
    const password = tempPassword(prefix);
    const user = await m.save(
      m.create(AppUser, {
        email: email.trim().toLowerCase(),
        name,
        role,
        passwordHash: await bcrypt.hash(password, 10),
        mustChangePassword: true,
      }),
    );
    return { user, password };
  }

  /** 비밀번호 리셋 → 새 임시 비밀번호, 다음 로그인 때 변경 강제 (공통8) */
  async resetPassword(m: EntityManager, user: AppUser): Promise<string> {
    const password = tempPassword();
    user.passwordHash = await bcrypt.hash(password, 10);
    user.mustChangePassword = true;
    await m.save(user);
    return password;
  }
}
