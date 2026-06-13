import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

function resolveCorsOrigins(): string[] | boolean {
  const raw = process.env.CORS_ORIGINS;
  if (raw && raw.trim().length > 0) {
    return raw
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
  }

  if (process.env.NODE_ENV === 'production') {
    // No origins configured in production: fail closed (deny cross-origin).
    Logger.warn(
      'CORS_ORIGINS is not set in production. No cross-origin requests will be allowed.',
      'Bootstrap',
    );
    return [];
  }

  // Development convenience defaults.
  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security headers.
  app.use(helmet());

  // Payload size limits (default 1mb; executor caps code at 512KB so this is safe).
  const bodyLimit = process.env.BODY_LIMIT || '1mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  // CORS allowlist.
  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });

  // Preserve existing validation behavior.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Clean, leak-free error responses.
  app.useGlobalFilters(new AllExceptionsFilter());

  // Graceful shutdown.
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3001, '0.0.0.0');
}
bootstrap();
