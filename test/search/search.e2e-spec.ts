// test/search/search.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { Role } from 'src/modules/common/enums/role.enum';
import * as bcrypt from 'bcrypt';
import { ConfigModule } from '@nestjs/config';
import { Gender } from '../../src/modules/user/enums/user-gender';

jest.setTimeout(30000);

describe('Search (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let container: StartedPostgreSqlContainer;
  let accessToken: string;
  let testUserId: string;
  let testBrandId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_pass')
      .start();

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getMappedPort(5432),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      synchronize: true,
      logging: false,
      entities: ['src/modules/**/entities/*.{ts,js}'],
    });

    await dataSource.initialize();
    
    // IMPORTANT: Enable pg_trgm for the similarity() function used in your repositories
    await dataSource.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
        }),
      ],
    })
      .overrideProvider(DataSource)
      .useValue(dataSource)
      .compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (container) await container.stop();
  });

  beforeEach(async () => {
    await dataSource.query('DELETE FROM "user_profiles"');
    await dataSource.query('DELETE FROM "brand_profiles"');
    await dataSource.query('DELETE FROM "base_users"');

    const hashedPassword = await bcrypt.hash('password123!', 10);

    // 1. Create a Base User (for login / token generation) and User Profile
    const baseUser = await dataSource.getRepository('base_users').save({
      email: 'omar_user@test.com',
      password: hashedPassword,
      role: Role.USER,
      isEmailVerified: true,
      isProfileComplete: true,
    });
    testUserId = baseUser.id;

    await dataSource.getRepository('user_profiles').save({
      baseUserId: baseUser.id,
      username: 'omar_dev',
      firstName: 'Omar',
      lastName: 'Smith',
      bio: 'Just a user named Omar',
      gender: Gender.MALE,
    });

    // 2. Create a Brand Profile
    const baseBrand = await dataSource.getRepository('base_users').save({
      email: 'omar_brand@test.com',
      password: hashedPassword,
      role: Role.BRAND,
      isEmailVerified: true,
      isProfileComplete: true,
    });
    testBrandId = baseBrand.id;

    await dataSource.getRepository('brand_profiles').save({
      baseUserId: baseBrand.id,
      username: 'omar_inc',
      brandName: 'Omar Corporation',
      bio: 'A brand by Omar',
    });

    // 3. Login to get the token for protected routes
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ role: Role.USER, email: 'omar_user@test.com', password: 'password123!' })
      .expect(200);

    accessToken = loginRes.body.accessToken;
  });

  // --- GET /search ---

  it('should return 401 if no token provided', async () => {
    await request(app.getHttpServer())
      .get('/search?query=omar')
      .expect(401);
  });

  it('should return empty array if query is empty or whitespace', async () => {
    const response = await request(app.getHttpServer())
      .get('/search?query=   ')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  it('should search and return both users and brands sorted by score', async () => {
    const response = await request(app.getHttpServer())
      .get('/search?query=omar')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    
    // Check that we got both brand and user results
    const types = response.body.map((item: any) => item.type);
    expect(types).toContain(Role.USER);
    expect(types).toContain(Role.BRAND);

    // Verify sorting (descending order by score)
    const scores = response.body.map((item: any) => item.score);
    const sortedScores = [...scores].sort((a, b) => b - a);
    expect(scores).toEqual(sortedScores);
  });

  // --- GET /search/user/:id ---

  it('should return a user profile by id', async () => {
    const response = await request(app.getHttpServer())
      .get(`/search/user/${testUserId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.id).toBe(testUserId);
    expect(response.body.username).toBe('omar_dev');
    expect(response.body.type).toBe(Role.USER);
  });

  it('should return 404 for a non-existent user id', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await request(app.getHttpServer())
      .get(`/search/user/${fakeId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  // --- GET /search/brand/:id ---

  it('should return a brand profile by id', async () => {
    const response = await request(app.getHttpServer())
      .get(`/search/brand/${testBrandId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.id).toBe(testBrandId);
    expect(response.body.username).toBe('omar_inc');
    expect(response.body.type).toBe(Role.BRAND);
  });

  it('should return 404 for a non-existent brand id', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await request(app.getHttpServer())
      .get(`/search/brand/${fakeId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(404);
  });

  // --- GET /search/account/:id ---

  it('should return a user profile from account endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get(`/search/account/${testUserId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.id).toBe(testUserId);
    expect(response.body.type).toBe(Role.USER);
  });

  it('should return a brand profile from account endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get(`/search/account/${testBrandId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Note: If this fails with 404, check the SearchService.getAccountById implementation 
    // to ensure user service throwing 404 doesn't break the fallback to brand.
    expect(response.body.id).toBe(testBrandId);
    expect(response.body.type).toBe(Role.BRAND);
  });
});