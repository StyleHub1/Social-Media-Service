// test/feed/feed.e2e-spec.ts
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
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

jest.setTimeout(90000);

describe('Feed (E2E)', () => {
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
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
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
    await dataSource.query('DELETE FROM "feed_items"');
    await dataSource.query('DELETE FROM "follows"');
    await dataSource.query('DELETE FROM "posts"');
    await dataSource.query('DELETE FROM "base_users"');

    const hashedPassword = await bcrypt.hash(testAccount.password, 10);
    await dataSource.getRepository('base_users').save({
      ...testAccount,
      password: hashedPassword,
      isEmailVerified: true,
    });
  });

  // ─────────────────────────────────────────────
  // GET /feed — Auth
  // ─────────────────────────────────────────────

  describe('GET /feed — auth', () => {
    it('returns 401 when no token provided', async () => {
      await request(app.getHttpServer()).get('/feed').expect(401);
    });
  });

  // ─────────────────────────────────────────────
  // GET /feed — Self-inclusion fan-out
  // ─────────────────────────────────────────────

  describe('GET /feed — fan-out on write', () => {
    it("shows author's own post in their feed after creation", async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'My own post' })
        .expect(201);

      await new Promise((r) => setTimeout(r, 300));

      const feedRes = await request(app.getHttpServer())
        .get('/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(feedRes.body.items[0].post.content).toBe('My own post');
      expect(feedRes.body.items[0].type).toBe('POST');
    });

    it("backfills followed user's posts into follower's feed on follow", async () => {
      const hashedPass = await bcrypt.hash('Password123!', 10);
      const userB = await dataSource.getRepository('base_users').save({
        email: 'userb@example.com',
        password: hashedPass,
        isEmailVerified: true,
        role: 'USER',
      });

      // User B has an existing post before the follow
      const postB = await dataSource.getRepository('posts').save({
        authorId: userB.id,
        content: 'User B existing post',
        images: [],
        videos: [],
        visibility: 'PUBLIC',
      });

      // User A follows User B
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const tokenA = loginRes.body.accessToken;

      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ followingId: userB.id })
        .expect(201);

      await new Promise((r) => setTimeout(r, 500));

      const feedRes = await request(app.getHttpServer())
        .get('/feed')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      const postIds = feedRes.body.items.map((i: any) => i.post.id);
      expect(postIds).toContain(postB.id);
    });

    it("removes unfollowed user's feed items after unfollow", async () => {
      const hashedPass = await bcrypt.hash('Password123!', 10);
      const userB = await dataSource.getRepository('base_users').save({
        email: 'userb@example.com',
        password: hashedPass,
        isEmailVerified: true,
        role: 'USER',
      });

      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const tokenA = loginRes.body.accessToken;

      // Follow then create a post as User B
      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ followingId: userB.id })
        .expect(201);

      await dataSource.getRepository('posts').save({
        authorId: userB.id,
        content: 'User B post',
        images: [],
        videos: [],
        visibility: 'PUBLIC',
      });

      await new Promise((r) => setTimeout(r, 500));

      // Unfollow
      await request(app.getHttpServer())
        .delete(`/follow/${userB.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(204);

      await new Promise((r) => setTimeout(r, 500));

      const userARecord = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      const remaining = await dataSource.query(
        `SELECT * FROM feed_items WHERE "ownerId" = $1 AND "authorId" = $2`,
        [userARecord!.id, userB.id],
      );
      expect(remaining).toHaveLength(0);
    });

    it('removes feed items when a post is soft-deleted', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      const postRes = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Post to be deleted' })
        .expect(201);

      await new Promise((r) => setTimeout(r, 300));

      const beforeDelete = await dataSource.query(
        `SELECT * FROM feed_items WHERE "postId" = $1`,
        [postRes.body.id],
      );
      expect(beforeDelete.length).toBeGreaterThan(0);

      await request(app.getHttpServer())
        .delete(`/posts/${postRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      await new Promise((r) => setTimeout(r, 300));

      const afterDelete = await dataSource.query(
        `SELECT * FROM feed_items WHERE "postId" = $1`,
        [postRes.body.id],
      );
      expect(afterDelete).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────
  // GET /feed — Global fallback
  // ─────────────────────────────────────────────

  describe('GET /feed — global fallback', () => {
    it('returns GLOBAL type items for a new user with no follows and no own posts', async () => {
      // Primary user creates a PUBLIC post
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const primaryToken = loginRes.body.accessToken;

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${primaryToken}`)
        .send({ content: 'Primary user public post' })
        .expect(201);

      await new Promise((r) => setTimeout(r, 300));

      // New user with no follows
      const hashedPass = await bcrypt.hash('Password123!', 10);
      await dataSource.getRepository('base_users').save({
        email: 'newuser@example.com',
        password: hashedPass,
        isEmailVerified: true,
        role: 'USER',
      });

      const newUserLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'newuser@example.com',
          password: 'Password123!',
        })
        .expect(200);

      const feedRes = await request(app.getHttpServer())
        .get('/feed')
        .set('Authorization', `Bearer ${newUserLogin.body.accessToken}`)
        .expect(200);

      expect(feedRes.body.items.length).toBeGreaterThan(0);
      expect(feedRes.body.items[0].type).toBe('GLOBAL');
    });
  });

  // ─────────────────────────────────────────────
  // GET /feed — Pagination
  // ─────────────────────────────────────────────

  describe('GET /feed — pagination', () => {
    it('respects limit and offset query params', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      for (let i = 1; i <= 3; i++) {
        await request(app.getHttpServer())
          .post('/posts')
          .set('Authorization', `Bearer ${token}`)
          .send({ content: `Post ${i}` })
          .expect(201);
      }

      await new Promise((r) => setTimeout(r, 500));

      const res = await request(app.getHttpServer())
        .get('/feed?limit=2&offset=0')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.meta.total).toBe(3);
    });

    it('returns feed items ordered by createdAt DESC', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'First post' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Second post' })
        .expect(201);

      await new Promise((r) => setTimeout(r, 500));

      const res = await request(app.getHttpServer())
        .get('/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items[0].post.content).toBe('Second post');
      expect(res.body.items[1].post.content).toBe('First post');
    });

    it('returns response shape with items and meta', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Shape test post' })
        .expect(201);

      await new Promise((r) => setTimeout(r, 300));

      const res = await request(app.getHttpServer())
        .get('/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('limit');
      expect(res.body.meta).toHaveProperty('offset');
      expect(res.body.items[0]).toHaveProperty('id');
      expect(res.body.items[0]).toHaveProperty('type');
      expect(res.body.items[0]).toHaveProperty('createdAt');
      expect(res.body.items[0]).toHaveProperty('post');
      expect(res.body.items[0].post).toHaveProperty('id');
      expect(res.body.items[0].post).toHaveProperty('content');
      expect(res.body.items[0].post).toHaveProperty('authorId');
    });
  });
});
