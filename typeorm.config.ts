import { config } from 'dotenv';
import { DataSource } from 'typeorm';

config(); // Load .env

export default new DataSource({
    type: 'postgres',
    // 1️⃣ CRITICAL: Use DATABASE_URL if it exists (Heroku), otherwise fall back to local vars
    url: process.env.DATABASE_URL, 
    
    // Fallbacks for local development
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432'),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'social_media',
    
    synchronize: false,
    
    // 2️⃣ CRITICAL: Heroku requires SSL. 
    // We enable it if DATABASE_URL is present, otherwise false (for local)
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,

    // 3️⃣ CRITICAL: Use __dirname for dynamic path resolution.
    // This allows it to find entities whether running from 'src' or 'dist'
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
});