import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestMetricsInterceptor } from './common/interceptors/request-metrics.interceptor';

const STATIC_ASSET_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const PROTECTED_UPLOAD_PREFIXES = [
  '/uploads/attendance',
  '/uploads/recordings',
  '/uploads/session-recordings',
  '/uploads/teaching-recordings',
];

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, // Disable default parser to use custom limit below
  });

  const config = app.get(ConfigService);

  app.disable('x-powered-by');
  app.set('etag', 'strong');

  // Security headers
  app.use(helmet());

  // Cookie parser for httpOnly JWT tokens
  app.use(cookieParser());

  const rawBodySaver = (req: any, _res: any, buf: Buffer) => {
    if (buf?.length) {
      req.rawBody = Buffer.from(buf);
    }
  };

  // Custom body parser with 10mb limit for base64 uploads
  app.use(require('express').json({ limit: '10mb', verify: rawBodySaver }));
  app.use(require('express').urlencoded({ limit: '10mb', extended: true, verify: rawBodySaver }));

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new RequestMetricsInterceptor(config));

  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:4200');
  app.enableCors({
    origin: corsOrigin.split(',').map(o => o.trim()),
    credentials: true, // Allow cookies to be sent with requests
  });

  const uploadsPath = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsPath)) mkdirSync(uploadsPath, { recursive: true });

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

  // Serve static files from uploads directory
  app.useStaticAssets(uploadsPath, {
    prefix: '/uploads/',
    maxAge: STATIC_ASSET_MAX_AGE_MS,
    immutable: true,
    etag: true,
    setHeaders: (res, filePath) => {
      // Frontend dev server runs on a different origin and needs to render
      // uploaded public assets such as wallet receipts and invoice proofs.
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

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}
bootstrap();
