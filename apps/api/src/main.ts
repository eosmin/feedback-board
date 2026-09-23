import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from '@feedback-board/core';
import helmet from 'helmet';

import { AppModule } from './app.module';
import { validationExceptionFactory } from './common/validation-exception.factory';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  // rawBody is required by the Stripe signature check added in step 13 (§2.6.7); enabling it
  // here keeps the parsed JSON body available to every other controller.
  const app = await NestFactory.create(AppModule, { rawBody: true, bufferLogs: true });

  app.useLogger(app.get(Logger));

  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.use(helmet());
  app.enableCors({ origin: config.get('WEB_ORIGIN', { infer: true }), credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('FeedbackBoard API').setVersion('0.0.0').addBearerAuth().build(),
  );
  SwaggerModule.setup('docs', app, document);

  app.enableShutdownHooks();

  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
