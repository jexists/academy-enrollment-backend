import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context.js';

/** 모든 요청을 컨텍스트로 감싼다. 로그인 사용자는 AuthGuard가 확인한 뒤 채운다. */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(forwarded) ? forwarded[0] : forwarded)
        ?.split(',')[0]
        .trim() ??
      req.ip ??
      null;
    requestContext.run({ userId: null, ip }, () => next());
  }
}
