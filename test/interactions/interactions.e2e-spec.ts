// test/interactions/interactions.e2e-spec.ts
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
  testBrandAccount,
  userLoginDto,
  brandLoginDto,
  testPost,
} from '../utils/test-data';

jest.setTimeout(60000);

describe('Interactions (E2E)', () => {
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

  let userPostId: string;
  let brandPostId: string;

  beforeEach(async () => {
    // Drain in-flight async event handlers (e.g. notification listener) before
    // deleting rows to avoid FK violations on the notifications table.
    await new Promise<void>((resolve) => setTimeout(resolve, 150));

    await dataSource.query('DELETE FROM "likes"');
    await dataSource.query('DELETE FROM "comments"');
    await dataSource.query('DELETE FROM "posts"');
    await dataSource.query('DELETE FROM "base_users"');

    const hashedPassword = await bcrypt.hash(testAccount.password, 10);

    const userEntity = await dataSource.getRepository('base_users').save({
      ...testAccount,
      password: hashedPassword,
      isEmailVerified: true,
    });

    const brandEntity = await dataSource.getRepository('base_users').save({
      ...testBrandAccount,
      password: hashedPassword,
      isEmailVerified: true,
    });

    const userPost = await dataSource.getRepository('posts').save({
      content: testPost.content,
      authorId: userEntity.id,
    });
    userPostId = userPost.id;

    const brandPost = await dataSource.getRepository('posts').save({
      content: 'Brand post',
      authorId: brandEntity.id,
    });
    brandPostId = brandPost.id;
  });

  async function loginUser(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send(userLoginDto)
      .expect(200);
    return res.body.accessToken;
  }

  async function loginBrand(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send(brandLoginDto)
      .expect(200);
    return res.body.accessToken;
  }

  // ─────────────────────────────────────────────
  // POST /interactions/reactions/:postId
  // ─────────────────────────────────────────────

  describe('POST /interactions/reactions/:postId', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .post(`/interactions/reactions/${userPostId}`)
        .expect(401);
    });

    it('should return 400 for invalid UUID param', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post('/interactions/reactions/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return 404 when post does not exist', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post('/interactions/reactions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('USER should react to a post successfully', async () => {
      const token = await loginUser();

      const res = await request(app.getHttpServer())
        .post(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.postId).toBe(userPostId);
    });

    it('should return 409 when user already reacted', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      await request(app.getHttpServer())
        .post(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    });

    it('BRAND should react to their own post successfully', async () => {
      const token = await loginBrand();

      const res = await request(app.getHttpServer())
        .post(`/interactions/reactions/${brandPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      expect(res.body).toHaveProperty('id');
    });

    it('BRAND should return 403 when reacting to another account post', async () => {
      const token = await loginBrand();

      await request(app.getHttpServer())
        .post(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should increment reactionsCount on the post after reacting', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const post = await dataSource
        .getRepository('posts')
        .findOne({ where: { id: userPostId } });

      expect(post!.reactionsCount).toBe(1);
    });
  });

  // ─────────────────────────────────────────────
  // DELETE /interactions/reactions/:postId
  // ─────────────────────────────────────────────

  describe('DELETE /interactions/reactions/:postId', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .delete(`/interactions/reactions/${userPostId}`)
        .expect(401);
    });

    it('should return 400 for invalid UUID param', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .delete('/interactions/reactions/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return 404 when reaction does not exist', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .delete(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should unreact from a post successfully', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should decrement reactionsCount on the post after unreacting', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const post = await dataSource
        .getRepository('posts')
        .findOne({ where: { id: userPostId } });

      expect(post!.reactionsCount).toBe(0);
    });
  });

  // ─────────────────────────────────────────────
  // GET /interactions/reactions/:postId
  // ─────────────────────────────────────────────

  describe('GET /interactions/reactions/:postId', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .get(`/interactions/reactions/${userPostId}`)
        .expect(401);
    });

    it('should return 400 for invalid UUID param', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .get('/interactions/reactions/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return 404 when post does not exist', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .get('/interactions/reactions/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return empty list when post has no reactions', async () => {
      const token = await loginUser();

      const res = await request(app.getHttpServer())
        .get(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it('should return reactions after someone reacts', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.items[0]).toHaveProperty('id');
    });

    it('should respect limit and offset query params', async () => {
      const token = await loginUser();
      const hashedPassword = await bcrypt.hash(testAccount.password, 10);

      for (let i = 0; i < 3; i++) {
        const extra = await dataSource.getRepository('base_users').save({
          email: `extra${i}@example.com`,
          password: hashedPassword,
          isEmailVerified: true,
          role: 'USER',
        });
        await dataSource.getRepository('likes').save({
          userId: extra.id,
          postId: userPostId,
        });
      }

      const res = await request(app.getHttpServer())
        .get(`/interactions/reactions/${userPostId}?limit=2&offset=0`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.meta.total).toBe(3);
    });
  });

  // ─────────────────────────────────────────────
  // POST /interactions/comments
  // ─────────────────────────────────────────────

  describe('POST /interactions/comments', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .post('/interactions/comments')
        .send({ postId: userPostId, content: 'Hello' })
        .expect(401);
    });

    it('should return 400 for invalid postId', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ postId: 'not-a-uuid', content: 'Hello' })
        .expect(400);
    });

    it('should return 400 when content is missing', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ postId: userPostId })
        .expect(400);
    });

    it('should return 400 when content is empty', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ postId: userPostId, content: '' })
        .expect(400);
    });

    it('should return 404 when post does not exist', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({
          postId: '00000000-0000-0000-0000-000000000000',
          content: 'Hello',
        })
        .expect(404);
    });

    it('USER should add a comment successfully', async () => {
      const token = await loginUser();

      const res = await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ postId: userPostId, content: 'Great post!' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.postId).toBe(userPostId);
      expect(res.body.content).toBe('Great post!');
    });

    it('BRAND should comment on their own post successfully', async () => {
      const token = await loginBrand();

      const res = await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ postId: brandPostId, content: 'Our brand post!' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
    });

    it('BRAND should return 403 when commenting on another account post', async () => {
      const token = await loginBrand();

      await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ postId: userPostId, content: 'Nice!' })
        .expect(403);
    });

    it('should increment commentsCount on the post after adding a comment', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ postId: userPostId, content: 'Great post!' })
        .expect(201);

      const post = await dataSource
        .getRepository('posts')
        .findOne({ where: { id: userPostId } });

      expect(post!.commentsCount).toBe(1);
    });
  });

  // ─────────────────────────────────────────────
  // PATCH /interactions/comments/:commentId
  // ─────────────────────────────────────────────

  describe('PATCH /interactions/comments/:commentId', () => {
    let commentId: string;

    beforeEach(async () => {
      const token = await loginUser();
      const res = await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ postId: userPostId, content: 'Original content' })
        .expect(201);
      commentId = res.body.id;
    });

    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .patch(`/interactions/comments/${commentId}`)
        .send({ content: 'Updated' })
        .expect(401);
    });

    it('should return 400 for invalid UUID param', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .patch('/interactions/comments/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Updated' })
        .expect(400);
    });

    it('should return 404 when comment does not exist', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .patch('/interactions/comments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Updated' })
        .expect(404);
    });

    it('should update own comment successfully', async () => {
      const token = await loginUser();

      const res = await request(app.getHttpServer())
        .patch(`/interactions/comments/${commentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Updated content' })
        .expect(200);

      expect(res.body.content).toBe('Updated content');
    });

    it('should return 403 when updating another user comment', async () => {
      const token = await loginBrand();

      await request(app.getHttpServer())
        .patch(`/interactions/comments/${commentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Unauthorized update' })
        .expect(403);
    });
  });

  // ─────────────────────────────────────────────
  // DELETE /interactions/comments/:commentId
  // ─────────────────────────────────────────────

  describe('DELETE /interactions/comments/:commentId', () => {
    let commentId: string;

    beforeEach(async () => {
      const token = await loginUser();
      const res = await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ postId: userPostId, content: 'Comment to delete' })
        .expect(201);
      commentId = res.body.id;
    });

    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .delete(`/interactions/comments/${commentId}`)
        .expect(401);
    });

    it('should return 400 for invalid UUID param', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .delete('/interactions/comments/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return 404 when comment does not exist', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .delete('/interactions/comments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('comment author should delete their own comment successfully', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .delete(`/interactions/comments/${commentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
    });

    it('should decrement commentsCount on the post after deleting a comment', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .delete(`/interactions/comments/${commentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const post = await dataSource
        .getRepository('posts')
        .findOne({ where: { id: userPostId } });

      expect(post!.commentsCount).toBe(0);
    });

    it('should return 403 when a third party tries to delete the comment', async () => {
      const token = await loginBrand();

      await request(app.getHttpServer())
        .delete(`/interactions/comments/${commentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });

  // ─────────────────────────────────────────────
  // GET /interactions/comments/:postId
  // ─────────────────────────────────────────────

  describe('GET /interactions/comments/:postId', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .get(`/interactions/comments/${userPostId}`)
        .expect(401);
    });

    it('should return 400 for invalid UUID param', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .get('/interactions/comments/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return 404 when post does not exist', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .get('/interactions/comments/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return empty list when post has no comments', async () => {
      const token = await loginUser();

      const res = await request(app.getHttpServer())
        .get(`/interactions/comments/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it('should return comments after one is added', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ postId: userPostId, content: 'Test comment' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/interactions/comments/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.meta.total).toBe(1);
      expect(res.body.items[0].content).toBe('Test comment');
    });

    it('should respect limit and offset query params', async () => {
      const token = await loginUser();

      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/interactions/comments')
          .set('Authorization', `Bearer ${token}`)
          .send({ postId: userPostId, content: `Comment ${i}` })
          .expect(201);
      }

      const res = await request(app.getHttpServer())
        .get(`/interactions/comments/${userPostId}?limit=2&offset=0`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.meta.total).toBe(3);
    });

    it('should not return soft-deleted comments', async () => {
      const token = await loginUser();

      const commentRes = await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ postId: userPostId, content: 'Will be deleted' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/interactions/comments/${commentRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/interactions/comments/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.meta.total).toBe(0);
    });

    it('should include author profile info in each comment', async () => {
      const token = await loginUser();

      const user = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      await dataSource.getRepository('user_profiles').save({
        baseUserId: user!.id,
        username: 'testuser_e2e',
        firstName: 'Test',
        lastName: 'User',
        gender: 'MALE',
        profileImageUrl: 'https://example.com/avatar.jpg',
      });

      await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ postId: userPostId, content: 'Author info test' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/interactions/comments/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const comment = res.body.items[0];
      expect(comment.author).toBeDefined();
      expect(comment.author.role).toBe('USER');
      expect(comment.author.userProfile).toBeDefined();
      expect(comment.author.userProfile.firstName).toBe('Test');
      expect(comment.author.userProfile.lastName).toBe('User');
      expect(comment.author.userProfile.username).toBe('testuser_e2e');
      expect(comment.author.userProfile.profileImageUrl).toBe(
        'https://example.com/avatar.jpg',
      );
    });
  });

  // ─────────────────────────────────────────────
  // GET /interactions/reactions/:postId/status
  // ─────────────────────────────────────────────

  describe('GET /interactions/reactions/:postId/status', () => {
    it('should return 401 if no token provided', async () => {
      await request(app.getHttpServer())
        .get(`/interactions/reactions/${userPostId}/status`)
        .expect(401);
    });

    it('should return 400 for invalid UUID param', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .get('/interactions/reactions/not-a-uuid/status')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('should return 404 when post does not exist', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .get(
          '/interactions/reactions/00000000-0000-0000-0000-000000000000/status',
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('should return reacted: false when user has not reacted', async () => {
      const token = await loginUser();

      const res = await request(app.getHttpServer())
        .get(`/interactions/reactions/${userPostId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ reacted: false });
    });

    it('should return reacted: true after user reacts to a post', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get(`/interactions/reactions/${userPostId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ reacted: true });
    });

    it('should return reacted: false after user unreacts', async () => {
      const token = await loginUser();

      await request(app.getHttpServer())
        .post(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/interactions/reactions/${userPostId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/interactions/reactions/${userPostId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ reacted: false });
    });
  });
});
