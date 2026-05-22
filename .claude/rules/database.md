# Database Rules

## Schema Changes (CRITICAL)

- `synchronize: false` always — never use TypeORM auto-sync
- All schema changes require a new numbered migration
- Migration numbering: `0<N>-<description>.ts` (e.g. `014-add-brand-category.ts`)
- Build before generating: `npm run migration:generate` (runs `nest build` first)
- Never rename or edit an applied migration — create a new one to reverse or alter

## Indexes

Always add indexes for:
- Foreign key columns used in JOINs
- Columns in WHERE clauses of frequently-called queries
- `(recipientId, createdAt DESC)` pattern for paginated feeds/notifications
- Partial indexes for unread counts: `WHERE isRead = false`, `WHERE status != 'SEEN'`

## Unique Constraints

Existing unique constraints — do not break these:
- `follows`: `UNIQUE(followerId, followingId)`
- `likes`: `UNIQUE(userId, postId)`
- `feed_items`: `UNIQUE(ownerId, postId)`
- `conversations`: `UNIQUE(participantA, participantB)` + `CHECK(participantA < participantB)`

When inserting into tables with unique constraints use `ON CONFLICT DO NOTHING` for idempotent bulk inserts.

## Soft Delete

Tables using soft delete (`deletedAt`): `posts`, `comments`.
Always query with default TypeORM behavior (excludes soft-deleted rows).
Use `withDeleted: true` only when explicitly required.

## Pagination Patterns

- Offset pagination: `page` + `limit` for most resources (max limit: 50)
- Cursor pagination: `(createdAt DESC, id DESC)` for `chat_messages` — do not change to offset
- Always apply `ORDER BY` on paginated queries — never rely on implicit ordering

## Connection

Local: `docker-compose up -d` starts `postgres:16` on port 5432, database `social_media_DB`, user/password `postgres`.
Production: uses `DATABASE_URL` (Heroku-style), SSL enabled automatically.

## Bulk Operations

Chunk bulk inserts at 500 rows maximum (applies to feed fan-out).
Use `orIgnore()` on QueryBuilder inserts for idempotent behavior.
