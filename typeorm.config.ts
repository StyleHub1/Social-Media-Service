import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config(); // load .env

const isProduction = !!process.env.DATABASE_URL;

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(isProduction
    ? {
        url: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Heroku SSL
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        username: process.env.DB_USERNAME || 'test_user',
        password: process.env.DB_PASSWORD || 'test',
        database: process.env.DB_NAME || 'test_db',
      }),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: ['./src/database/migrations/*.{ts,js}'],
  synchronize: false,
});

// -------- LOG the database being used --------
console.log('🌐 TypeORM connecting to database:');
if (isProduction) {
  console.log('Using DATABASE_URL:', process.env.DATABASE_URL);
} else {
  console.log(`host=${process.env.DB_HOST}, port=${process.env.DB_PORT}, user=${process.env.DB_USERNAME}, database=${process.env.DB_NAME}`);
}