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
import {
  CHAT_MESSAGES,
  type ClientEvent,
  errorMessageFor,
  mapDifyPayload,
  parseSseChunk,
} from './chat-sse.js';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly config: ConfigService<AppEnv, true>,
    private readonly jwt: JwtService,
    @InjectRepository(AppUser) private readonly users: Repository<AppUser>,
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
  async difyUser(
    authorization: string | undefined,
    guestHeader: string | undefined,
  ): Promise<string> {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<AuthUser>(token);
        const user = await this.users.findOneBy({ id: payload.id });
        if (user?.isActive) return `user-${user.id}`;
      } catch {
        // 만료·위조 토큰은 손님으로 처리한다
      }
    }
    const guest =
      guestHeader && UUID_PATTERN.test(guestHeader)
        ? guestHeader.toLowerCase()
        : randomUUID();
    return `guest-${guest}`;
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
