// test/auth/auth-email-verification.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { DataSource } from 'typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthConfig } from 'src/config/auth.config';
import { EmailService } from 'src/modules/auth/services/email.service';
import { MessagingService } from 'src/modules/messaging/messaging.service';
import { CloudinaryService } from 'src/modules/cloudinary/cloudinary.service';
import {
  mockEmailService,
  mockMessagingService,
  mockCloudinaryService,
} from '../utils/mock-providers';

jest.setTimeout(60000);

describe('Auth Email Verification (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let container: StartedPostgreSqlContainer;
  let jwtService: JwtService;
  let configService: ConfigService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('test_db_email_verify')
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
      .overrideProvider(MessagingService)
      .useValue(mockMessagingService)
      .overrideProvider(CloudinaryService)
      .useValue(mockCloudinaryService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();

    jwtService = moduleFixture.get<JwtService>(JwtService);
    configService = moduleFixture.get<ConfigService>(ConfigService);
  });

  afterAll(async () => {
    if (app) await app.close();
    if (dataSource?.isInitialized) await dataSource.destroy();
    if (container) await container.stop();
  });

  beforeEach(async () => {
    const entities = dataSource.entityMetadatas;
    for (const entity of entities) {
      await dataSource
        .getRepository(entity.name)
        .query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
    }
    jest.clearAllMocks();
  });

  function buildEmailVerificationToken(email: string): string {
    const authConfig = configService.get<AuthConfig>('auth');
    return jwtService.sign(
      { email, type: 'email-verification' },
      {
        secret: authConfig!.jwt.emailVerificationSecret,
        expiresIn: authConfig!.jwt.emailVerificationExpiresIn,
      },
    );
  }

  it('should verify a valid email token and mark the user as verified', async () => {
    const email = 'verify_me@example.com';
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    await dataSource.getRepository('BaseUser').save({
      email,
      password: hashedPassword,
      role: 'USER',
      isEmailVerified: false,
    });

    const token = buildEmailVerificationToken(email);

    const res = await request(app.getHttpServer())
      .get(`/auth/verify-email?token=${token}`)
      .expect(200);

    expect(res.body.message).toBe('Email verified successfully');

    const user = await dataSource
      .getRepository('BaseUser')
      .findOne({ where: { email } });

    expect(user).toBeDefined();
    expect(user!.isEmailVerified).toBe(true);
  });

  it('should return a success message when email is already verified', async () => {
    const email = 'already_verified@example.com';
    const hashedPassword = await bcrypt.hash('Password123!', 10);

    await dataSource.getRepository('BaseUser').save({
      email,
      password: hashedPassword,
      role: 'USER',
      isEmailVerified: true,
    });

    const token = buildEmailVerificationToken(email);

    const res = await request(app.getHttpServer())
      .get(`/auth/verify-email?token=${token}`)
      .expect(200);

    expect(res.body.message).toBe('Email already verified');
  });

  it('should return 401 when the token is invalid', async () => {
    await request(app.getHttpServer())
      .get('/auth/verify-email?token=this.is.not.a.valid.jwt')
      .expect(401);
  });

  it('should return 401 when no token is provided', async () => {
    await request(app.getHttpServer()).get('/auth/verify-email').expect(401);
  });

  it('should return 401 when the token is signed with the wrong secret', async () => {
    const fakeToken = jwtService.sign(
      { email: 'user@example.com', type: 'email-verification' },
      { secret: 'completely-wrong-secret', expiresIn: '15m' },
    );

    await request(app.getHttpServer())
      .get(`/auth/verify-email?token=${fakeToken}`)
      .expect(401);
  });

  it('should return 401 when the token type is not email-verification', async () => {
    const authConfig = configService.get<AuthConfig>('auth');
    const wrongTypeToken = jwtService.sign(
      { email: 'user@example.com', type: 'access' },
      {
        secret: authConfig!.jwt.emailVerificationSecret,
        expiresIn: '15m',
      },
    );

    await request(app.getHttpServer())
      .get(`/auth/verify-email?token=${wrongTypeToken}`)
      .expect(401);
  });

  it('should allow login after successful email verification', async () => {
    const email = 'flow_verify@example.com';
    const password = 'Password123!';
    const hashedPassword = await bcrypt.hash(password, 10);

    await dataSource.getRepository('BaseUser').save({
      email,
      password: hashedPassword,
      role: 'USER',
      isEmailVerified: false,
    });

    // Login must fail before verification
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(401);

    // Verify email
    const token = buildEmailVerificationToken(email);
    await request(app.getHttpServer())
      .get(`/auth/verify-email?token=${token}`)
      .expect(200);

    // Login must succeed after verification
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(200);

    expect(loginRes.body).toHaveProperty('accessToken');
    expect(loginRes.body).toHaveProperty('refreshToken');
  });

  it('should return 400 when the email in the token does not exist in the database', async () => {
    const token = buildEmailVerificationToken('ghost@example.com');

    await request(app.getHttpServer())
      .get(`/auth/verify-email?token=${token}`)
      .expect(400);
  });
});
