# E2E Testing — Social-Media-Service

Reference for writing Jest-based e2e tests against real HTTP endpoints and a real PostgreSQL database.

---

## Setup

```bash
docker-compose up -d          # Start PostgreSQL first
npm run test:e2e              # Run all e2e tests
npx jest --config ./jest-e2e.json --runInBand "test/my-module"
```

**Always use `--runInBand`** — tests share DB state and must not run in parallel.

---

## File Location

```
test/<module>/<module>.e2e-spec.ts
```

Read `test/brand/brand.e2e-spec.ts` before writing new specs to match setup style.

---

## App Bootstrap Template

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('MyModule (e2e)', () => {
  let app: INestApplication;
  let userToken: string;
  let brandToken: string;
  let createdResourceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule], // full app — not a partial module
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    // Register + login user
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'e2e-user@example.com', password: 'Password123!', role: 'USER' });
    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e-user@example.com', password: 'Password123!' });
    userToken = userLogin.body.accessToken;

    // Register + login brand
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'e2e-brand@example.com', password: 'Password123!', role: 'BRAND' });
    const brandLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'e2e-brand@example.com', password: 'Password123!' });
    brandToken = brandLogin.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });
```

---

## Required Scenarios per Endpoint

### POST (create)

```typescript
it('should return 201 and create resource', async () => {
  const res = await request(app.getHttpServer())
    .post('/my-resource')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ field: 'value' })
    .expect(201);
  expect(res.body.id).toBeDefined();
  expect(res.body.field).toBe('value');
  createdResourceId = res.body.id;
});
it('should return 401 when not authenticated', async () => {
  await request(app.getHttpServer()).post('/my-resource').send({ field: 'value' }).expect(401);
});
it('should return 403 when wrong role', async () => {
  await request(app.getHttpServer())
    .post('/my-resource').set('Authorization', `Bearer ${brandToken}`).send({ field: 'value' }).expect(403);
});
it('should return 400 when required fields missing', async () => {
  await request(app.getHttpServer())
    .post('/my-resource').set('Authorization', `Bearer ${userToken}`).send({}).expect(400);
});
```

### GET list

```typescript
it('should return paginated list', async () => {
  const res = await request(app.getHttpServer())
    .get('/my-resource').set('Authorization', `Bearer ${userToken}`).expect(200);
  expect(res.body.data).toBeInstanceOf(Array);
  expect(res.body.total).toBeGreaterThanOrEqual(0);
  expect(res.body.page).toBe(1);
  expect(res.body.limit).toBeDefined();
});
```

### GET single

```typescript
it('should return 200 for existing resource', async () => {
  const res = await request(app.getHttpServer())
    .get(`/my-resource/${createdResourceId}`).set('Authorization', `Bearer ${userToken}`).expect(200);
  expect(res.body.id).toBe(createdResourceId);
});
it('should return 404 for non-existent resource', async () => {
  await request(app.getHttpServer())
    .get('/my-resource/00000000-0000-0000-0000-000000000000')
    .set('Authorization', `Bearer ${userToken}`).expect(404);
});
```

### PATCH (update)

```typescript
it('should update as owner', async () => {
  const res = await request(app.getHttpServer())
    .patch(`/my-resource/${createdResourceId}`)
    .set('Authorization', `Bearer ${userToken}`)
    .send({ field: 'updated' }).expect(200);
  expect(res.body.field).toBe('updated');
});
it('should return 403 when not owner', async () => {
  await request(app.getHttpServer())
    .patch(`/my-resource/${createdResourceId}`)
    .set('Authorization', `Bearer ${otherUserToken}`)
    .send({ field: 'hacked' }).expect(403);
});
```

### DELETE

```typescript
it('should delete as owner', async () => {
  await request(app.getHttpServer())
    .delete(`/my-resource/${createdResourceId}`)
    .set('Authorization', `Bearer ${userToken}`).expect(200);
});
```

### Conflict (409)

```typescript
it('should return 409 on duplicate', async () => {
  await request(app.getHttpServer())
    .post('/follow').set('Authorization', `Bearer ${userToken}`).send({ followingId: targetId }).expect(201);
  await request(app.getHttpServer())
    .post('/follow').set('Authorization', `Bearer ${userToken}`).send({ followingId: targetId }).expect(409);
});
```

---

## Assertion Rules

- Always assert on HTTP status code
- Assert presence of key fields (`id`, `authorId`, `createdAt`) — not exact values
- For paginated: assert `data` is array, `total` is number, `page` and `limit` present
- **Never assert on exact UUIDs or timestamps** — they change per test run

---

## Run Commands

```bash
npx jest --config ./jest-e2e.json --runInBand "test/my-module"
npm run test:e2e
npx jest --config ./jest-e2e.json --runInBand --verbose "test/my-module"
```
