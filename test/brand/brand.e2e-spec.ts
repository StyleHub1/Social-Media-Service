// test/brand/brand.e2e-spec.ts
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
import { EmailService } from 'src/modules/auth/services/email.service';
import { MessagingService } from 'src/modules/messaging/messaging.service';
import { CloudinaryService } from 'src/modules/cloudinary/cloudinary.service';
import {
  mockEmailService,
  mockMessagingService,
  mockCloudinaryService,
} from '../utils/mock-providers';

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
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .overrideProvider(MessagingService)
      .useValue(mockMessagingService)
      .overrideProvider(CloudinaryService)
      .useValue(mockCloudinaryService)
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
      const hashedPassword = await bcrypt.hash(testBrandAccount.password, 10);

      await dataSource.getRepository('base_users').save({
        ...testBrandAccount,
        password: hashedPassword,
        isEmailVerified: true,
      });
    });

    // --- POST /brand/complete-profile ---

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
      expect(response.body.brandName).toBe(testBrandProfile.brandName);
    });

    it('should return 403 if role is not BRAND', async () => {
      const userHashed = await bcrypt.hash(testAccount.password, 10);

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

      await request(app.getHttpServer())
        .post('/brand/complete-profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...testBrandProfile,
          brandName: 'AnotherBrand',
        })
        .expect(409);
    });

    // --- GET /brand/profile ---

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

      expect(profileRes.body.brandName).toBe(testBrandProfile.brandName);
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

    // --- PATCH /brand/profile ---

    it('should update brand profile successfully', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(brandLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      // Complete profile
      await request(app.getHttpServer())
        .post('/brand/complete-profile')
        .set('Authorization', `Bearer ${token}`)
        .send(testBrandProfile)
        .expect(201);

      // Update the profile
      const updateRes = await request(app.getHttpServer())
        .patch('/brand/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          brandName: 'Updated Brand Name',
          bio: 'Our new brand bio',
        })
        .expect(200);

      expect(updateRes.body.brandName).toBe('Updated Brand Name');
      expect(updateRes.body.bio).toBe('Our new brand bio');
      expect(updateRes.body.username).toBe(testBrandProfile.username); // Should be unchanged
    });

    it('should return 409 when updating to an already taken username', async () => {
      // 1. Create a secondary brand user directly in the DB to hold the conflicting username
      const hashedPass = await bcrypt.hash('password123', 10);
      const secondBrandUser = await dataSource
        .getRepository('base_users')
        .save({
          email: 'second_brand@example.com',
          password: hashedPass,
          isEmailVerified: true,
          role: Role.BRAND,
        });

      await dataSource.getRepository('brand_profiles').save({
        baseUserId: secondBrandUser.id,
        username: 'taken_brand_username',
        brandName: 'Taken Brand',
      });

      // 2. Login as the primary test brand
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(brandLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      // 3. Complete profile for primary brand
      await request(app.getHttpServer())
        .post('/brand/complete-profile')
        .set('Authorization', `Bearer ${token}`)
        .send(testBrandProfile)
        .expect(201);

      // 4. Attempt to patch username to the conflicting one
      await request(app.getHttpServer())
        .patch('/brand/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ username: 'taken_brand_username' })
        .expect(409);
    });

    it('should return 404 when patching a profile that does not exist', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(brandLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      await request(app.getHttpServer())
        .patch('/brand/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({ brandName: 'New Brand Name' })
        .expect(404);
    });

    // --- DELETE /brand/account ---

    it('should delete the brand profile and account successfully', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(brandLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      // Complete profile
      await request(app.getHttpServer())
        .post('/brand/complete-profile')
        .set('Authorization', `Bearer ${token}`)
        .send(testBrandProfile)
        .expect(201);

      // Delete account
      await request(app.getHttpServer())
        .delete('/brand/account')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Verify deletion by attempting to login again
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(brandLoginDto)
        .expect(401);
    });

    it('should return 404 if trying to delete a non-existent brand profile', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(brandLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      // Profile is never completed in this test block.
      // BrandService.deleteProfile will throw a 404 since findByBaseUserId returns null.
      await request(app.getHttpServer())
        .delete('/brand/account')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // --- GET /brand (public list) ---

  describe('GET /brand', () => {
    it('should return 200 without auth token', async () => {
      await request(app.getHttpServer()).get('/brand').expect(200);
    });

    it('should return empty items when no brands exist', async () => {
      const res = await request(app.getHttpServer()).get('/brand').expect(200);

      expect(res.body.items).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('should return paginated brands with correct fields only', async () => {
      const hashedPassword = await bcrypt.hash(testBrandAccount.password, 10);
      const baseUser = await dataSource.getRepository('base_users').save({
        ...testBrandAccount,
        password: hashedPassword,
        isEmailVerified: true,
      });

      await dataSource.getRepository('brand_profiles').save({
        baseUserId: baseUser.id,
        username: testBrandProfile.username,
        brandName: testBrandProfile.brandName,
        profileImageUrl: null,
      });

      const res = await request(app.getHttpServer()).get('/brand').expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);

      const item = res.body.items[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('username', testBrandProfile.username);
      expect(item).toHaveProperty('brandName', testBrandProfile.brandName);
      expect(item).toHaveProperty('profileImageUrl');
      expect(item).not.toHaveProperty('email');
      expect(item).not.toHaveProperty('password');
      expect(item).not.toHaveProperty('bio');
      expect(item).not.toHaveProperty('websiteUrl');
    });

    it('should respect limit and offset pagination params', async () => {
      const hashedPassword = await bcrypt.hash(testBrandAccount.password, 10);

      for (let i = 0; i < 3; i++) {
        const baseUser = await dataSource.getRepository('base_users').save({
          email: `brand_list_${i}@example.com`,
          password: hashedPassword,
          isEmailVerified: true,
          role: 'BRAND',
        });
        await dataSource.getRepository('brand_profiles').save({
          baseUserId: baseUser.id,
          username: `brand_list_user_${i}`,
          brandName: `Brand List ${i}`,
        });
      }

      const page1 = await request(app.getHttpServer())
        .get('/brand?limit=2&offset=0')
        .expect(200);

      expect(page1.body.items).toHaveLength(2);
      expect(page1.body.meta.total).toBe(3);
      expect(page1.body.meta.limit).toBe(2);
      expect(page1.body.meta.offset).toBe(0);

      const page2 = await request(app.getHttpServer())
        .get('/brand?limit=2&offset=2')
        .expect(200);

      expect(page2.body.items).toHaveLength(1);
      expect(page2.body.meta.offset).toBe(2);
    });
  });
});
