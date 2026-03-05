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
import { Role } from 'src/modules/common/enums/role.enum';
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
    await dataSource.query('DELETE FROM "base_users"');
    await dataSource.query('DELETE FROM "user_profiles"');
    const hashedUserPassword = await bcrypt.hash(testAccount.password, 10);
    await dataSource.getRepository('base_users').save({
      ...testAccount,
      password: hashedUserPassword,
      isEmailVerified: true,
    });
  });
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
    expect(response.body.username).toBe('new_user');
    expect(response.body.bio).toBe('This is a new user.');
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
});
