import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { testAccount } from '../utils/test-data';
import * as bcrypt from 'bcrypt';
import { EmailService } from 'src/modules/auth/services/email.service';

const mockEmailService = {
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
};

jest.setTimeout(60000);

describe('Auth Refresh Token (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let container: StartedPostgreSqlContainer;
  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test_db_refresh')
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
      entities: ['src/modules/**/entities/*.entity.{ts,js}'],
    });
    await dataSource.initialize();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSource)
      .useValue(dataSource)
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (container) await container.stop();
  });

  beforeEach(async () => {
    const entities = dataSource.entityMetadatas;
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name);
      await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
    }

    const hashedPassword = await bcrypt.hash(testAccount.password, 10);
    await dataSource.getRepository('BaseUser').save({
      ...testAccount,
      password: hashedPassword,
      isEmailVerified: true,
    });
  });

  it('Login -> Refresh Token should return new tokens', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: testAccount.email, password: testAccount.password, role: testAccount.role })
      .expect(200);

    expect(loginRes.body).toHaveProperty('accessToken');
    expect(loginRes.body).toHaveProperty('refreshToken');

    const refreshRes = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${loginRes.body.refreshToken}`)
      .expect(200);

    expect(refreshRes.body).toHaveProperty('accessToken');
    expect(refreshRes.body).toHaveProperty('refreshToken');
    expect(refreshRes.body.user.email).toBe(testAccount.email);

    // Old refresh token should now be revoked
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Authorization', `Bearer ${loginRes.body.refreshToken}`)
      .expect(401);
  });

  it('Should fail refresh with invalid token', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Authorization', 'Bearer invalidtoken')
      .expect(401);
  });

  it('Should fail refresh if no token provided', async () => {
    await request(app.getHttpServer()).post('/auth/refresh').expect(401);
  });
});