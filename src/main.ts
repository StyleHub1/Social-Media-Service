// src/main.ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Heroku provides PORT dynamically
  const port = process.env.PORT || 8000;
  
  await app.listen(port, '0.0.0.0');
  console.log(`Application is running on: http://0.0.0.0:${port}`);
}
bootstrap();