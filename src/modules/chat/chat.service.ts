import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import type { AuthUser } from '../../common/auth.types.js';
import type { AppEnv } from '../../config/env.js';
import { AppUser } from '../users/app-user.entity.js';
import { ChatLog } from './chat-log.entity.js';
import {
  CHAT_MESSAGES,
  type ChatRecord,
  type ClientEvent,
  errorMessageFor,
  mapDifyPayload,
  parseSseChunk,
} from './chat-sse.js';

/** 이번 질문을 한 사람: Dify에 넘길 이름 + 기록(chat_log)에 남길 계정 또는 손님 번호 */
export interface ChatAsker {
  difyUser: string;
  userId: number | null;
  role: string | null;
  guestId: string | null;
}

export type ChatLogFilter = 'all' | 'member' | 'guest';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly jwt: JwtService,
    @InjectRepository(AppUser) private readonly users: Repository<AppUser>,
    @InjectRepository(ChatLog) private readonly logs: Repository<ChatLog>,
  ) {}

  /** 키가 없으면 챗봇을 열지 않는다 */
  assertReady() {
    if (!this.config.get('DIFY_API_KEY', { infer: true })) {
      throw new ServiceUnavailableException(CHAT_MESSAGES.notReady);
    }
  }

  /**
   * Dify에 넘길 사용자 이름. 로그인은 선택이다.
   * 토큰은 AuthGuard와 같은 방식(서명 확인 → 계정 다시 보기)으로 확인하고, 맞지 않으면 손님으로 본다.
   */
  async asker(
    authorization: string | undefined,
    guestHeader: string | undefined,
  ): Promise<ChatAsker> {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<AuthUser>(token);
        const user = await this.users.findOneBy({ id: payload.id });
        if (user?.isActive)
          return {
            difyUser: `user-${user.id}`,
            userId: user.id,
            role: user.role,
            guestId: null,
          };
      } catch {
        // 만료·위조 토큰은 손님으로 처리한다
      }
    }
    const guest =
      guestHeader && UUID_PATTERN.test(guestHeader)
        ? guestHeader.toLowerCase()
        : randomUUID();
    return {
      difyUser: `guest-${guest}`,
      userId: null,
      role: null,
      guestId: guest,
    };
  }

  /** 대화 기록 한 줄 (결정42). 저장이 실패해도 답에는 영향이 없게 경고만 남긴다 */
  async saveLog(
    asker: ChatAsker,
    query: string,
    record: ChatRecord,
    durationMs: number,
  ): Promise<void> {
    try {
      await this.logs.insert({
        userId: asker.userId,
        guestId: asker.guestId,
        role: asker.role,
        conversationId: record.conversationId || null,
        query,
        answer: record.answer,
        sources: record.sources,
        status: record.status,
        error: record.error,
        durationMs,
      });
    } catch (error) {
      this.logger.warn(`대화 기록 저장 실패: ${String(error)}`);
    }
  }

  /** 어드민 문의 기록: 최근 200건, 로그인한 사람은 이름·역할을 붙인다 */
  listLogs(who: ChatLogFilter) {
    const where =
      who === 'member'
        ? 'WHERE l.user_id IS NOT NULL'
        : who === 'guest'
          ? 'WHERE l.user_id IS NULL'
          : '';
    return this.logs.query(
      `SELECT l.id, to_char(l.created_at AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') AS at,
         l.user_id IS NOT NULL AS member, u.name, l.role, l.query, l.answer, l.sources, l.status, l.error,
         l.duration_ms AS "durationMs", l.conversation_id AS "conversationId"
       FROM hw2.chat_log l LEFT JOIN hw2.app_user u ON u.id = l.user_id
       ${where}
       ORDER BY l.id DESC LIMIT 200`,
    );
  }

  /**
   * Dify chat-messages를 스트리밍으로 부르고, 줄인 이벤트를 하나씩 넘긴다.
   * signal이 끊기면(화면이 연결을 끊으면) Dify 요청도 멈춘다.
   */
  async stream(
    input: { query: string; conversationId?: string; user: string },
    signal: AbortSignal,
    emit: (event: ClientEvent) => void,
  ): Promise<void> {
    const baseUrl = this.config
      .get('DIFY_API_URL', { infer: true })
      .replace(/\/+$/, '');
    const key = this.config.get('DIFY_API_KEY', { infer: true });

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat-messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: {},
          query: input.query,
          response_mode: 'streaming',
          conversation_id: input.conversationId ?? '',
          user: input.user,
        }),
        signal,
      });
    } catch (error) {
      if (signal.aborted) return;
      this.logger.warn(`Dify 연결 실패: ${String(error)}`);
      emit({ event: 'error', data: { message: CHAT_MESSAGES.failed } });
      return;
    }

    if (!response.ok || !response.body) {
      const body = (await response.json().catch(() => ({}))) as {
        code?: string;
      };
      this.logger.warn(`Dify 응답 오류: ${response.status} ${body.code ?? ''}`);
      emit({
        event: 'error',
        data: { message: errorMessageFor(response.status, body.code) },
      });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let conversationId = input.conversationId ?? '';
    let ended = false;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const { payloads, rest } = parseSseChunk(buffer);
        buffer = rest;
        for (const payload of payloads) {
          const mapped = mapDifyPayload(payload);
          if (mapped.conversationId) conversationId = mapped.conversationId;
          if (!mapped.event) continue;
          if (mapped.event.event === 'end') {
            mapped.event.data.conversationId ||= conversationId;
            ended = true;
          }
          emit(mapped.event);
          if (mapped.event.event !== 'delta') return;
        }
      }
      if (!ended) {
        emit({ event: 'error', data: { message: CHAT_MESSAGES.failed } });
      }
    } catch (error) {
      if (signal.aborted) return;
      this.logger.warn(`Dify 스트림 끊김: ${String(error)}`);
      emit({ event: 'error', data: { message: CHAT_MESSAGES.failed } });
    } finally {
      reader.cancel().catch(() => undefined);
    }
  }
}
