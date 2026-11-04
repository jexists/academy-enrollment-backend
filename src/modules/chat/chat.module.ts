import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatLog } from './chat-log.entity.js';
import { ChatController, ChatLogController } from './chat.controller.js';
import { ChatService } from './chat.service.js';

/** 문의 챗봇: 화면 → 백엔드 → Dify(스트리밍) + 대화 기록(chat_log). JwtService·AppUser 저장소는 전역 모듈에서 받는다 */
@Module({
  imports: [TypeOrmModule.forFeature([ChatLog])],
  controllers: [ChatController, ChatLogController],
  providers: [ChatService],
})
export class ChatModule {}
