import { registerAs } from "@nestjs/config";
import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { parse } from "pg-connection-string"; // npm i pg-connection-string

export const typeOrmConfig = registerAs('database', (): TypeOrmModuleOptions => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && process.env.DATABASE_URL) {
    const parsed = parse(process.env.DATABASE_URL);
    return {
      type: 'postgres',
      host: parsed.host??'localhost',
      port: parseInt(parsed.port ?? '5432'),
      username: parsed.user,
      password: parsed.password,
      database: parsed.database?? 'social_media_DB',
      synchronize: false,
      autoLoadEntities: true,
      ssl: { rejectUnauthorized: false }, // لازم لـ Heroku Postgres
    };
  }

  // fallback dev config
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432'),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'social_media_DB',
    synchronize: false,
    autoLoadEntities: true,
  };
});