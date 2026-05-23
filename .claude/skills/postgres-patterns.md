# PostgreSQL Patterns — Social-Media-Service

Reference for query optimization, index design, constraint patterns, and QueryBuilder usage in this project.

---

## Index Cheat Sheet

| Query Pattern | Index Type | SQL |
|---------------|-----------|-----|
| `WHERE col = val` | B-tree | `CREATE INDEX idx ON t (col)` |
| `ORDER BY col DESC` | B-tree desc | `CREATE INDEX idx ON t (col DESC)` |
| `WHERE a = x ORDER BY b DESC` | Composite | `CREATE INDEX idx ON t (a, b DESC)` |
| `WHERE isRead = false` | Partial | `CREATE INDEX idx ON t (col) WHERE "isRead" = false` |
| `WHERE deletedAt IS NULL` | Partial | `CREATE INDEX idx ON t (col) WHERE "deletedAt" IS NULL` |
| `WHERE status != 'SEEN'` | Partial | `CREATE INDEX idx ON t (col) WHERE status != 'SEEN'` |
| Cursor pagination | Composite | `CREATE INDEX idx ON t ("createdAt" DESC, id DESC)` |

---

## Existing Indexes in This Project

| Table | Index | Used For |
|-------|-------|---------|
| `feed_items` | `(ownerId, createdAt DESC)` | Feed read path |
| `feed_items` | `(ownerId, authorId)` | Unfollow cleanup |
| `notifications` | `(recipientId, createdAt DESC)` | Notification list |
| `notifications` | `(recipientId, isRead) WHERE isRead = false` | Unread count |
| `chat_messages` | `(conversationId, createdAt DESC, id DESC)` | Cursor pagination |
| `chat_messages` | `(conversationId) WHERE status != 'SEEN'` | Unread count |

---

## Unique Constraints

| Table | Constraint | Purpose |
|-------|-----------|---------|
| `follows` | `UNIQUE(followerId, followingId)` | No duplicate follows |
| `likes` | `UNIQUE(userId, postId)` | No duplicate reactions |
| `feed_items` | `UNIQUE(ownerId, postId)` | Idempotent fan-out |
| `conversations` | `UNIQUE(participantA, participantB)` + `CHECK(participantA < participantB)` | No duplicate conversations |

---

## QueryBuilder Patterns

### Paginated list with filter

```typescript
const [items, total] = await this.dataSource
  .getRepository(MyEntity)
  .createQueryBuilder('item')
  .where('item.authorId = :authorId', { authorId })
  .andWhere('item.deletedAt IS NULL')
  .orderBy('item.createdAt', 'DESC')
  .skip(skip)
  .take(take)
  .getManyAndCount();
```

### Cursor-based pagination

```typescript
const messages = await this.dataSource
  .getRepository(ChatMessage)
  .createQueryBuilder('msg')
  .where('msg.conversationId = :conversationId', { conversationId })
  .andWhere(
    cursor ? `(msg.createdAt, msg.id) < (:cursorDate, :cursorId)` : '1=1',
    cursor ? { cursorDate: cursor.createdAt, cursorId: cursor.id } : {},
  )
  .orderBy('msg.createdAt', 'DESC')
  .addOrderBy('msg.id', 'DESC')
  .take(limit)
  .getMany();
```

### Atomic counter update

```typescript
await this.dataSource
  .getRepository(Post)
  .createQueryBuilder()
  .update()
  .set({ reactionsCount: () => '"reactionsCount" + 1' })
  .where('id = :id', { id: postId })
  .execute();
```

### Bulk upsert — ON CONFLICT DO NOTHING

```typescript
await this.dataSource
  .createQueryBuilder()
  .insert()
  .into(FeedItem)
  .values(rows) // max 500 per call
  .orIgnore()
  .execute();
```

### Batch GROUP BY to avoid N+1

```typescript
// One query for all conversations instead of a loop
const counts = await this.dataSource
  .getRepository(ChatMessage)
  .createQueryBuilder('msg')
  .select('msg.conversationId', 'conversationId')
  .addSelect('COUNT(*)', 'unread')
  .where('msg.conversationId IN (:...ids)', { ids: conversationIds })
  .andWhere("msg.status != 'SEEN'")
  .groupBy('msg.conversationId')
  .getRawMany<{ conversationId: string; unread: string }>();
```

---

## Avoiding N+1

```typescript
// WRONG — N+1
const posts = await this.postRepo.findAll();
for (const post of posts) {
  post.author = await this.userRepo.findById(post.authorId);
}

// CORRECT — JOIN
const [posts, total] = await this.dataSource
  .getRepository(Post)
  .createQueryBuilder('post')
  .leftJoinAndSelect('post.author', 'author')
  .orderBy('post.createdAt', 'DESC')
  .skip(skip)
  .take(take)
  .getManyAndCount();
```

---

## Raw SQL (Use Sparingly)

Only when QueryBuilder cannot express the query. Always parameterized.

```typescript
// CORRECT — parameterized
const result = await this.dataSource.query(
  `SELECT * FROM "posts" WHERE "authorId" = $1 AND "deletedAt" IS NULL LIMIT $2`,
  [authorId, limit],
);

// WRONG — SQL injection risk
const result = await this.dataSource.query(
  `SELECT * FROM "posts" WHERE "authorId" = '${authorId}'`,
);
```

---

## Soft Delete Queries

TypeORM excludes soft-deleted rows by default on entities with `@DeleteDateColumn()`.

```typescript
// Excludes soft-deleted (default)
await this.repo.findOne({ where: { id } });

// Includes soft-deleted (only when explicitly needed)
await this.repo.findOne({ where: { id }, withDeleted: true });
```
