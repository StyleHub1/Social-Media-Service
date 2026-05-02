// test/posts/posts.e2e-spec.ts
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
import {
  testAccount,
  testPost,
  testPostVisibilityFollowers,
  testPostPrivate,
  userLoginDto,
} from '../utils/test-data';

jest.setTimeout(60000);

describe('Posts (E2E)', () => {
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
    // Allow async feed fan-out events from the previous test to settle before cleanup
    await new Promise((r) => setTimeout(r, 300));
    await dataSource.query('DELETE FROM "feed_items"');
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
  // POST /posts
  // ─────────────────────────────────────────────

  describe('POST /posts', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .post('/posts')
        .send(testPost)
        .expect(401);
    });

    it('should create a post with content only', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send(testPost)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.content).toBe(testPost.content);
      expect(res.body.visibility).toBe('PUBLIC');
      expect(res.body.images).toEqual([]);
      expect(res.body.videos).toEqual([]);
    });

    it('should create a post with FOLLOWERS visibility', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send(testPostVisibilityFollowers)
        .expect(201);

      expect(res.body.visibility).toBe('FOLLOWERS');
    });

    it('should create a post with PRIVATE visibility', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send(testPostPrivate)
        .expect(201);

      expect(res.body.visibility).toBe('PRIVATE');
    });

    it('should return 400 if post has no content, images, or videos', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({})
        .expect(400);
    });

    it('should return 400 for an invalid visibility value', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ content: 'test', visibility: 'INVALID_VALUE' })
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────
  // GET /posts
  // ─────────────────────────────────────────────

  describe('GET /posts', () => {
    it('should return paginated posts ordered by createdAt DESC', async () => {
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

      const res = await request(app.getHttpServer()).get('/posts').expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.items).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
      // Most recent post should come first
      expect(res.body.items[0].content).toBe('Second post');
    });

    it('should respect limit and offset query params', async () => {
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

      const res = await request(app.getHttpServer())
        .get('/posts?limit=2&offset=0')
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.meta.total).toBe(3);
    });

    it('should return empty list when no posts exist', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);

      const res = await request(app.getHttpServer()).get('/posts').expect(200);

      expect(res.body.items).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // GET /posts/user/:userId
  // ─────────────────────────────────────────────

  describe('GET /posts/user/:userId', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .get('/posts/user/some-uuid')
        .expect(401);
    });

    it('should return posts for a given userId', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;
      const userId = loginRes.body.user.id;

      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send(testPost)
        .expect(201);

      const user = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      const res = await request(app.getHttpServer())
        .get(`/posts/user/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].content).toBe(testPost.content);
    });

    it('should return empty list for a user with no posts', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;
      const userId = loginRes.body.user.id;
      const user = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      const res = await request(app.getHttpServer())
        .get(`/posts/user/${userId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(0);
    });

    it('should return 400 for an invalid UUID', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);

      await request(app.getHttpServer())
        .get('/posts/user/not-a-uuid')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────
  // GET /posts/:id
  // ─────────────────────────────────────────────

  describe('GET /posts/:id', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer()).get('/posts/some-uuid').expect(401);
    });

    it('should return a post by id', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      const createRes = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send(testPost)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/posts/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.id).toBe(createRes.body.id);
      expect(res.body.content).toBe(testPost.content);
    });

    it('should return 404 for a non-existent post id', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);

      await request(app.getHttpServer())
        .get('/posts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(404);
    });

    it('should return 400 for an invalid UUID', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);

      await request(app.getHttpServer())
        .get('/posts/not-a-uuid')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────
  // PATCH /posts/:id
  // ─────────────────────────────────────────────

  describe('PATCH /posts/:id', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .patch('/posts/some-uuid')
        .send({ content: 'Updated' })
        .expect(401);
    });

    it('should update a post successfully', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      const createRes = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send(testPost)
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/posts/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Updated content' })
        .expect(200);

      expect(res.body.content).toBe('Updated content');
      expect(res.body.id).toBe(createRes.body.id);
    });

    it('should update post visibility', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      const createRes = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send(testPost)
        .expect(201);

      const res = await request(app.getHttpServer())
        .patch(`/posts/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ visibility: 'PRIVATE' })
        .expect(200);

      expect(res.body.visibility).toBe('PRIVATE');
    });

    it("should return 403 when updating another user's post", async () => {
      // 1. Create a second user and their post directly in the DB
      const hashedPass = await bcrypt.hash('password123', 10);
      const secondUser = await dataSource.getRepository('base_users').save({
        email: 'second_user@example.com',
        password: hashedPass,
        isEmailVerified: true,
        role: 'USER',
      });

      const otherPost = await dataSource.getRepository('posts').save({
        authorId: secondUser.id,
        content: 'Second user post',
        images: [],
        videos: [],
        visibility: 'PUBLIC',
      });

      // 2. Login as primary user
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/posts/${otherPost.id}`)
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ content: 'Hijacked content' })
        .expect(403);
    });

    it('should return 404 when updating a non-existent post', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);

      await request(app.getHttpServer())
        .patch('/posts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ content: 'Updated' })
        .expect(404);
    });
  });

  // ─────────────────────────────────────────────
  // DELETE /posts/:id
  // ─────────────────────────────────────────────

  describe('DELETE /posts/:id', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer()).delete('/posts/some-uuid').expect(401);
    });

    it('should soft-delete a post and return 204', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      const createRes = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send(testPost)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/posts/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Verify the post is no longer accessible via GET
      await request(app.getHttpServer())
        .get(`/posts/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it("should return 403 when deleting another user's post", async () => {
      // 1. Create a second user and their post directly in the DB
      const hashedPass = await bcrypt.hash('password123', 10);
      const secondUser = await dataSource.getRepository('base_users').save({
        email: 'second_user@example.com',
        password: hashedPass,
        isEmailVerified: true,
        role: 'USER',
      });

      const otherPost = await dataSource.getRepository('posts').save({
        authorId: secondUser.id,
        content: 'Second user post',
        images: [],
        videos: [],
        visibility: 'PUBLIC',
      });

      // 2. Login as primary user and try to delete
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);

      await request(app.getHttpServer())
        .delete(`/posts/${otherPost.id}`)
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(403);
    });

    it('should return 404 when deleting a non-existent post', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);

      await request(app.getHttpServer())
        .delete('/posts/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .expect(404);
    });

    it('should not appear in GET /posts after soft-delete', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send(userLoginDto)
        .expect(200);
      const token = loginRes.body.accessToken;

      const createRes = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send(testPost)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/posts/${createRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const allPosts = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      expect(allPosts.body.items).toHaveLength(0);
      expect(allPosts.body.meta.total).toBe(0);
    });
  });
});
