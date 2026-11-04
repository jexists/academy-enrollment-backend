import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Auth } from '../../common/decorators/auth.decorator.js';
import { createChatRecorder, formatSse } from './chat-sse.js';
import { ChatMessageDto } from './chat.dto.js';
import { ChatService, type ChatLogFilter } from './chat.service.js';

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  /**
   * 문의 챗봇. 로그인은 선택이고, 답은 SSE(text/event-stream)로 조금씩 보낸다.
   * 이벤트: delta {text} · end {conversationId, sources} · error {message}
   * 한 사람(IP)당 1분에 10번까지.
   */
  @Post('messages')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async messages(
    @Body() dto: ChatMessageDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    // 키가 없으면 SSE를 열기 전에 503으로 돌려준다
    this.chat.assertReady();
    const guestHeader = req.headers['x-chat-guest'];
    const asker = await this.chat.asker(
      req.headers.authorization,
      typeof guestHeader === 'string' ? guestHeader : undefined,
    );
    const startedAt = Date.now();
    const recorder = createChatRecorder(dto.conversationId);

    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    await this.chat.stream(
      {
        query: dto.query,
        conversationId: dto.conversationId,
        user: asker.difyUser,
      },
      controller.signal,
      (event) => {
        recorder.add(event);
        if (!controller.signal.aborted) res.write(formatSse(event));
      },
    );
    if (!res.writableEnded) res.end();
    // 답을 다 보낸 뒤 기록한다 (정상·멈춤·오류 모두, 결정42)
    await this.chat.saveLog(
      asker,
      dto.query,
      recorder.finish(controller.signal.aborted),
      Date.now() - startedAt,
    );
  }
}

/** 문의 기록 — 원장만 (결정42) */
@Controller('admin/chat-logs')
@Auth('ADMIN')
export class ChatLogController {
  constructor(private readonly chat: ChatService) {}

  @Get()
  list(@Query('who') who?: string) {
    const filter: ChatLogFilter =
      who === 'member' || who === 'guest' ? who : 'all';
    return this.chat.listLogs(filter);
  }
}
