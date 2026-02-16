import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config(); // Load .env

export const AppDataSource = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'], 
    // ^ Ensure this path points to where migrations sit relative to this file
    synchronize: false,
});