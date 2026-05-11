// test/follow/follow.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request = require('supertest');
import { DataSource } from 'typeorm';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { ConfigModule } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { EmailService } from 'src/modules/auth/services/email.service';
import { MessagingService } from 'src/modules/messaging/messaging.service';
import { CloudinaryService } from 'src/modules/cloudinary/cloudinary.service';
import {
  mockEmailService,
  mockMessagingService,
  mockCloudinaryService,
} from '../utils/mock-providers';
import { testAccount, userLoginDto } from '../utils/test-data';

jest.setTimeout(60000);

describe('Follow (E2E)', () => {
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

  let secondUserId: string;

  beforeEach(async () => {
    // Drain in-flight async event handlers (e.g. notification listener) before
    // deleting rows to avoid FK violations on the notifications table.
    await new Promise<void>((resolve) => setTimeout(resolve, 150));

    await dataSource.query('DELETE FROM "follows"');
    await dataSource.query('DELETE FROM "base_users"');

    const hashedPassword = await bcrypt.hash(testAccount.password, 10);

    // Primary user (used via login)
    await dataSource.getRepository('base_users').save({
      ...testAccount,
      password: hashedPassword,
      isEmailVerified: true,
    });

    // Second user to follow/unfollow
    const secondUser = await dataSource.getRepository('base_users').save({
      email: 'other_user@example.com',
      password: hashedPassword,
      isEmailVerified: true,
      role: 'USER',
    });
    secondUserId = secondUser.id;
  });

  async function loginPrimary(): Promise<{ token: string; userId: string }> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send(userLoginDto)
      .expect(200);
    return { token: res.body.accessToken, userId: res.body.user.id };
  }

  // ─────────────────────────────────────────────
  // POST /follow
  // ─────────────────────────────────────────────

  describe('POST /follow', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .post('/follow')
        .send({ followingId: secondUserId })
        .expect(401);
    });

    it('should follow another user successfully', async () => {
      const { token } = await loginPrimary();

      const res = await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${token}`)
        .send({ followingId: secondUserId })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.followingId).toBe(secondUserId);
      expect(res.body.status).toBe('ACTIVE');
    });

    it('should return 400 when trying to follow yourself', async () => {
      const { token, userId } = await loginPrimary();

      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${token}`)
        .send({ followingId: userId })
        .expect(400);
    });

    it('should return 409 when already following the user', async () => {
      const { token } = await loginPrimary();

      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${token}`)
        .send({ followingId: secondUserId })
        .expect(201);

      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${token}`)
        .send({ followingId: secondUserId })
        .expect(409);
    });

    it('should return 404 when following a non-existent user', async () => {
      const { token } = await loginPrimary();

      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${token}`)
        .send({ followingId: '00000000-0000-0000-0000-000000000000' })
        .expect(404);
    });

    it('should return 400 when followingId is not a UUID', async () => {
      const { token } = await loginPrimary();

      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${token}`)
        .send({ followingId: 'not-a-uuid' })
        .expect(400);
    });

    it('should allow a BRAND to follow a user', async () => {
      const hashedPassword = await bcrypt.hash(testAccount.password, 10);
      await dataSource.getRepository('base_users').save({
        email: 'brand@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'BRAND',
      });

      const brandLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'brand@example.com',
          password: testAccount.password,
        })
        .expect(200);

      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${brandLogin.body.accessToken}`)
        .send({ followingId: secondUserId })
        .expect(201);
    });
  });

  // ─────────────────────────────────────────────
  // DELETE /follow/:followingId
  // ─────────────────────────────────────────────

  describe('DELETE /follow/:followingId', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .delete(`/follow/${secondUserId}`)
        .expect(401);
    });

    it('should unfollow a user successfully and return 204', async () => {
      const { token } = await loginPrimary();

      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${token}`)
        .send({ followingId: secondUserId })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/follow/${secondUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('should return 404 when unfollowing someone you do not follow', async () => {
      const { token } = await loginPrimary();

      await request(app.getHttpServer())
        .delete(`/follow/${secondUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return 400 for an invalid UUID param', async () => {
      const { token } = await loginPrimary();

      await request(app.getHttpServer())
        .delete('/follow/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────
  // GET /follow/followers  (my followers)
  // ─────────────────────────────────────────────

  describe('GET /follow/followers', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer()).get('/follow/followers').expect(401);
    });

    it('should return empty list when nobody follows me', async () => {
      const { token } = await loginPrimary();

      const res = await request(app.getHttpServer())
        .get('/follow/followers')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it('should return my followers after someone follows me', async () => {
      const { token, userId } = await loginPrimary();

      await dataSource.getRepository('follows').save({
        followerId: secondUserId,
        followingId: userId,
      });

      const res = await request(app.getHttpServer())
        .get('/follow/followers')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.items[0]).toHaveProperty('id');
      expect(res.body.items[0]).toHaveProperty('name');
      expect(res.body.items[0]).toHaveProperty('username');
      expect(res.body.items[0]).toHaveProperty('profileImageUrl');
    });

    it('should allow a BRAND to access their own followers', async () => {
      const hashedPassword = await bcrypt.hash(testAccount.password, 10);
      const brand = await dataSource.getRepository('base_users').save({
        email: 'brand_followers@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'BRAND',
      });

      await dataSource.getRepository('follows').save({
        followerId: secondUserId,
        followingId: brand.id,
      });

      const brandLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'brand_followers@example.com',
          password: testAccount.password,
        })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/follow/followers')
        .set('Authorization', `Bearer ${brandLogin.body.accessToken}`)
        .expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.items[0]).toHaveProperty('id');
      expect(res.body.items[0]).toHaveProperty('name');
    });

    it('should respect limit and offset query params', async () => {
      const { token, userId } = await loginPrimary();

      for (let i = 0; i < 3; i++) {
        const hashedPassword = await bcrypt.hash(testAccount.password, 10);
        const extra = await dataSource.getRepository('base_users').save({
          email: `extra${i}@example.com`,
          password: hashedPassword,
          isEmailVerified: true,
          role: 'USER',
        });
        await dataSource.getRepository('follows').save({
          followerId: extra.id,
          followingId: userId,
        });
      }

      const res = await request(app.getHttpServer())
        .get('/follow/followers?limit=2&offset=0')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.meta.total).toBe(3);
    });
  });

  // ─────────────────────────────────────────────
  // GET /follow/following  (who I follow)
  // ─────────────────────────────────────────────

  describe('GET /follow/following', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer()).get('/follow/following').expect(401);
    });

    it('should return empty list when not following anyone', async () => {
      const { token } = await loginPrimary();

      const res = await request(app.getHttpServer())
        .get('/follow/following')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it('should return following list after following a user', async () => {
      const { token } = await loginPrimary();

      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${token}`)
        .send({ followingId: secondUserId })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/follow/following')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.items[0]).toHaveProperty('id');
      expect(res.body.items[0]).toHaveProperty('name');
      expect(res.body.items[0]).toHaveProperty('username');
      expect(res.body.items[0]).toHaveProperty('profileImageUrl');
    });

    it('should allow a BRAND to access their own following list', async () => {
      const hashedPassword = await bcrypt.hash(testAccount.password, 10);
      await dataSource.getRepository('base_users').save({
        email: 'brand_following@example.com',
        password: hashedPassword,
        isEmailVerified: true,
        role: 'BRAND',
      });

      const brandLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'brand_following@example.com',
          password: testAccount.password,
        })
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/follow/following')
        .set('Authorization', `Bearer ${brandLogin.body.accessToken}`)
        .expect(200);

      expect(res.body.items).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // GET /follow/:userId/followers
  // ─────────────────────────────────────────────

  describe('GET /follow/:userId/followers', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .get(`/follow/${secondUserId}/followers`)
        .expect(401);
    });

    it("should return another user's followers", async () => {
      const { token, userId } = await loginPrimary();

      await dataSource.getRepository('follows').save({
        followerId: userId,
        followingId: secondUserId,
      });

      const res = await request(app.getHttpServer())
        .get(`/follow/${secondUserId}/followers`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.meta.total).toBe(1);
    });

    it('should return 400 for an invalid UUID param', async () => {
      const { token } = await loginPrimary();

      await request(app.getHttpServer())
        .get('/follow/not-a-uuid/followers')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────
  // GET /follow/:userId/following
  // ─────────────────────────────────────────────

  describe('GET /follow/:userId/following', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .get(`/follow/${secondUserId}/following`)
        .expect(401);
    });

    it("should return another user's following list", async () => {
      const { token, userId } = await loginPrimary();

      await dataSource.getRepository('follows').save({
        followerId: secondUserId,
        followingId: userId,
      });

      const res = await request(app.getHttpServer())
        .get(`/follow/${secondUserId}/following`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.meta.total).toBe(1);
    });

    it('should return 400 for an invalid UUID param', async () => {
      const { token } = await loginPrimary();

      await request(app.getHttpServer())
        .get('/follow/not-a-uuid/following')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────
  // GET /follow/status/:followingId
  // ─────────────────────────────────────────────

  describe('GET /follow/status/:followingId', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .get(`/follow/status/${secondUserId}`)
        .expect(401);
    });

    it('should return isFollowing: false when not following', async () => {
      const { token } = await loginPrimary();

      const res = await request(app.getHttpServer())
        .get(`/follow/status/${secondUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.isFollowing).toBe(false);
    });

    it('should return isFollowing: true after following', async () => {
      const { token } = await loginPrimary();

      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${token}`)
        .send({ followingId: secondUserId })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/follow/status/${secondUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.isFollowing).toBe(true);
    });

    it('should return isFollowing: false after unfollowing', async () => {
      const { token } = await loginPrimary();

      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${token}`)
        .send({ followingId: secondUserId })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/follow/${secondUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const res = await request(app.getHttpServer())
        .get(`/follow/status/${secondUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.isFollowing).toBe(false);
    });

    it('should return 400 for an invalid UUID param', async () => {
      const { token } = await loginPrimary();

      await request(app.getHttpServer())
        .get('/follow/status/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────
  // Counter side-effects
  // ─────────────────────────────────────────────

  describe('Counter side-effects', () => {
    it('should increment followersCount and followingCount after follow', async () => {
      const { token, userId } = await loginPrimary();

      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${token}`)
        .send({ followingId: secondUserId })
        .expect(201);

      const follower = await dataSource
        .getRepository('base_users')
        .findOne({ where: { id: userId } });
      const following = await dataSource
        .getRepository('base_users')
        .findOne({ where: { id: secondUserId } });

      expect(follower!.followingCount).toBe(1);
      expect(following!.followersCount).toBe(1);
    });

    it('should decrement counters after unfollow', async () => {
      const { token, userId } = await loginPrimary();

      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${token}`)
        .send({ followingId: secondUserId })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/follow/${secondUserId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const follower = await dataSource
        .getRepository('base_users')
        .findOne({ where: { id: userId } });
      const following = await dataSource
        .getRepository('base_users')
        .findOne({ where: { id: secondUserId } });

      expect(follower!.followingCount).toBe(0);
      expect(following!.followersCount).toBe(0);
    });
  });
});
