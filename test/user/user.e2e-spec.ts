// test/user/user.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import {
  brandLoginDto,
  testAccount,
  testBrandAccount,
  testUserProfile,
  userLoginDto,
} from '../utils/test-data';
import * as bcrypt from 'bcrypt';
import { ConfigModule } from '@nestjs/config';

jest.setTimeout(30000);

describe('User (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    // Start Postgres Testcontainer
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test_db')
      .withUsername('test_user')
      .withPassword('test_pass')
      .start();

    // Initialize TypeORM DataSource
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

    // Create Nest TestingModule
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
        stopAtFirstError: false,
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
    // Clean tables before each test
    await dataSource.query('DELETE FROM "user_profiles"');
    await dataSource.query('DELETE FROM "base_users"');
    
    const hashedUserPassword = await bcrypt.hash(testAccount.password, 10);
    await dataSource.getRepository('base_users').save({
      ...testAccount,
      password: hashedUserPassword,
      isEmailVerified: true,
    });
  });

  // --- POST /user/complete-profile ---
  
  it('should return 401 if no token provided', async () => {
    await request(app.getHttpServer())
      .post('/user/complete-profile')
      .send(testUserProfile)
      .expect(401);
  });

  it('should register a new user profile', async () => {
    const LogInResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send(userLoginDto)
      .expect(200);
    const accessToken = LogInResponse.body.accessToken;
    const response = await request(app.getHttpServer())
      .post('/user/complete-profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(testUserProfile)
      .expect(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.username).toBe(testUserProfile.username);
    expect(response.body.bio).toBe(testUserProfile.bio);
  });

  it('should return 403 if role is not USER', async () => {
    const hashedPassword = await bcrypt.hash(testBrandAccount.password, 10);
    await dataSource.getRepository('base_users').save({
        ...testBrandAccount,
        password: hashedPassword,
        isEmailVerified: true,
    });
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(brandLoginDto)
      .expect(200);
    await request(app.getHttpServer())
      .post('/user/complete-profile')
      .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
      .send(testUserProfile)
      .expect(403);
  });

  it('should return 409 if username already exists', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(userLoginDto)
      .expect(200);
    const token = loginRes.body.accessToken;

    await request(app.getHttpServer())
      .post('/user/complete-profile')
      .set('Authorization', `Bearer ${token}`)
      .send(testUserProfile)
      .expect(201);

    await request(app.getHttpServer())
      .post('/user/complete-profile')
      .set('Authorization', `Bearer ${token}`)
      .send(testUserProfile)
      .expect(409);
  });

  it('should not allow creating profile twice for same user', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(userLoginDto)
      .expect(200);
    const token = loginRes.body.accessToken;

    await request(app.getHttpServer())
      .post('/user/complete-profile')
      .set('Authorization', `Bearer ${token}`)
      .send(testUserProfile)
      .expect(201);

    await request(app.getHttpServer())
      .post('/user/complete-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...testUserProfile,
        username: 'another_username',
      })
      .expect(409);
  });

  // --- GET /user/profile ---

  it('should get user profile after creation', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(userLoginDto)
      .expect(200);
    const token = loginRes.body.accessToken;
    
    await request(app.getHttpServer())
      .post('/user/complete-profile')
      .set('Authorization', `Bearer ${token}`)
      .send(testUserProfile)
      .expect(201);

    const profileRes = await request(app.getHttpServer())
      .get('/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(profileRes.body.username).toBe(testUserProfile.username);
  });

  it('should return 404 if profile does not exist', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(userLoginDto)
      .expect(200);
    const token = loginRes.body.accessToken;
    
    await request(app.getHttpServer())
      .get('/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

  // --- PATCH /user/profile ---

  it('should update user profile successfully', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(userLoginDto)
      .expect(200);
    const token = loginRes.body.accessToken;

    // Create profile first
    await request(app.getHttpServer())
      .post('/user/complete-profile')
      .set('Authorization', `Bearer ${token}`)
      .send(testUserProfile)
      .expect(201);

    // Update the profile
    const updateRes = await request(app.getHttpServer())
      .patch('/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({
        firstName: 'UpdatedName',
        bio: 'This is my updated bio',
      })
      .expect(200);

    expect(updateRes.body.firstName).toBe('UpdatedName');
    expect(updateRes.body.bio).toBe('This is my updated bio');
    expect(updateRes.body.username).toBe(testUserProfile.username); // Should remain unchanged
  });

  it('should return 409 when updating to an already taken username', async () => {
    // 1. Create a secondary user directly in the database to hold the conflicting username
    const hashedPass = await bcrypt.hash('password123', 10);
    const secondUser = await dataSource.getRepository('base_users').save({
      email: 'second_user@example.com',
      password: hashedPass,
      isEmailVerified: true,
      role: 'USER',
    });
    
    await dataSource.getRepository('user_profiles').save({
      baseUserId: secondUser.id,
      username: 'taken_username',
      firstName: 'Taken',
      lastName: 'User',
      gender: 'MALE',
    });

    // 2. Login as the primary test user
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(userLoginDto)
      .expect(200);
    const token = loginRes.body.accessToken;

    // 3. Complete profile for primary user
    await request(app.getHttpServer())
      .post('/user/complete-profile')
      .set('Authorization', `Bearer ${token}`)
      .send(testUserProfile)
      .expect(201);

    // 4. Attempt to update primary user's username to the taken one
    await request(app.getHttpServer())
      .patch('/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ username: 'taken_username' })
      .expect(409);
  });

  it('should return 404 when patching a profile that does not exist', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(userLoginDto)
      .expect(200);
    const token = loginRes.body.accessToken;

    await request(app.getHttpServer())
      .patch('/user/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ firstName: 'UpdatedName' })
      .expect(404);
  });

  // --- DELETE /user/account ---

  it('should delete the user account successfully', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(userLoginDto)
      .expect(200);
    const token = loginRes.body.accessToken;

    // Create profile
    await request(app.getHttpServer())
      .post('/user/complete-profile')
      .set('Authorization', `Bearer ${token}`)
      .send(testUserProfile)
      .expect(201);

    // Delete account
    await request(app.getHttpServer())
      .delete('/user/account')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Verify it's deleted by trying to login again
    await request(app.getHttpServer())
      .post('/auth/login')
      .send(userLoginDto)
      .expect(401);
  });

  it('should return 404 if trying to delete a non-existent user profile', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(userLoginDto)
      .expect(200);
    const token = loginRes.body.accessToken;

    // User is created in beforeEach, but profile is NEVER completed.
    // UserService.deleteAccount checks `findByBaseUserId` which returns null, throwing 404.
    await request(app.getHttpServer())
      .delete('/user/account')
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });

});