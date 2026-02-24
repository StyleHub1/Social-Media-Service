import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import * as bcrypt from 'bcrypt';
import { EmailService } from 'src/modules/auth/services/email.service';
import { testAccount } from '../utils/test-data';

// Mock EmailService to prevent actual API calls
const mockEmailService = {
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
};

jest.setTimeout(60000); // Containers can take time

describe('Auth Password Reset (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    // 1. Start Postgres Container
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test_db_reset')
      .withUsername('test_user')
      .withPassword('test_pass')
      .start();

    // 2. Connect TypeORM
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

    // 3. Create Nest App with Overrides
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSource)
      .useValue(dataSource)
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
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
    // Clean DB
    const entities = dataSource.entityMetadatas;
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name);
      await repository.query(`TRUNCATE TABLE "${entity.tableName}" RESTART IDENTITY CASCADE;`);
    }

    // Seed User
    const hashedPassword = await bcrypt.hash(testAccount.password, 10);
    await dataSource.getRepository("BaseUser").save({
      ...testAccount,
      password: hashedPassword,
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  it('Full Flow: Forgot Password -> Verify Code -> Reset Password -> Login', async () => {
    // STEP 1: Request Password Reset
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({
        email: testAccount.email,
        role: testAccount.role,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.message).toContain('sent');
      });

    expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();

    const user = await dataSource.getRepository("BaseUser").findOne({ where: { email: testAccount.email } });
    expect(user).toBeDefined();

    // STEP 1b: Retrieve reset code from DB
    const resetTokenEntry = await dataSource.getRepository("ResetToken").findOne({ where: { baseUserId: user!.id } });
    expect(resetTokenEntry).toBeDefined();
    const validCode = resetTokenEntry!.token;

    // STEP 2: Verify Code
    await request(app.getHttpServer())
      .post('/auth/verify-reset-code')
      .send({
        email: testAccount.email,
        role: testAccount.role,
        token: validCode,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.valid).toBe(true);
      });

    // STEP 3: Reset Password
    const newPassword = 'NewStrongPassword123!';
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        email: testAccount.email,
        role: testAccount.role,
        token: validCode,
        newPassword,
        newConfirmationPassword: newPassword,
      })
      .expect(200);

    // STEP 4: Login with new password
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testAccount.email,
        password: newPassword,
        role: testAccount.role,
      })
      .expect(200);

    expect(loginRes.body).toHaveProperty('accessToken');

    // Old password should fail
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: testAccount.email,
        password: testAccount.password,
        role: testAccount.role,
      })
      .expect(401);
  });

  it('Should fail to verify with invalid code', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: testAccount.email, role: testAccount.role })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/verify-reset-code')
      .send({
        email: testAccount.email,
        role: testAccount.role,
        token: '000000', // Wrong code
      })
      .expect(400);
  });
});