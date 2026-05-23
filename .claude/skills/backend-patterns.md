# Backend Patterns — Social-Media-Service

Reference for service layer design, repository pattern, error handling, transactions, and bulk operations in this project.

---

## Layered Architecture

```
Controller  →  Service  →  Repository  →  Database
   (HTTP)     (Logic)       (Data)
```

- Controllers: HTTP only — parse request, call service, return response
- Services: all business logic, validation, event emission, error throwing
- Repositories: all DB access — no business logic allowed
- Never skip layers: controller must not call repository directly

---

## Repository Pattern

```typescript
@Injectable()
export class MyRepository {
  constructor(
    @InjectRepository(MyEntity)
    private readonly repo: Repository<MyEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findById(id: string): Promise<MyEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findAll(skip: number, take: number): Promise<[MyEntity[], number]> {
    return this.repo.findAndCount({
      skip,
      take,
      order: { createdAt: 'DESC' }, // always explicit ORDER BY
    });
  }

  async create(data: Partial<MyEntity>): Promise<MyEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async update(id: string, data: Partial<MyEntity>): Promise<MyEntity> {
    await this.repo.update(id, data);
    return this.findById(id);
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  // Atomic counter — NEVER read-modify-write
  async incrementCount(id: string, field: string, amount = 1): Promise<void> {
    await this.repo.increment({ id }, field, amount);
  }

  // Bulk idempotent insert — chunks at 500 rows
  async bulkInsert(rows: Partial<MyEntity>[]): Promise<void> {
    if (!rows.length) return;
    const chunkSize = 500;
    for (let i = 0; i < rows.length; i += chunkSize) {
      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(MyEntity)
        .values(rows.slice(i, i + chunkSize))
        .orIgnore() // ON CONFLICT DO NOTHING
        .execute();
    }
  }
}
```

---

## Error Handling

Always throw NestJS HTTP exceptions from services. Never return error objects. Never let raw DB errors reach the client.

```typescript
if (!entity) throw new NotFoundException('Post not found');
if (existing) throw new ConflictException('Already following this user');
if (entity.authorId !== userId) throw new ForbiddenException('Not the owner');
if (!dto.content && !dto.imageIds?.length) throw new BadRequestException('Post must have content or images');
```

Catch DB errors and translate:

```typescript
try {
  await this.repo.save(entity);
} catch (err) {
  if (err.code === '23505') throw new ConflictException('Already exists');
  this.logger.error('Unexpected DB error', err.stack);
  throw new BadRequestException('Could not complete request');
}
```

---

## Transactions

Use `DataSource.transaction()` for any operation touching multiple tables atomically.

```typescript
// follow: update follows table + update counters on base_users
async follow(followerId: string, followingId: string): Promise<Follow> {
  return this.dataSource.transaction(async (manager) => {
    const follow = manager.create(Follow, { followerId, followingId });
    await manager.save(follow);
    await manager.increment(BaseUser, { id: followingId }, 'followersCount', 1);
    await manager.increment(BaseUser, { id: followerId }, 'followingCount', 1);
    return follow;
  });
}
```

Mandatory for: follow/unfollow, react/unreact, add/delete comment.

---

## Atomic Counter Updates

```typescript
// WRONG — race condition
const user = await this.repo.findOne(id);
user.followersCount++;
await this.repo.save(user);

// CORRECT
await this.repo.increment({ id }, 'followersCount', 1);

// Inside transaction
await manager.increment(BaseUser, { id }, 'followersCount', 1);

// QueryBuilder style
await this.repo
  .createQueryBuilder()
  .update()
  .set({ followersCount: () => '"followersCount" + 1' })
  .where('id = :id', { id })
  .execute();
```

---

## Ownership Check

```typescript
async update(id: string, userId: string, dto: UpdateDto): Promise<ResponseDto> {
  const entity = await this.repository.findById(id);
  if (!entity) throw new NotFoundException('Not found');
  if (entity.authorId !== userId) throw new ForbiddenException('Not the owner');
  // safe to proceed
}
```

---

## Pagination

```typescript
async findAll(query: PaginationParams): Promise<PaginationResponse<ResponseDto>> {
  const { page = 1, limit = 20 } = query;
  const take = Math.min(limit, 50); // enforce hard max
  const skip = (page - 1) * take;
  const [items, total] = await this.repository.findAll(skip, take);
  return {
    data: items.map(item => plainToInstance(ResponseDto, item, { excludeExtraneousValues: true })),
    total,
    page,
    limit: take,
  };
}
```

---

## Logging

Use NestJS `Logger` — never `console.log`.

```typescript
private readonly logger = new Logger(MyService.name);

this.logger.error('Failed to process event', err.stack);
this.logger.warn('Skipping self-interaction');
this.logger.log('Fan-out complete for post ' + postId);
```

---

## Fan-out (Feed Pattern)

```typescript
async fanOut(postId: string, authorId: string, followerIds: string[]): Promise<void> {
  const rows = followerIds.map(ownerId => ({ ownerId, postId, authorId }));
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(FeedItem)
      .values(rows.slice(i, i + chunkSize))
      .orIgnore() // UNIQUE(ownerId, postId) — idempotent
      .execute();
  }
}
```
