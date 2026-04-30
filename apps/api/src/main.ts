// API entrypoint — boots Nest with helmet, CORS, cookie parser, global prefix and Swagger (dev).
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

import { AppModule } from './app.module';
import { API_PREFIX } from './common/constants/app.constants';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  const config = app.get(ConfigService);
  const port = config.get<number>('app.port') ?? 4000;
  const webUrl = config.get<string>('app.webUrl') ?? 'http://localhost:3000';
  const nodeEnv = config.get<string>('app.nodeEnv') ?? 'development';

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: webUrl, credentials: true });
  app.setGlobalPrefix(API_PREFIX);

  if (nodeEnv !== 'production') {
    const doc = new DocumentBuilder()
      .setTitle('Agency Management API')
      .setDescription('OWNER-only financial isolation; role-based access')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const swagger = SwaggerModule.createDocument(app, doc);
    SwaggerModule.setup(`${API_PREFIX}/docs`, app, swagger);
  }

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[api] listening on http://localhost:${port}/${API_PREFIX}`);
}

void bootstrap();
