import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const messages =
          Object.values(errors[0].constraints ?? {}).join(', ') ||
          'Validation failed';
        return new BadRequestException({
          statusCode: 400,
          message: messages,
          error: 'Bad Request',
        });
      },
    }),
  );

  // ✅ Swagger setup
  const config = new DocumentBuilder()
    .setTitle('My API')
    .setDescription('Auto-generated API docs')
    .setVersion('1.0')
    .addBearerAuth() // remove if you don't use JWT
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document); // accessible at /api/docs

  // ✅ Save swagger.json locally
  fs.writeFileSync('./swagger.json', JSON.stringify(document, null, 2));
  console.log('📄 swagger.json generated');

  app.enableCors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'https://style-hub-front-end-f71037b48364.herokuapp.com'],
    credentials: true,
  });

  const port = process.env.PORT || 8000;
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}`);
}
bootstrap();
