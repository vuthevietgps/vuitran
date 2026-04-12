import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { RequestMetricsInterceptor } from '../src/common/interceptors/request-metrics.interceptor';

const STATIC_ASSET_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PROTECTED_UPLOAD_PREFIXES = [
  '/uploads/attendance',
  '/uploads/recordings',
  '/uploads/session-recordings',
  '/uploads/teaching-recordings',
];

function ensureEnvDefaults(): void {
  process.env.NODE_ENV ||= 'development';
  process.env.PORT ||= '3000';
  process.env.CORS_ORIGIN ||= 'http://localhost:4200';
  process.env.FRONTEND_URL ||= 'http://localhost:4200';
  process.env.JWT_SECRET ||= 'demo-memory-server-jwt-secret';
  process.env.DEMO_PASSWORD ||= 'Demo123456!';
  process.env.DEMO_SYNC_EXISTING ||= 'true';
  process.env.REDIS_ENABLED ||= 'false';
  process.env.THROTTLE_LIMIT ||= '100000';
  process.env.THROTTLE_TTL_MS ||= '60000';
}

async function bootstrap(): Promise<void> {
  ensureEnvDefaults();

  const mongoReplSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  process.env.MONGODB_URI = mongoReplSet.getUri('school-mgmt-sale-demo');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  const config = app.get(ConfigService);
  app.disable('x-powered-by');
  app.set('etag', 'strong');
  app.use(helmet());
  app.use(cookieParser());

  const rawBodySaver = (req: any, _res: any, buf: Buffer) => {
    if (buf?.length) {
      req.rawBody = Buffer.from(buf);
    }
  };

  app.use(require('express').json({ limit: '10mb', verify: rawBodySaver }));
  app.use(require('express').urlencoded({ limit: '10mb', extended: true, verify: rawBodySaver }));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new RequestMetricsInterceptor(config));

  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:4200');
  app.enableCors({
    origin: corsOrigin.split(',').map((origin) => origin.trim()),
    credentials: true,
  });

  const uploadsPath = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsPath)) {
    mkdirSync(uploadsPath, { recursive: true });
  }

  app.use((req, res, next) => {
    const requestPath = String(req.path || req.url || '');
    if (
      PROTECTED_UPLOAD_PREFIXES.some(
        (prefix) => requestPath === prefix || requestPath.startsWith(`${prefix}/`),
      )
    ) {
      res.status(403).json({
        statusCode: 403,
        message: 'Direct access to protected uploads is forbidden',
      });
      return;
    }

    next();
  });

  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
    maxAge: STATIC_ASSET_MAX_AGE_MS,
    immutable: true,
    etag: true,
    setHeaders: (res, filePath) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

      if (/\.(html?)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        return;
      }

      res.setHeader(
        'Cache-Control',
        `public, max-age=${Math.floor(STATIC_ASSET_MAX_AGE_MS / 1000)}, immutable`,
      );
    },
  });

  const port = Number(config.get<number>('PORT', 3000)) || 3000;
  const server = await app.listen(port, '127.0.0.1');
  const address = server.address();
  const addressLabel =
    typeof address === 'string' ? address : `http://127.0.0.1:${address?.port || port}`;

  console.log(`[demo-memory-server] Mongo URI: ${process.env.MONGODB_URI}`);
  console.log(`[demo-memory-server] Ready at ${addressLabel}`);
  console.log('[demo-memory-server] Demo password:', process.env.DEMO_PASSWORD);

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[demo-memory-server] Shutting down due to ${signal}...`);
    await app.close().catch(() => undefined);
    await mongoReplSet.stop().catch(() => undefined);
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

bootstrap().catch((error) => {
  console.error('[demo-memory-server] Failed to start', error);
  process.exit(1);
});
