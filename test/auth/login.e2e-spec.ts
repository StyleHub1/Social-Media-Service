// test/auth/login.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { Role } from 'src/modules/common/enums/role.enum';
import { testUserAccount, testBrandAccount, usrLoginDto, brandLoginDto } from '../utils/auth';
import * as bcrypt from 'bcrypt';
import { ConfigModule } from '@nestjs/config';
import { User } from 'src/modules/user/entities/user.entity';
import { Brand } from 'src/modules/brand/entities/brand.entity';

describe('Auth Login (E2E)', () => {
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
      synchronize: false,
      migrationsRun: true,
      logging: false,
      entities: ['src/modules/**/entities/*.{ts,js}'],
      migrations: ['src/database/migrations/*.{ts,js}'],
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

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
    await dataSource.query('DELETE FROM "users"');
    await dataSource.query('DELETE FROM "brands"');

    // Insert test USER
    const hashedUserPassword = await bcrypt.hash(testUserAccount.password, 10);
    await dataSource.getRepository('User').save({
      ...testUserAccount,
      password: hashedUserPassword,
    });

    // Insert test BRAND
    const hashedBrandPassword = await bcrypt.hash(testBrandAccount.password, 10);
    await dataSource.getRepository('Brand').save({
      ...testBrandAccount,
      password: hashedBrandPassword,
    });
  });

  it('USER logs in successfully', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send(usrLoginDto)
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user).toMatchObject({
      email: testUserAccount.email,
      username: testUserAccount.username,
      role: Role.USER,
      firstName: testUserAccount.firstName,
      lastName: testUserAccount.lastName,
    });
  });

  it('BRAND logs in successfully', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send(brandLoginDto)
      .expect(201);

    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.user).toMatchObject({
      email: testBrandAccount.email,
      username: testBrandAccount.username,
      role: Role.BRAND,
      brandName: testBrandAccount.brandName,
    });
  });

  it('fails if account does not exist', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        emailOrUsername: 'nonexistent@example.com',
        password: 'AnyPassword123!',
        role: Role.USER,
      })
      .expect(401);

    expect(res.body).toHaveProperty('message', 'Invalid credentials');
  });

  it('fails with wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        emailOrUsername: testUserAccount.email,
        password: 'WrongPassword123!',
        role: Role.USER,
      })
      .expect(401);

    expect(res.body).toHaveProperty('message', 'Invalid credentials');
  });
});