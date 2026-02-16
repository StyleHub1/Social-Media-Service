import {config} from 'dotenv';
import { DataSource } from 'typeorm';

try {
  config();// Load .env file if it exists, but don't fail if it doesn't
} catch {
  console.log('No .env file found, using system environment variables');
} 

export default new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST??'localhost',
    port: parseInt(process.env.DB_PORT??'5432'),
    username: process.env.DB_USERNAME??'postgres',
    password: process.env.DB_PASSWORD??'postgres',
    database: process.env.DB_NAME??'social_media',
    synchronize: false, // Set to false in production and use migrations
    entities:['dist/**/*.entity{.ts,.js}'], // Adjust the path to your compiled entities
    migrations: ['dist/migrations/*{.ts,.js}'], // Adjust the path to your compiled migrations
})
