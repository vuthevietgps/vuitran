import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  private normalizeHttpExceptionMessage(response: string | object): string | string[] | object {
    if (typeof response === 'string') {
      return response;
    }

    const message = (response as any)?.message;
    if (typeof message === 'string' || Array.isArray(message)) {
      return message;
    }

    const error = (response as any)?.error;
    if (typeof error === 'string') {
      return error;
    }

    return response;
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = this.normalizeHttpExceptionMessage(exception.getResponse());
    } else if (
      (exception as any)?.name === 'MongoServerError' &&
      (exception as any)?.code === 11000
    ) {
      status = HttpStatus.CONFLICT;
      const keyValue = (exception as any)?.keyValue;
      const field = keyValue ? Object.keys(keyValue).join(', ') : 'unknown';
      message = `Giá trị trùng lặp cho trường: ${field}`;
    } else if ((exception as any)?.name === 'CastError') {
      status = HttpStatus.BAD_REQUEST;
      message = 'ID không hợp lệ';
    } else if ((exception as any)?.name === 'ValidationError') {
      status = HttpStatus.BAD_REQUEST;
      message = (exception as any).message;
    }

    this.logger.error(
      `${request.method} ${request.url} → ${status}`,
      (exception as any)?.stack,
    );

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
