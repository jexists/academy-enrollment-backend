import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

export interface ErrorBody {
  statusCode: number;
  message: string;
  fieldErrors?: Record<string, string>;
}

// DB 제약 이름 → 사용자가 이해할 수 있는 문구 (테이블을 만들 때 init.sql의 제약 이름과 함께 추가)
const CONSTRAINT_MESSAGES: Record<string, { status: number; message: string }> =
  {};

/** 모든 오류를 { statusCode, message, fieldErrors? } 한 가지 형식으로 응답한다. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const body = this.toBody(exception);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(body.statusCode)
      .json(body);
  }

  private toBody(exception: unknown): ErrorBody {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      if (typeof response === 'string')
        return { statusCode: status, message: response };
      const { message, fieldErrors } = response as {
        message?: string | string[];
        fieldErrors?: Record<string, string>;
      };
      return {
        statusCode: status,
        message: Array.isArray(message)
          ? message[0]
          : (message ?? exception.message),
        ...(fieldErrors ? { fieldErrors } : {}),
      };
    }

    if (exception instanceof QueryFailedError) {
      const constraint = (exception.driverError as { constraint?: string })
        .constraint;
      const known = constraint ? CONSTRAINT_MESSAGES[constraint] : undefined;
      if (known) return { statusCode: known.status, message: known.message };
    }

    this.logger.error(exception);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: '잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.',
    };
  }
}
