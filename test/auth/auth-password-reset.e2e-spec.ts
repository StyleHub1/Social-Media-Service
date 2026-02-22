import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { Role } from 'src/modules/common/enums/role.enum';
import * as bcrypt from 'bcrypt';
import { EmailService } from 'src/modules/auth/services/email.service';
import { ResetToken } from 'src/modules/auth/entities/reset_tokens.entity';

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

  // Test User Data
  const testUser = {
    email: 'reset_test@example.com',
    username: 'resetuser',
    password: 'OldPassword123!',
    role: Role.USER,
    firstName: 'Reset',
    lastName: 'Test',
  };

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
      synchronize: true, // Use synchronize for faster test setup (or run migrations)
      entities: ['src/modules/**/entities/*.entity.{ts,js}'], // Ensure this path matches your structure
    });
    await dataSource.initialize();

    // 3. Create Nest App with Overrides
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DataSource)
      .useValue(dataSource)
      .overrideProvider(EmailService) // 👈 IMPORTANT: Replace real email service
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
      await repository.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
    }

    // Seed User
    const hashedPassword = await bcrypt.hash(testUser.password, 10);
    await dataSource.getRepository('User').save({
      ...testUser,
      password: hashedPassword,
    });
  });

  it('Full Flow: Forgot Password -> Verify Code -> Reset Password -> Login', async () => {
    // ---------------------------------------------------------
    // STEP 1: Request Password Reset (Forgot Password)
    // ---------------------------------------------------------
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({
        email: testUser.email,
        role: Role.USER,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.message).toContain('sent');
      });

    // Verify EmailService was called
    expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalled();

    // ---------------------------------------------------------
    // INTERLUDE: Retrieve the Code from DB (Cheat Step)
    // ---------------------------------------------------------
    // Since we can't check a real email inbox, we look into the DB
    const resetCodeEntry = await dataSource
      .getRepository(ResetToken)
      .findOne({ where: { email: testUser.email } });

    expect(resetCodeEntry).toBeDefined();
    const validCode = resetCodeEntry?.token;
    // ---------------------------------------------------------
    // STEP 2: Verify Code
    // ---------------------------------------------------------
    await request(app.getHttpServer())
      .post('/auth/verify-reset-code')
      .send({
        email: testUser.email,
        role: Role.USER,
        token: validCode,
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.valid).toBe(true);
      });

    // ---------------------------------------------------------
    // STEP 3: Reset Password
    // ---------------------------------------------------------
    const newPassword = 'NewStrongPassword123!';
    
    await request(app.getHttpServer())
      .post('/auth/reset-password')
      .send({
        email: testUser.email,
        role: Role.USER,
        token: validCode,
        newPassword: newPassword,
        newPasswordConfirm: newPassword,
      })
      .expect(200);

    // ---------------------------------------------------------
    // STEP 4: Verify Login with New Password
    // ---------------------------------------------------------
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        emailOrUsername: testUser.email,
        password: newPassword,
        role: Role.USER,
      })
      .expect(200); // Or 201 depending on your controller

    expect(loginRes.body).toHaveProperty('accessToken');

    // Ensure Old Password fails
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        emailOrUsername: testUser.email,
        password: testUser.password, // Old pass
        role: Role.USER,
      })
      .expect(401);
  });

  it('Should fail to verify with invalid code', async () => {
    // Request Code first to generate an entry
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({ email: testUser.email, role: Role.USER })
      .expect(200);

    // Try verifying with wrong code
    await request(app.getHttpServer())
      .post('/auth/verify-reset-code')
      .send({
        email: testUser.email,
        role: Role.USER,
        token: '000000', // Wrong code
      })
      .expect(400);
  });

  it('Should handle non-existent email gracefully (Security)', async () => {
    await request(app.getHttpServer())
      .post('/auth/forgot-password')
      .send({
        email: 'ghost@example.com',
        role: Role.USER,
      })
      .expect(200); // Should still return 200 OK to prevent enumeration

    // Ensure NO code was saved for this ghost email
    const ghostEntry = await dataSource
      .getRepository(ResetToken)
      .findOne({ where: { email: 'ghost@example.com' } });
    
    expect(ghostEntry).toBeNull();
  });
});