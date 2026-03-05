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
  testAccount,
  testBrandAccount,
  testBrandProfile,
  brandLoginDto,
  userLoginDto,
} from '../utils/test-data';
import * as bcrypt from 'bcrypt';
import { ConfigModule } from '@nestjs/config';

jest.setTimeout(30000);

describe('Brand Profile (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let container: StartedPostgreSqlContainer;

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
    await dataSource.query('DELETE FROM "brand_profiles"');
    await dataSource.query('DELETE FROM "base_users"');
  });

  describe('Brand Profile Flow', () => {
    beforeEach(async () => {
      const hashedPassword = await bcrypt.hash(
        testBrandAccount.password,
        10,
      );

      await dataSource.getRepository('base_users').save({
        ...testBrandAccount,
        password: hashedPassword,
        isEmailVerified: true,
      });
    });

    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .post('/brand/complete-profile')
        .send(testBrandProfile)
        .expect(401);
    });

    it('should register a new brand profile', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(brandLoginDto)
        .expect(200);

      const token = loginRes.body.accessToken;

      const response = await request(app.getHttpServer())
        .post('/brand/complete-profile')
        .set('Authorization', `Bearer ${token}`)
        .send(testBrandProfile)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.brandName).toBe(
        testBrandProfile.brandName,
      );
    });

    it('should return 403 if role is not BRAND', async () => {
      const userHashed = await bcrypt.hash(
        testAccount.password,
        10,
      );

      await dataSource.getRepository('base_users').save({
        ...testAccount,
        password: userHashed,
        role: Role.USER,
        isEmailVerified: true,
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);

      await request(app.getHttpServer())
        .post('/brand/complete-profile')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send(testBrandProfile)
        .expect(403);
    });

    it('should not allow creating brand profile twice', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(brandLoginDto)
        .expect(200);

      const token = loginRes.body.accessToken;

      await request(app.getHttpServer())
        .post('/brand/complete-profile')
        .set('Authorization', `Bearer ${token}`)
        .send(testBrandProfile)
        .expect(201);

      const response = await request(app.getHttpServer())
        .post('/brand/complete-profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...testBrandProfile,
          brandName: 'AnotherBrand',
        })
        .expect(409);
    });
    it('should get brand profile after creation', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(brandLoginDto)
        .expect(200);

      const token = loginRes.body.accessToken;

      await request(app.getHttpServer())
        .post('/brand/complete-profile')
        .set('Authorization', `Bearer ${token}`)
        .send(testBrandProfile)
        .expect(201);

      const profileRes = await request(app.getHttpServer())
        .get('/brand/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileRes.body.brandName).toBe(
        testBrandProfile.brandName,
      );
    });

    it('should return 404 if brand profile does not exist', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(brandLoginDto)
        .expect(200);

      await request(app.getHttpServer())
        .get('/brand/profile')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(404);
    });
  });
});