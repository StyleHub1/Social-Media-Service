# NestJS Rules

## Module Structure

Every domain module lives under `src/modules/<name>/` and contains:

```
<name>/
├── <name>.module.ts
├── <name>.controller.ts
├── dto/
├── entities/
├── enums/
├── repositories/
├── services/
└── tests/          # unit tests only; e2e go under /test/<name>/
```

Do not create flat service files at the module root — always use the `services/` subdirectory.

## Guards & Auth

- Global guards applied in order: `ATGuard` → `RolesGuard` → `ThrottlerGuard`
- Use `@Public()` to opt out of JWT auth — never disable the guard globally
- Use `@Roles(Role.USER)` or `@Roles(Role.BRAND)` to restrict by role
- Use `@CurrentUser()` decorator to extract the JWT payload in controllers

## Rate Limiting

- Default global throttle: 60 req/min (via `ThrottlerGuard`)
- Notification endpoints: 30 req/min
- Chat send endpoints: 20 req/min
- Override per-controller or per-method with `@Throttle({ default: { limit, ttl } })`

## Event Emitter

- Emit domain events via `@nestjs/event-emitter` after DB writes, not before
- All event listener handlers must use `{ async: true }` — errors caught and logged, never re-thrown
- Event naming convention: `<domain>.<action>` (e.g. `post.created`, `follow.followed`)

## Dependency Injection

- Use constructor injection only — no property injection
- Keep services focused; avoid injecting more than 4–5 dependencies
- Repositories are injected into services, never directly into controllers

## Response Shape

All paginated responses use `PaginationResponse<T>` from `src/modules/common/pagination/`.
All single-resource responses return the entity DTO directly (no extra envelope).

## File Naming

- Entities: `<name>.entity.ts`
- DTOs: `<action>-<name>.dto.ts` (e.g. `create-post.dto.ts`, `feed-response.dto.ts`)
- Enums: `<name>.enum.ts`
- Repositories: `<name>.repository.ts`
- Services: `<name>.service.ts`
- Events: `<name>-<action>.event.ts` (e.g. `post-created.event.ts`)
