import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';

/** 문의 챗봇: 화면 → 백엔드 → Dify(스트리밍). JwtService·AppUser 저장소는 전역 모듈에서 받는다 */
@Module({ controllers: [ChatController], providers: [ChatService] })
export class ChatModule {}
