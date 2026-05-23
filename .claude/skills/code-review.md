# Code Review — Social-Media-Service

Reference for general code quality standards and the review process in this project.

---

## Review Severity Levels

| Level | Meaning | Action |
|-------|---------|--------|
| CRITICAL | Security hole, data loss, broken auth | **BLOCK** — must fix before merge |
| HIGH | Bug, wrong behaviour, missing transaction | **WARN** — should fix before merge |
| MEDIUM | Code smell, missing type, maintainability | **INFO** — fix when possible |
| LOW | Style, naming, minor suggestion | **NOTE** — optional |

Finish every review with: **APPROVED**, **APPROVED WITH NOTES**, or **BLOCKED**.

---

## Code Quality Checklist

### Functions and Files
- [ ] Functions under 50 lines — split if longer
- [ ] Files under 800 lines — extract modules if larger
- [ ] No deep nesting (>4 levels) — use early returns
- [ ] No commented-out code
- [ ] No `console.log` — use `this.logger`
- [ ] Magic numbers extracted into named constants

### Naming
- [ ] Variables and functions: `camelCase`
- [ ] Classes, DTOs, interfaces: `PascalCase`
- [ ] Enum values: `UPPER_SNAKE_CASE`
- [ ] Booleans: `is`, `has`, `should`, `can` prefix
- [ ] Files: `kebab-case.ts`

### Immutability
- [ ] No in-place object or array mutation
- [ ] `const` used for values that do not change
- [ ] Counter updates atomic — never read-modify-write

### Error Handling
- [ ] All DB operations have error handling
- [ ] No silent swallowing of errors — log or rethrow
- [ ] Event handler errors caught, logged, NOT re-thrown
- [ ] Service errors thrown as NestJS HTTP exceptions
- [ ] No raw DB errors or stack traces to client

---

## NestJS-Specific Checks

- [ ] Controller has no business logic — delegates to service
- [ ] Service has no HTTP-specific code
- [ ] Repository has no business logic — data access only
- [ ] Module registers all providers — nothing injected outside providers list
- [ ] `@Expose()` on all response DTO fields — no sensitive fields
- [ ] `{ async: true }` on all `@OnEvent` handlers
- [ ] Events emitted after successful DB write, never before

---

## Performance Quick Checks

- [ ] List queries always have explicit `ORDER BY`
- [ ] List queries use `skip`/`take` — no unbounded fetches
- [ ] No N+1 — related data fetched via JOIN or batch query, not in a loop
- [ ] Bulk inserts chunked at 500 rows max
- [ ] Hard limit enforced (max 50 per page)

---

## Security Quick Checks

- [ ] No hardcoded secrets
- [ ] No string interpolation in DB queries
- [ ] Ownership checked before any mutation
- [ ] `@Public()` only on genuinely public endpoints
- [ ] File uploads validated for type and size

---

## Output Format

Group findings by file:

```
**Severity**: HIGH
**File**: src/modules/story/services/story.service.ts
**Line**: 42
**Issue**: Counter updated with read-modify-write instead of atomic increment
**Fix**: Replace `entity.count++; repo.save(entity)` with `repo.increment({ id }, 'count', 1)`
```

---

## Pre-Merge Checklist

- [ ] `npm test` passes with ≥ 80% coverage on changed service files
- [ ] `npm run build` succeeds with zero errors
- [ ] `npm run lint` is clean
- [ ] E2E tests pass for changed endpoints: `npm run test:e2e`
- [ ] No `.env` or secret files staged
- [ ] Branch rebased on latest `main`
- [ ] No CRITICAL or HIGH issues open

---

## Common Anti-Patterns

| Anti-pattern | Correct |
|-------------|---------|
| Business logic in controller | Move to service |
| Raw entity returned from controller | `plainToInstance(ResponseDto, entity)` |
| Read-modify-write counter | `repo.increment(...)` |
| Multi-table write without transaction | Wrap in `dataSource.transaction()` |
| Event emitted before DB write | Emit after `await repo.save(...)` |
| `@OnEvent` without `{ async: true }` | Add `{ async: true }` |
| Error re-thrown from event handler | Log and swallow |
| Raw TypeORM error to client | Catch and throw `ConflictException` etc. |
