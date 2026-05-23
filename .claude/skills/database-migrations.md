# Database Migrations — Social-Media-Service

Reference for TypeORM migration structure, naming, patterns, and constraints in this project.

---

## Critical Rules

- `synchronize` is **always `false`** — never enable it
- Never edit an already-applied migration — create a new one to reverse or alter
- Every schema change requires a new numbered migration
- Always implement both `up()` and `down()`
- Build before generating: `npm run migration:generate` runs `nest build` first

---

## Migration Numbering

Files live in `src/database/migrations/`. Format: `0NN-kebab-case-description.ts`

**Current highest: `013`. Next migration is `014`.**
Always read `src/database/migrations/` to confirm the number before writing.

---

## Migration Template

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateMyTable014 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum type first (if needed)
    await queryRunner.query(`
      CREATE TYPE "my_status_enum" AS ENUM ('ACTIVE', 'INACTIVE')
    `);

    await queryRunner.query(`
      CREATE TABLE "my_table" (
        "id"          uuid        NOT NULL DEFAULT gen_random_uuid(),
        "authorId"    uuid        NOT NULL,
        "content"     text        NOT NULL,
        "status"      "my_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "viewsCount"  integer     NOT NULL DEFAULT 0,
        "createdAt"   TIMESTAMP   NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP   NOT NULL DEFAULT now(),
        "deletedAt"   TIMESTAMP,
        CONSTRAINT "PK_my_table" PRIMARY KEY ("id"),
        CONSTRAINT "FK_my_table_author"
          FOREIGN KEY ("authorId") REFERENCES "base_users"("id") ON DELETE CASCADE
      )
    `);

    // Indexes — justify each one
    await queryRunner.query(`
      CREATE INDEX "IDX_my_table_author_created"
        ON "my_table" ("authorId", "createdAt" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_my_table_active"
        ON "my_table" ("authorId")
        WHERE "deletedAt" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "my_table"`);
    await queryRunner.query(`DROP TYPE "my_status_enum"`);
  }
}
```

---

## Adding a Unique Constraint

```typescript
// Prevent duplicate follows
await queryRunner.query(`
  ALTER TABLE "follows"
    ADD CONSTRAINT "UQ_follows_pair" UNIQUE ("followerId", "followingId")
`);

// Canonical participant ordering (conversations)
await queryRunner.query(`
  ALTER TABLE "conversations"
    ADD CONSTRAINT "UQ_conversations_participants" UNIQUE ("participantA", "participantB"),
    ADD CONSTRAINT "CHK_conversations_order" CHECK ("participantA" < "participantB")
`);

// Reverse in down():
await queryRunner.query(`ALTER TABLE "follows" DROP CONSTRAINT "UQ_follows_pair"`);
```

---

## Adding Columns to Existing Table

```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    ALTER TABLE "posts"
      ADD COLUMN "reactionsCount" integer NOT NULL DEFAULT 0,
      ADD COLUMN "commentsCount"  integer NOT NULL DEFAULT 0
  `);
  await queryRunner.query(`
    CREATE INDEX "IDX_posts_author_created" ON "posts" ("authorId", "createdAt" DESC)
  `);
}

public async down(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`DROP INDEX "IDX_posts_author_created"`);
  await queryRunner.query(`
    ALTER TABLE "posts" DROP COLUMN "reactionsCount", DROP COLUMN "commentsCount"
  `);
}
```

---

## Index Patterns for This Project

| Query Pattern | Index |
|---------------|-------|
| Paginated list by owner, newest first | `(ownerId, createdAt DESC)` |
| FK join lookup | `(authorId)` |
| Unread count (partial) | `(recipientId, isRead) WHERE isRead = false` |
| Cursor pagination | `(conversationId, createdAt DESC, id DESC)` |
| Unread messages (partial) | `(conversationId) WHERE status != 'SEEN'` |
| Idempotent upsert | Unique constraint: `UNIQUE(ownerId, postId)` |

---

## Soft Delete Column

```typescript
await queryRunner.query(`ALTER TABLE "posts" ADD COLUMN "deletedAt" TIMESTAMP`);
```

TypeORM excludes soft-deleted rows by default when `@DeleteDateColumn()` is used.

---

## Enum Types

```typescript
// Create type before table in up()
await queryRunner.query(`
  CREATE TYPE "notification_type_enum" AS ENUM ('NEW_FOLLOWER', 'POST_LIKED', 'POST_COMMENTED')
`);

// Drop in reverse order in down()
await queryRunner.query(`DROP TABLE "notifications"`);
await queryRunner.query(`DROP TYPE "notification_type_enum"`);
```

---

## Commands

```bash
npm run migration:run      # Build + apply pending migrations
npm run migration:revert   # Revert last applied migration
npm run migration:generate # Build + generate from entity diff (review output before using)
```

---

## Existing Migrations Reference

| # | Description |
|---|-------------|
| 001 | `base_users` — auth identity |
| 002 | `user_profiles` one-to-one |
| 003 | `brand_profiles` one-to-one |
| 004 | `refresh_tokens` |
| 005 | `reset_tokens` |
| 006 | `posts` with visibility enum |
| 007 | `follows` with UNIQUE constraint |
| 008 | reactionsCount, commentsCount on posts |
| 009 | `comments` with soft delete |
| 010 | `likes` UNIQUE(userId, postId) |
| 011 | `feed_items` UNIQUE(ownerId, postId) |
| 012 | `notifications` with partial unread index |
| 013 | `conversations` + `chat_messages` |
