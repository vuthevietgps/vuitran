import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { performance } from 'perf_hooks';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';

@Injectable()
export class RequestMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestMetricsInterceptor.name);
  private readonly slowRequestThresholdMs: number;

  constructor(private readonly config: ConfigService) {
    const rawThreshold = Number(this.config.get<string>('SLOW_REQUEST_THRESHOLD_MS', '800'));
    this.slowRequestThresholdMs =
      Number.isFinite(rawThreshold) && rawThreshold > 0 ? rawThreshold : 800;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: { sub?: string; _id?: string } }>();
    const response = http.getResponse<Response>();
    const startedAt = performance.now();

    return next.handle().pipe(
      finalize(() => {
        const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
        response?.setHeader('X-Response-Time', `${durationMs}ms`);

        if (durationMs < this.slowRequestThresholdMs) {
          return;
        }

        const userRef = request.user?.sub ?? request.user?._id ?? 'anonymous';
        this.logger.warn(
          `${request.method} ${request.originalUrl || request.url} -> ${response.statusCode} in ${durationMs}ms (user=${userRef})`,
        );
      }),
    );
  }
}
