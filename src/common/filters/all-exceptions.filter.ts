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
  {
    app_user_email_key: {
      status: HttpStatus.CONFLICT,
      message: '이미 쓰는 이메일이에요.',
    },
    school_name_region_key: {
      status: HttpStatus.CONFLICT,
      message: '같은 지역에 같은 이름의 학교가 이미 있어요.',
    },
    class_name_key: {
      status: HttpStatus.CONFLICT,
      message: '같은 이름의 반이 이미 있어요.',
    },
    class_capacity_check: {
      status: HttpStatus.BAD_REQUEST,
      message: '정원은 1명 이상이어야 해요.',
    },
    class_schedule_class_weekday_key: {
      status: HttpStatus.CONFLICT,
      message: '같은 요일이 두 번 들어갔어요.',
    },
    class_schedule_time_check: {
      status: HttpStatus.BAD_REQUEST,
      message: '끝나는 시간이 시작 시간보다 늦어야 해요.',
    },
    class_session_class_date_time_key: {
      status: HttpStatus.CONFLICT,
      message: '그 날짜·시간에 이 반 수업이 이미 있어요.',
    },
    enrollment_active_key: {
      status: HttpStatus.CONFLICT,
      message: '이미 신청했거나 다니고 있는 반이에요.',
    },
    attendance_session_student_key: {
      status: HttpStatus.CONFLICT,
      message: '이 수업의 출결이 이미 있어요.',
    },
    makeup_absence_key: {
      status: HttpStatus.CONFLICT,
      message: '이 결석으로 이미 보강을 신청했어요.',
    },
    tuition_payment_month_key: {
      status: HttpStatus.CONFLICT,
      message: '이 달 납부가 이미 기록돼 있어요.',
    },
    exam_score_score_check: {
      status: HttpStatus.BAD_REQUEST,
      message: '점수는 0~100 사이로 입력해요.',
    },
  };

/** Nest가 영어로 내는 문구(ParseIntPipe·Throttler)를 한국어로 바꾼다. */
function koreanFrameworkMessage(status: number, text: string): string {
  if (status === Number(HttpStatus.TOO_MANY_REQUESTS))
    return '요청이 너무 많아요. 1분 뒤에 다시 시도해 주세요.';
  if (/numeric string is expected/.test(text))
    return '번호 형식이 맞지 않아요.';
  return text;
}

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
        return {
          statusCode: status,
          message: koreanFrameworkMessage(status, response),
        };
      const { message, fieldErrors } = response as {
        message?: string | string[];
        fieldErrors?: Record<string, string>;
      };
      const text = Array.isArray(message)
        ? message[0]
        : (message ?? exception.message);
      return {
        statusCode: status,
        message: koreanFrameworkMessage(status, text),
        ...(fieldErrors ? { fieldErrors } : {}),
      };
    }

    if (exception instanceof QueryFailedError) {
      const constraint = (exception.driverError as { constraint?: string })
        .constraint;
      const known = constraint ? CONSTRAINT_MESSAGES[constraint] : undefined;
      if (known) return { statusCode: known.status, message: known.message };
      // 형식은 맞지만 없는 날짜(2026-02-31 등)·시간
      const code = (exception.driverError as { code?: string }).code;
      if (code === '22007' || code === '22008')
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: '날짜나 시간을 다시 확인해 주세요.',
        };
    }

    this.logger.error(exception);
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: '잠시 문제가 생겼어요. 조금 뒤에 다시 시도해 주세요.',
    };
  }
}
