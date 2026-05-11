// test/chat/chat.e2e-spec.ts
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
import { testAccount } from '../utils/test-data';

jest.setTimeout(120000);

// ─── helpers ───────────────────────────────────────────────────────────────

async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, password })
    .expect(200);
  return res.body.accessToken as string;
}

async function createAndLoginUser(
  app: INestApplication,
  dataSource: DataSource,
  email: string,
): Promise<{ id: string; token: string }> {
  const hashed = await bcrypt.hash('Password123!', 10);
  const user = await dataSource.getRepository('base_users').save({
    email,
    password: hashed,
    isEmailVerified: true,
    role: 'USER',
  });
  const token = await loginUser(app, email, 'Password123!');
  return { id: user.id as string, token };
}

async function wait(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

// ─── suite ─────────────────────────────────────────────────────────────────

describe('Chat (E2E)', () => {
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
    await wait(150);

    // Delete in FK-safe order
    await dataSource.query('DELETE FROM "chat_messages"');
    await dataSource.query('DELETE FROM "conversations"');
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
    it('POST /chat/messages returns 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/chat/messages')
        .send({ recipientId: 'some-id', content: 'hello' })
        .expect(401);
    });

    it('GET /chat/conversations returns 401 without token', async () => {
      await request(app.getHttpServer()).get('/chat/conversations').expect(401);
    });

    it('GET /chat/conversations/:id/messages returns 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/chat/conversations/some-id/messages')
        .expect(401);
    });

    it('PATCH /chat/conversations/:id/seen returns 401 without token', async () => {
      await request(app.getHttpServer())
        .patch('/chat/conversations/some-id/seen')
        .expect(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /chat/messages — send direct message
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /chat/messages', () => {
    it('creates conversation and sends first message', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      const res = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ recipientId: bob.id, content: 'Hello Bob!' })
        .expect(201);

      expect(res.body).toMatchObject({
        senderId: alice.id,
        content: 'Hello Bob!',
        status: expect.stringMatching(/SENT|DELIVERED/),
      });
      expect(res.body.id).toBeDefined();
      expect(res.body.conversationId).toBeDefined();
    });

    it('returns same conversation on second message between same users', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      const first = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ recipientId: bob.id, content: 'Hi' })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ recipientId: bob.id, content: 'Again' })
        .expect(201);

      expect(second.body.conversationId).toBe(first.body.conversationId);
    });

    it('validates content is required', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ recipientId: bob.id })
        .expect(400);
    });

    it('validates recipientId is required', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );

      await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ content: 'Hello' })
        .expect(400);
    });

    it('rejects content exceeding 5000 characters', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ recipientId: bob.id, content: 'x'.repeat(5001) })
        .expect(400);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /chat/conversations — get or create conversation
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /chat/conversations', () => {
    it('creates conversation when none exists', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      const res = await request(app.getHttpServer())
        .post('/chat/conversations')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ participantId: bob.id })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.otherParticipantId).toBe(bob.id);
      expect(res.body.unreadCount).toBe(0);
    });

    it('returns existing conversation on second call', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      const first = await request(app.getHttpServer())
        .post('/chat/conversations')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ participantId: bob.id })
        .expect(201);

      const second = await request(app.getHttpServer())
        .post('/chat/conversations')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ participantId: bob.id })
        .expect(201);

      expect(second.body.id).toBe(first.body.id);
    });

    it('is symmetric — both users see the same conversation id', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      const aliceConv = await request(app.getHttpServer())
        .post('/chat/conversations')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ participantId: bob.id })
        .expect(201);

      const bobConv = await request(app.getHttpServer())
        .post('/chat/conversations')
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ participantId: alice.id })
        .expect(201);

      expect(bobConv.body.id).toBe(aliceConv.body.id);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /chat/conversations
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /chat/conversations', () => {
    it('returns empty list when user has no conversations', async () => {
      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      const res = await request(app.getHttpServer())
        .get('/chat/conversations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(0);
      expect(res.body.meta.total).toBe(0);
    });

    it('lists conversations after messaging', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ recipientId: bob.id, content: 'Hi' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/chat/conversations')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].otherParticipantId).toBe(bob.id);
    });

    it('reflects unread count for recipient', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ recipientId: bob.id, content: 'Msg 1' })
        .expect(201);

      await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ recipientId: bob.id, content: 'Msg 2' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/chat/conversations')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      expect(res.body.items[0].unreadCount).toBe(2);
    });

    it('supports limit and offset pagination', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );

      for (let i = 0; i < 3; i++) {
        const other = await createAndLoginUser(
          app,
          dataSource,
          `user${i}@example.com`,
        );
        await request(app.getHttpServer())
          .post('/chat/messages')
          .set('Authorization', `Bearer ${alice.token}`)
          .send({ recipientId: other.id, content: `Hi ${i}` })
          .expect(201);
      }

      const page1 = await request(app.getHttpServer())
        .get('/chat/conversations?limit=2&offset=0')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      const page2 = await request(app.getHttpServer())
        .get('/chat/conversations?limit=2&offset=2')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      expect(page1.body.items).toHaveLength(2);
      expect(page2.body.items).toHaveLength(1);
      expect(page1.body.meta.total).toBe(3);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // GET /chat/conversations/:id/messages
  // ─────────────────────────────────────────────────────────────────────────

  describe('GET /chat/conversations/:id/messages', () => {
    it('returns messages in descending order (newest first)', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      const convRes = await request(app.getHttpServer())
        .post('/chat/conversations')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ participantId: bob.id })
        .expect(201);

      const conversationId = convRes.body.id as string;

      for (const content of ['First', 'Second', 'Third']) {
        await request(app.getHttpServer())
          .post(`/chat/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${alice.token}`)
          .send({ content })
          .expect(201);
      }

      const res = await request(app.getHttpServer())
        .get(`/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      expect(res.body.items).toHaveLength(3);
      expect(res.body.items[0].content).toBe('Third');
      expect(res.body.items[2].content).toBe('First');
    });

    it('returns 403 when user is not a participant', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      const convRes = await request(app.getHttpServer())
        .post('/chat/conversations')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ participantId: bob.id })
        .expect(201);

      const conversationId = convRes.body.id as string;

      const charlie = await createAndLoginUser(
        app,
        dataSource,
        'charlie@example.com',
      );

      await request(app.getHttpServer())
        .get(`/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${charlie.token}`)
        .expect(403);
    });

    it('supports cursor-based pagination', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      const convRes = await request(app.getHttpServer())
        .post('/chat/conversations')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ participantId: bob.id })
        .expect(201);

      const conversationId = convRes.body.id as string;

      for (let i = 1; i <= 5; i++) {
        await request(app.getHttpServer())
          .post(`/chat/conversations/${conversationId}/messages`)
          .set('Authorization', `Bearer ${alice.token}`)
          .send({ content: `Message ${i}` })
          .expect(201);
      }

      const page1 = await request(app.getHttpServer())
        .get(`/chat/conversations/${conversationId}/messages?limit=3`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      expect(page1.body.items).toHaveLength(3);
      expect(page1.body.nextCursor).toBeDefined();

      const page2 = await request(app.getHttpServer())
        .get(
          `/chat/conversations/${conversationId}/messages?limit=3&cursor=${page1.body.nextCursor as string}`,
        )
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      expect(page2.body.items).toHaveLength(2);
      expect(page2.body.nextCursor).toBeNull();

      // No duplicate messages across pages
      const ids1 = page1.body.items.map(
        (m: { id: string }) => m.id,
      ) as string[];
      const ids2 = page2.body.items.map(
        (m: { id: string }) => m.id,
      ) as string[];
      const overlap = ids1.filter((id) => ids2.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('returns 404 for non-existent conversation', async () => {
      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      await request(app.getHttpServer())
        .get(
          '/chat/conversations/00000000-0000-0000-0000-000000000000/messages',
        )
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // POST /chat/conversations/:id/messages
  // ─────────────────────────────────────────────────────────────────────────

  describe('POST /chat/conversations/:id/messages', () => {
    it('sends a message into an existing conversation', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      const convRes = await request(app.getHttpServer())
        .post('/chat/conversations')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ participantId: bob.id })
        .expect(201);

      const conversationId = convRes.body.id as string;

      const msgRes = await request(app.getHttpServer())
        .post(`/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ content: 'Hello from alice' })
        .expect(201);

      expect(msgRes.body).toMatchObject({
        senderId: alice.id,
        conversationId,
        content: 'Hello from alice',
        status: expect.stringMatching(/SENT|DELIVERED/),
      });
    });

    it('returns 403 when non-participant tries to send', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      const convRes = await request(app.getHttpServer())
        .post('/chat/conversations')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ participantId: bob.id })
        .expect(201);

      const conversationId = convRes.body.id as string;

      // Create charlie only after the conversation exists — avoids a
      // 3-concurrent-login race where alice.token resolves to undefined.
      const charlie = await createAndLoginUser(
        app,
        dataSource,
        'charlie@example.com',
      );

      await request(app.getHttpServer())
        .post(`/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${charlie.token}`)
        .send({ content: 'Sneaky message' })
        .expect(403);
    });

    it('returns 404 for non-existent conversation', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );

      await request(app.getHttpServer())
        .post(
          '/chat/conversations/00000000-0000-0000-0000-000000000000/messages',
        )
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ content: 'Hello' })
        .expect(404);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PATCH /chat/conversations/:id/seen
  // ─────────────────────────────────────────────────────────────────────────

  describe('PATCH /chat/conversations/:id/seen', () => {
    it('marks all received messages as seen and resets unread count', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      const msgRes = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ recipientId: bob.id, content: 'Hey' })
        .expect(201);

      const conversationId = msgRes.body.conversationId as string;

      await request(app.getHttpServer())
        .post(`/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ content: 'You there?' })
        .expect(201);

      const beforeSeen = await request(app.getHttpServer())
        .get('/chat/conversations')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      expect(beforeSeen.body.items[0].unreadCount).toBe(2);

      await request(app.getHttpServer())
        .patch(`/chat/conversations/${conversationId}/seen`)
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      const afterSeen = await request(app.getHttpServer())
        .get('/chat/conversations')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      expect(afterSeen.body.items[0].unreadCount).toBe(0);
    });

    it('is idempotent — calling seen twice does not error', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      const msgRes = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ recipientId: bob.id, content: 'Hi' })
        .expect(201);

      const conversationId = msgRes.body.conversationId as string;

      await request(app.getHttpServer())
        .patch(`/chat/conversations/${conversationId}/seen`)
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/chat/conversations/${conversationId}/seen`)
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);
    });

    it('returns 403 when non-participant calls seen', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      const msgRes = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ recipientId: bob.id, content: 'Hi' })
        .expect(201);

      const conversationId = msgRes.body.conversationId as string;

      const charlie = await createAndLoginUser(
        app,
        dataSource,
        'charlie@example.com',
      );

      await request(app.getHttpServer())
        .patch(`/chat/conversations/${conversationId}/seen`)
        .set('Authorization', `Bearer ${charlie.token}`)
        .expect(403);
    });

    it('returns 404 for non-existent conversation', async () => {
      const token = await loginUser(
        app,
        testAccount.email,
        testAccount.password,
      );

      await request(app.getHttpServer())
        .patch('/chat/conversations/00000000-0000-0000-0000-000000000000/seen')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('does not mark own sent messages as seen', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      const msgRes = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ recipientId: bob.id, content: 'Hi' })
        .expect(201);

      const conversationId = msgRes.body.conversationId as string;

      // Alice marks as seen — she sent the message, nothing to mark for her
      await request(app.getHttpServer())
        .patch(`/chat/conversations/${conversationId}/seen`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      // Bob's unread count should still be 1
      const bobConvs = await request(app.getHttpServer())
        .get('/chat/conversations')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      expect(bobConvs.body.items[0].unreadCount).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Full conversation flow
  // ─────────────────────────────────────────────────────────────────────────

  describe('Full conversation flow', () => {
    it('Alice and Bob exchange messages, Bob reads them', async () => {
      const alice = await createAndLoginUser(
        app,
        dataSource,
        'alice@example.com',
      );
      const bob = await createAndLoginUser(app, dataSource, 'bob@example.com');

      // Step 1: Alice sends first message (creates conversation)
      const firstMsg = await request(app.getHttpServer())
        .post('/chat/messages')
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ recipientId: bob.id, content: 'Hey Bob!' })
        .expect(201);

      const conversationId = firstMsg.body.conversationId as string;

      // Step 2: Bob replies
      await request(app.getHttpServer())
        .post(`/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${bob.token}`)
        .send({ content: 'Hey Alice!' })
        .expect(201);

      // Step 3: Alice sends another
      await request(app.getHttpServer())
        .post(`/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${alice.token}`)
        .send({ content: 'How are you?' })
        .expect(201);

      // Step 4: Bob has 2 unread (Alice's 2), Alice has 1 unread (Bob's reply)
      const bobConvs = await request(app.getHttpServer())
        .get('/chat/conversations')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);
      expect(bobConvs.body.items[0].unreadCount).toBe(2);

      const aliceConvs = await request(app.getHttpServer())
        .get('/chat/conversations')
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);
      expect(aliceConvs.body.items[0].unreadCount).toBe(1);

      // Step 5: Bob marks conversation as seen
      await request(app.getHttpServer())
        .patch(`/chat/conversations/${conversationId}/seen`)
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);

      // Step 6: Bob's unread count drops to 0
      const bobAfter = await request(app.getHttpServer())
        .get('/chat/conversations')
        .set('Authorization', `Bearer ${bob.token}`)
        .expect(200);
      expect(bobAfter.body.items[0].unreadCount).toBe(0);

      // Step 7: Message history is correct (3 messages, newest first)
      const history = await request(app.getHttpServer())
        .get(`/chat/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${alice.token}`)
        .expect(200);

      expect(history.body.items).toHaveLength(3);
      expect(history.body.items[0].content).toBe('How are you?');
      expect(history.body.items[1].content).toBe('Hey Alice!');
      expect(history.body.items[2].content).toBe('Hey Bob!');
    });
  });
});
