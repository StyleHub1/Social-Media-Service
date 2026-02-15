
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { Role } from '../../src/modules/common/enums/role.enum';
import { testUserAccount, testBrandAccount } from '../utils/auth';
import * as bcrypt from 'bcrypt';
import { ConfigModule } from '@nestjs/config';
import { PasswordService } from 'src/modules/auth/services/password.service';

describe('Auth Registration (E2E)', () => {
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
      synchronize: false,
      migrationsRun: true,
      logging: false,
      entities: ['src/modules/**/entities/*.{ts,js}'],
      migrations: ['src/database/migrations/*.{ts,js}'],
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

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
    await dataSource.query('DELETE FROM "users"');
    await dataSource.query('DELETE FROM "brands"');
  });

  it('should register a new user successfully', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUserAccount)
      .expect(201);
    console.log(response.body);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toMatchObject({
      email: testUserAccount.email,
      username: testUserAccount.username,
      role: Role.USER,
      firstName: testUserAccount.firstName,
      lastName: testUserAccount.lastName,
    });
  });
  
  it('should register a new brand successfully', async () => {
    const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send(testBrandAccount)
        .expect(201);
    console.log(response.body);
    expect(response.body).toHaveProperty('accessToken');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toMatchObject({
      email: testBrandAccount.email,
      username: testBrandAccount.username,
      role: Role.BRAND,
      brandName: testBrandAccount.brandName,
    });
  });

  it('should not allow registration with existing email', async () => {
    // First registration should succeed
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUserAccount)
      .expect(201);

    // Second registration with same email should fail
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...testUserAccount, username: 'newusername' })
      .expect(409);

    expect(response.body.message).toContain('Email already exists');
  });

  it('should not allow registration with existing username', async () => {
    // First registration should succeed
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUserAccount)
      .expect(201);

    // Second registration with same username should fail
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ ...testUserAccount, email: 'newemail@example.com' })
      .expect(409);

    expect(response.body.message).toContain('Username already exists');
  });
  it('should enforce password complexity requirements', async () => {
    const weakPasswordAccount = {
      ...testUserAccount,
      password: 'pass',
      passwordConfirmation: 'pass',};
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(weakPasswordAccount)
      .expect(400);
    console.log(response.body.message);
    expect(response.body.message).toContain('Password must contain at least one uppercase letter');
    expect(response.body.message).toContain('Password must be at least 6 characters long');
  });
  it('should hash password before saving to database', async () => {
    await request(app.getHttpServer())
        .post('/auth/register')
        .send(testUserAccount)
        .expect(201);

    const user = await dataSource.getRepository('User').findOne({
        where: { email: testUserAccount.email },
        select: ['id', 'email', 'password'],
    });

    expect(user).toBeDefined();
    expect(user!.password).not.toEqual(testUserAccount.password);
    expect(user!.password.length).toBeGreaterThan(20); // bcrypt hash length
   });
  it('should not return password in response', async () => {
    const response = await request(app.getHttpServer())
    .post('/auth/register')
    .send(testUserAccount)
    .expect(201);

    expect(response.body.user).not.toHaveProperty('password');
   });
  it('should fail with invalid email format', async () => {
    const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...testUserAccount, email: 'invalid-email' })
        .expect(400);

    expect(response.body.message).toContain('Email must be valid');
    });
  it('should fail if password confirmation does not match', async () => {
    const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
        ...testUserAccount,
        passwordConfirmation: 'DifferentPassword123!',
        })
        .expect(400);

    expect(response.body.message).toContain('Password confirmation does not match password');
    });
  it('should fail with invalid role', async () => {
    const response = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ ...testUserAccount, role: 'ADMIN' })
        .expect(400);

    expect(response.body.message).toBeInstanceOf(Array);
    });
  it('should handle concurrent duplicate registrations safely', async () => {
    const payload = { ...testUserAccount };
    const requests = [
        request(app.getHttpServer())
        .post('/auth/register')
        .send(payload),

        request(app.getHttpServer())
        .post('/auth/register')
        .send(payload),
    ];
    const responses = await Promise.allSettled(requests);
    const fulfilled = responses.filter(
        (r) => r.status === 'fulfilled'
    ) as PromiseFulfilledResult<any>[];
    const successCount = fulfilled.filter(
        (r) => r.value.status === 201
    ).length;
    const conflictCount = fulfilled.filter(
        (r) => r.value.status === 409
    ).length;
    expect(successCount).toBe(1);
    expect(conflictCount).toBe(1);
    const users = await dataSource.getRepository('User').find({
        where: { email: payload.email },
    });
    expect(users.length).toBe(1);
    });

});