// test/auth/login.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { brandLoginDto, testBrandAccount, testUserAccount, usrLoginDto } from '../utils/auth';
import * as bcrypt from 'bcrypt';
import { ConfigModule } from '@nestjs/config';
import { UserProfileDto } from 'src/modules/user/dto/user-profile.dto';
import { profile } from 'console';
jest.setTimeout(30000);
describe('User (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';
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
      synchronize: true, // Use synchronize for faster test setup (or run migrations)
      logging: false,
      entities: ['src/modules/**/entities/*.{ts,js}'],
    });
    await dataSource.initialize();

    // Create Nest TestingModule
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        ConfigModule.forRoot({
            ignoreEnvFile: false,
            envFilePath: '.env.test',
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
    await dataSource.query('DELETE FROM "users"');
    await dataSource.query('DELETE FROM "brands"');
    // Insert test USER
    const hashedUserPassword = await bcrypt.hash(testUserAccount.password, 10);
    await dataSource.getRepository('User').save({
    ...testUserAccount,
    password: hashedUserPassword, });
    // Insert test BRAND
    const hashedBrandPassword = await bcrypt.hash(testBrandAccount.password, 10);
    await dataSource.getRepository('Brand').save({
        ...testBrandAccount,
        password: hashedBrandPassword,
    });
  });
  it('should require authentication', async () => {
    await request(app.getHttpServer())
      .get('/user/profile')
      .expect(401);
  });

  it('should get user profile with valid token', async () => {
    // First, log in to get a valid token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(usrLoginDto)
      .expect(200);
    const accessToken = loginRes.body.accessToken;
    // Now, use the token to get user profile
    const profileRes = await request(app.getHttpServer())
      .get('/user/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(profileRes.body).toMatchObject({
      username: testUserAccount.username,
      bio: testUserAccount.bio,
      firstName: testUserAccount.firstName,
      lastName: testUserAccount.lastName,
      profileImageUrl: testUserAccount.profileImageUrl,
      numberOfFollowers: 0,
      numberOfFollowing: 0,
      numberOfPosts: 0,
        });
    });
    it('should get profile with valid role and token', async () => {
      // First, log in to get a valid token
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(usrLoginDto)
        .expect(200);
      const accessToken = loginRes.body.accessToken;
      // Now, use the token to get user profile
      const profileRes = await request(app.getHttpServer())
        .get('/user/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
   });
   it('should fail to get profile with valid token but wrong role', async () => {
    // First, log in to get a valid token
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(brandLoginDto)
      .expect(200);
    const accessToken = loginRes.body.accessToken;
    // Now, use the token to get user profile
    const profileRes = await request(app.getHttpServer())
      .get('/user/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);
     });
});