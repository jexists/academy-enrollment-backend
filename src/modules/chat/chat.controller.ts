import { Body, Controller, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { formatSse } from './chat-sse.js';
import { ChatMessageDto } from './chat.dto.js';
import { ChatService } from './chat.service.js';

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
    const user = await this.chat.difyUser(
      req.headers.authorization,
      typeof guestHeader === 'string' ? guestHeader : undefined,
    );

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
      { query: dto.query, conversationId: dto.conversationId, user },
      controller.signal,
      (event) => {
        if (!controller.signal.aborted) res.write(formatSse(event));
      },
    );
    if (!res.writableEnded) res.end();
  }
}
