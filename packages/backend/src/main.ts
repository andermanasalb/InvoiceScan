import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { validateConfig } from './shared/config/config.schema';

async function bootstrap() {
  validateConfig();
  const app = await NestFactory.create(AppModule);

  // Required to parse HttpOnly cookies (refresh token)
  app.use(cookieParser());

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
