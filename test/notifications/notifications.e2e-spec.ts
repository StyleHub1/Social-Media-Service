// test/notifications/notifications.e2e-spec.ts
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

jest.setTimeout(120000);

// ─── helpers ───────────────────────────────────────────────────────────────

async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password, role: 'USER' })
    .expect(200);
  return res.body.accessToken as string;
}

async function createUser(
  dataSource: DataSource,
  email: string,
): Promise<Record<string, string>> {
  const hashed = await bcrypt.hash('Password123!', 10);
  return dataSource.getRepository('base_users').save({
    email,
    password: hashed,
    isEmailVerified: true,
    role: 'USER',
  });
}

async function wait(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

// ─── suite ─────────────────────────────────────────────────────────────────

describe('Notifications (E2E)', () => {
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
    // Let any in-flight async event handlers (e.g. notification listener) settle
    // before deleting rows — prevents FK violations from detached async tasks.
    await wait(150);

    // Delete in FK-safe order
    await dataSource.query('DELETE FROM "notifications"');
    await dataSource.query('DELETE FROM "likes"');
    await dataSource.query('DELETE FROM "comments"');
    await dataSource.query('DELETE FROM "feed_items"');
    await dataSource.query('DELETE FROM "follows"');
    await dataSource.query('DELETE FROM "posts"');
    await dataSource.query('DELETE FROM "base_users"');

    const hashed = await bcrypt.hash(testAccount.password, 10);
    await dataSource.getRepository('base_users').save({
      ...testAccount,
      password: hashed,
      isEmailVerified: true,
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Auth guard
  // ─────────────────────────────────────────────────────────────────────────

  describe('Auth guard', () => {
    it('GET /notifications returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/notifications').expect(401);
    });

    it('GET /notifications/unread-count returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .expect(401);
    });

    it('PATCH /notifications/read-all returns 401 without token', async () => {
      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .expect(401);
    });

    it('PATCH /notifications/:id/read returns 401 without token', async () => {
      await request(app.getHttpServer())
        .patch('/notifications/some-id/read')
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /notifications
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /notifications', () => {
    it('returns empty list when user has no notifications', async () => {
      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it('returns correct pagination shape', async () => {
      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('meta');
      expect(res.body.meta).toHaveProperty('total');
      expect(res.body.meta).toHaveProperty('limit');
      expect(res.body.meta).toHaveProperty('offset');
    });

    it('respects limit and offset query params', async () => {
      const actor = await createUser(dataSource, 'actor@example.com');
      const recipient = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      for (let i = 0; i < 3; i++) {
        await dataSource.getRepository('notifications').save({
          recipientId: recipient!.id,
          actorId: actor.id,
          type: 'NEW_FOLLOWER',
          postId: null,
          isRead: false,
        });
      }

      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      const res = await request(app.getHttpServer())
        .get('/notifications?limit=2&offset=0')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(2);
      expect(res.body.meta.total).toBe(3);
      expect(res.body.meta.limit).toBe(2);
      expect(res.body.meta.offset).toBe(0);
    });

    it('returns notifications ordered by createdAt DESC', async () => {
      const actor = await createUser(dataSource, 'actor@example.com');
      const recipient = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      const first = await dataSource.getRepository('notifications').save({
        recipientId: recipient!.id,
        actorId: actor.id,
        type: 'NEW_FOLLOWER',
        postId: null,
        isRead: false,
        createdAt: new Date('2026-04-26T01:00:00Z'),
      });

      const second = await dataSource.getRepository('notifications').save({
        recipientId: recipient!.id,
        actorId: actor.id,
        type: 'POST_LIKED',
        postId: null,
        isRead: false,
        createdAt: new Date('2026-04-26T02:00:00Z'),
      });

      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items[0].id).toBe(second.id);
      expect(res.body.items[1].id).toBe(first.id);
    });

    it('notification item has the expected fields', async () => {
      const actor = await createUser(dataSource, 'actor@example.com');
      const recipient = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      const post = await dataSource.getRepository('posts').save({
        authorId: recipient!.id,
        content: 'A post',
        images: [],
        videos: [],
        visibility: 'PUBLIC',
      });

      await dataSource.getRepository('notifications').save({
        recipientId: recipient!.id,
        actorId: actor.id,
        type: 'POST_LIKED',
        postId: post.id,
        isRead: false,
      });

      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const item = res.body.items[0];
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('type', 'POST_LIKED');
      expect(item).toHaveProperty('actorId', actor.id);
      expect(item).toHaveProperty('postId', post.id);
      expect(item).toHaveProperty('isRead', false);
      expect(item).toHaveProperty('readAt', null);
      expect(item).toHaveProperty('createdAt');
    });

    it('only returns notifications for the authenticated user', async () => {
      const otherUser = await createUser(dataSource, 'other@example.com');
      const actor = await createUser(dataSource, 'actor@example.com');

      await dataSource.getRepository('notifications').save({
        recipientId: otherUser.id,
        actorId: actor.id,
        type: 'NEW_FOLLOWER',
        postId: null,
        isRead: false,
      });

      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /notifications/unread-count
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /notifications/unread-count', () => {
    it('returns 0 when user has no notifications', async () => {
      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      const res = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.count).toBe(0);
    });

    it('counts only unread notifications', async () => {
      const actor = await createUser(dataSource, 'actor@example.com');
      const recipient = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      // 2 unread
      for (let i = 0; i < 2; i++) {
        await dataSource.getRepository('notifications').save({
          recipientId: recipient!.id,
          actorId: actor.id,
          type: 'NEW_FOLLOWER',
          postId: null,
          isRead: false,
        });
      }
      // 1 already read
      await dataSource.getRepository('notifications').save({
        recipientId: recipient!.id,
        actorId: actor.id,
        type: 'POST_LIKED',
        postId: null,
        isRead: true,
        readAt: new Date(),
      });

      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      const res = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.count).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /notifications/:id/read
  // ─────────────────────────────────────────────────────────────────────────

  describe('PATCH /notifications/:id/read', () => {
    it('marks a notification as read and sets readAt', async () => {
      const actor = await createUser(dataSource, 'actor@example.com');
      const recipient = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      const notif = await dataSource.getRepository('notifications').save({
        recipientId: recipient!.id,
        actorId: actor.id,
        type: 'NEW_FOLLOWER',
        postId: null,
        isRead: false,
      });

      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      const res = await request(app.getHttpServer())
        .patch(`/notifications/${notif.id}/read`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.isRead).toBe(true);
      expect(res.body.readAt).not.toBeNull();
    });

    it('returns 404 when notification belongs to another user', async () => {
      const otherUser = await createUser(dataSource, 'other@example.com');
      const actor = await createUser(dataSource, 'actor@example.com');

      const notif = await dataSource.getRepository('notifications').save({
        recipientId: otherUser.id,
        actorId: actor.id,
        type: 'NEW_FOLLOWER',
        postId: null,
        isRead: false,
      });

      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      await request(app.getHttpServer())
        .patch(`/notifications/${notif.id}/read`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('returns 404 for non-existent notification id', async () => {
      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      await request(app.getHttpServer())
        .patch('/notifications/00000000-0000-0000-0000-000000000000/read')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /notifications/read-all
  // ─────────────────────────────────────────────────────────────────────────

  describe('PATCH /notifications/read-all', () => {
    it('marks all unread notifications as read', async () => {
      const actor = await createUser(dataSource, 'actor@example.com');
      const recipient = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      for (let i = 0; i < 3; i++) {
        await dataSource.getRepository('notifications').save({
          recipientId: recipient!.id,
          actorId: actor.id,
          type: 'NEW_FOLLOWER',
          postId: null,
          isRead: false,
        });
      }

      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const countRes = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(countRes.body.count).toBe(0);
    });

    it('does not affect notifications belonging to other users', async () => {
      const otherUser = await createUser(dataSource, 'other@example.com');
      const actor = await createUser(dataSource, 'actor@example.com');

      await dataSource.getRepository('notifications').save({
        recipientId: otherUser.id,
        actorId: actor.id,
        type: 'NEW_FOLLOWER',
        postId: null,
        isRead: false,
      });

      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const stillUnread = await dataSource.query(
        `SELECT * FROM notifications WHERE "recipientId" = $1 AND "isRead" = false`,
        [otherUser.id],
      );
      expect(stillUnread).toHaveLength(1);
    });

    it('is idempotent — a second call keeps unread count at 0', async () => {
      const actor = await createUser(dataSource, 'actor@example.com');
      const recipient = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      await dataSource.getRepository('notifications').save({
        recipientId: recipient!.id,
        actorId: actor.id,
        type: 'NEW_FOLLOWER',
        postId: null,
        isRead: false,
      });

      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const countRes = await request(app.getHttpServer())
        .get('/notifications/unread-count')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(countRes.body.count).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Event-driven notification creation
  // ─────────────────────────────────────────────────────────────────────────

  describe('Event-driven notification creation', () => {
    it('creates a NEW_FOLLOWER notification when user A follows user B', async () => {
      const userB = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      const userA = await createUser(dataSource, 'usera@example.com');
      const tokenA = await loginUser(app, 'usera@example.com', 'Password123!');

      await request(app.getHttpServer())
        .post('/follow')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ followingId: userB!.id })
        .expect(201);

      await wait(400);

      const notifications = await dataSource.query(
        `SELECT * FROM notifications WHERE "recipientId" = $1`,
        [userB!.id],
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('NEW_FOLLOWER');
      expect(notifications[0].actorId).toBe(userA.id);
    });

    it('creates a POST_LIKED notification when user A likes user B post', async () => {
      const userB = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      const tokenB = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );
      const postRes = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'User B post' })
        .expect(201);

      const userA = await createUser(dataSource, 'usera@example.com');
      const tokenA = await loginUser(app, 'usera@example.com', 'Password123!');

      await request(app.getHttpServer())
        .post(`/interactions/reactions/${postRes.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(201);

      await wait(400);

      const notifications = await dataSource.query(
        `SELECT * FROM notifications WHERE "recipientId" = $1 AND type = 'POST_LIKED'`,
        [userB!.id],
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].actorId).toBe(userA.id);
      expect(notifications[0].postId).toBe(postRes.body.id);
    });

    it('creates a POST_COMMENTED notification when user A comments on user B post', async () => {
      const userB = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      const tokenB = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );
      const postRes = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ content: 'User B post' })
        .expect(201);

      const userA = await createUser(dataSource, 'usera@example.com');
      const tokenA = await loginUser(app, 'usera@example.com', 'Password123!');

      await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ postId: postRes.body.id, content: 'Great post!' })
        .expect(201);

      await wait(400);

      const notifications = await dataSource.query(
        `SELECT * FROM notifications WHERE "recipientId" = $1 AND type = 'POST_COMMENTED'`,
        [userB!.id],
      );

      expect(notifications).toHaveLength(1);
      expect(notifications[0].actorId).toBe(userA.id);
      expect(notifications[0].postId).toBe(postRes.body.id);
    });

    it('does NOT create a notification when a user likes their own post', async () => {
      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      const postRes = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'My own post' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/interactions/reactions/${postRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);

      await wait(400);

      const recipient = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      const notifications = await dataSource.query(
        `SELECT * FROM notifications WHERE "recipientId" = $1 AND type = 'POST_LIKED'`,
        [recipient!.id],
      );

      expect(notifications).toHaveLength(0);
    });

    it('does NOT create a notification when a user comments on their own post', async () => {
      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      const postRes = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'My own post' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/interactions/comments')
        .set('Authorization', `Bearer ${token}`)
        .send({ postId: postRes.body.id, content: 'My own comment' })
        .expect(201);

      await wait(400);

      const recipient = await dataSource
        .getRepository('base_users')
        .findOne({ where: { email: testAccount.email } });

      const notifications = await dataSource.query(
        `SELECT * FROM notifications WHERE "recipientId" = $1 AND type = 'POST_COMMENTED'`,
        [recipient!.id],
      );

      expect(notifications).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Unused variable suppression — keep userLoginDto import used
  // ─────────────────────────────────────────────────────────────────────────
  void userLoginDto;
});
