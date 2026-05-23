# Security Review — Social-Media-Service

Reference for auth enforcement, input validation, injection prevention, and secret management in this project.

---

## Security Checklist (Before Every Commit)

- [ ] No hardcoded secrets (API keys, passwords, tokens) in any source file
- [ ] All user inputs go through class-validator DTOs
- [ ] No string interpolation in DB queries — always parameterized
- [ ] No raw DB errors or stack traces exposed to client
- [ ] All mutation endpoints enforce ownership before modifying
- [ ] `@Public()` used only on endpoints that genuinely need no auth
- [ ] File uploads validate type and size before Cloudinary upload
- [ ] Rate limiting applied on write and sensitive read endpoints
- [ ] Error messages contain no internal details (SQL, file paths, stack traces)

---

## Authentication

### JWT is global — @Public() opts out

```typescript
// All routes require auth by default (ATGuard is global)
// Use @Public() only for truly public endpoints

@Get()
@Public()
listPublicPosts(): Promise<PaginationResponse<PostResponseDto>> { ... }

// Authenticated route — no decorator needed
@Get('me')
@Roles(Role.USER)
getMyProfile(@CurrentUser() user: JwtPayload) { ... }
```

### Never manually decode JWT

```typescript
// WRONG — unverified decode
const token = req.headers.authorization.split(' ')[1];
const payload = jwt.decode(token);

// CORRECT — ATGuard verifies before controller runs
@CurrentUser() user: JwtPayload
```

---

## Authorization — Ownership

Always check in the service layer before any mutation:

```typescript
async update(id: string, userId: string, dto: UpdateDto): Promise<ResponseDto> {
  const entity = await this.repository.findById(id);
  if (!entity) throw new NotFoundException('Not found');
  if (entity.authorId !== userId) throw new ForbiddenException('Not the owner');
}
```

### Brand Interaction Restriction

```typescript
private assertCanInteract(post: Post, user: JwtPayload): void {
  if (user.role === Role.BRAND && post.authorId !== user.sub) {
    throw new ForbiddenException('Brands may only interact with their own posts');
  }
}
```

---

## Input Validation

`ValidationPipe` with `whitelist: true` + `forbidNonWhitelisted: true` strips unknown fields globally.

```typescript
// WRONG — raw user input in DB query
async search(query: string): Promise<Result[]> {
  return this.repo.query(`SELECT * FROM posts WHERE content LIKE '%${query}%'`);
}

// CORRECT — parameterized
async search(query: string): Promise<Result[]> {
  return this.repo
    .createQueryBuilder('post')
    .where('post.content ILIKE :query', { query: `%${query}%` })
    .getMany();
}
```

---

## File Upload Security

```typescript
@UploadedFile(
  new ParseFilePipe({
    validators: [
      new MaxFileSizeValidator({ maxSize: 4 * 1024 * 1024 }), // 4 MB
      new FileTypeValidator({ fileType: /^image\/(jpeg|jpg|png|webp)$/ }),
    ],
  }),
)
file: Express.Multer.File
```

Allowed: `jpg`, `jpeg`, `png`, `webp`. Max: 4 MB. Never store locally — always Cloudinary.

---

## WebSocket Security

```typescript
// CORRECT — JWT from auth object only
async handleConnection(client: Socket): Promise<void> {
  const token = client.handshake.auth?.token;
  if (!token) { client.disconnect(); return; }
  try {
    const payload = this.jwtService.verifyToken(token);
    client.join(payload.sub);
  } catch {
    client.disconnect(); // silent — no error broadcast
  }
}

// WRONG — query string token is logged in server access logs
const token = client.handshake.query.token;
```

CORS restricted to `ALLOWED_ORIGINS` env var — never `*` in production.

---

## Secret Management

Required env vars (validated at startup by Joi — app fails if missing):

```
JWT_TOKEN, JWT_EXPIRES_IN
JWT_REFRESH_TOKEN, JWT_REFRESH_EXPIRES_IN, REFRESH_TOKEN_HASH_SECRET
JWT_EMAIL_VERIFICATION_SECRET, JWT_EMAIL_VERIFICATION_EXPIRES_IN
BREVO_API_KEY, EMAIL_FROM, EMAIL_NAME
CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
RABBITMQ_URL, ALLOWED_ORIGINS
```

```typescript
// WRONG
const secret = 'my-super-secret-key';

// CORRECT
const secret = this.config.get('auth.jwtSecret');
```

---

## Rate Limiting

| Scope | Limit | Applied via |
|-------|-------|------------|
| Global default | 60 req/min | `ThrottlerGuard` in `AppModule` |
| Notifications | 30 req/min | `@Throttle({ default: { limit: 30, ttl: 60000 } })` |
| Chat send | 20 req/min | `@Throttle({ default: { limit: 20, ttl: 60000 } })` |

---

## Error Response Safety

```typescript
// WRONG — leaks SQL error to client
try {
  await this.repo.save(entity);
} catch (err) {
  throw err;
}

// CORRECT
try {
  await this.repo.save(entity);
} catch (err) {
  if (err.code === '23505') throw new ConflictException('Resource already exists');
  this.logger.error('Unexpected DB error', err.stack);
  throw new BadRequestException('Could not complete request');
}
```

Error messages must never include: stack traces, SQL, file paths, internal IDs.
