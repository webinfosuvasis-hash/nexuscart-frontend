import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: unknown = undefined;

    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        message = (res.message as string) || message;
        errors = res.errors;
        // Pass through any extra domain fields the service placed on the exception body.
        // 'message', 'errors', and 'statusCode' are handled explicitly above.
        // 'error' is intentionally included so domain codes like CHECKOUT_ALREADY_ACTIVE pass through.
        const reserved = new Set(['message', 'errors', 'statusCode']);
        for (const [k, v] of Object.entries(res)) {
          if (!reserved.has(k)) extra[k] = v;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
      // Never expose internal error details (DB host, column names, file paths) in production
      message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : exception.message;
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      ...(errors && { errors }),
      ...extra,
    });
  }
}
