import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { validateConfig } from './shared/config/config.schema';

async function bootstrap() {
  validateConfig();
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
