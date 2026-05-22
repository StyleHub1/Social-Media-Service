# TypeORM Rules

## Migrations (CRITICAL)

- `synchronize` is ALWAYS disabled — never enable it in any environment
- Every schema change requires a new migration file
- Generate migrations: `npm run migration:generate`
- Apply migrations: `npm run migration:run`
- Migration files live in `src/database/migrations/` and are numbered sequentially (e.g. `014-...`)
- Never edit an existing migration that has been applied — create a new one to reverse or alter

## Repository Pattern

- All DB access goes through a custom repository class under `repositories/`
- Repositories extend the TypeORM `Repository<Entity>` or use `DataSource`
- Business logic never calls `EntityManager` or `DataSource` directly from services — go through the repository layer
- Exception: multi-table transactions that must be atomic use `DataSource.transaction()` injected into the service

## Transactions

Use `DataSource` transactions for any operation that touches multiple tables atomically:

```typescript
await this.dataSource.transaction(async (manager) => {
  await manager.save(Entity, data);
  await manager.update(OtherEntity, id, { count: () => 'count + 1' });
});
```

Always used for:
- follow/unfollow (updates `follows` + `base_users` counters)
- react/unreact (updates `likes` + `posts.reactionsCount`)
- add/delete comment (updates `comments` + `posts.commentsCount`)

## Soft Delete

Use `@DeleteDateColumn() deletedAt` for posts and comments. Always query with `withDeleted: false` (the default) unless explicitly needed.

## Entities

- Always define explicit column types (`@Column({ type: 'varchar', length: 255 })`)
- Use `@Index` decorators on columns used in WHERE clauses or ORDER BY
- Counters (`followersCount`, `reactionsCount`, etc.) are updated atomically via `() => 'count + 1'` expressions — never read-modify-write

## Idempotent Inserts

For bulk inserts (e.g. feed fan-out), use `ON CONFLICT DO NOTHING`:

```typescript
await this.dataSource
  .createQueryBuilder()
  .insert()
  .into(FeedItem)
  .values(rows)
  .orIgnore()
  .execute();
```

## Raw Queries

Prefer QueryBuilder over raw SQL. Use raw SQL only when QueryBuilder cannot express the query efficiently. Always use parameterized values — never string interpolation.
