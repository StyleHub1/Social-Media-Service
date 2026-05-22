# API Conventions

## REST Conventions

- Controllers handle HTTP only — no business logic, no DB calls
- Services own all business logic and error throwing
- Use standard HTTP verbs: GET (read), POST (create), PATCH (partial update), DELETE (remove)
- Return 201 for POST that creates a resource, 200 for everything else
- Use `NotFoundException` (404), `ConflictException` (409), `ForbiddenException` (403), `BadRequestException` (400) from `@nestjs/common`

## DTOs

- All incoming request bodies must have a DTO with `class-validator` decorators
- All outgoing responses must have a response DTO — never return raw entities
- Use `@Expose()` + `plainToInstance` with `excludeExtraneousValues: true` to strip DB internals

## Pagination

Use the shared `PaginationParams` for all list endpoints:

```
GET /resource?page=1&limit=20
```

Response envelope:
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

Always apply a hard max limit (e.g. 50) — never allow unbounded queries.

## Cursor Pagination

Chat message history uses cursor-based pagination (`createdAt DESC, id DESC`). Do not switch chat endpoints to offset pagination.

## Auth Roles

| Role | Access |
|------|--------|
| `USER` | Social features (follow, feed, posts, interactions, chat, notifications) |
| `BRAND` | Own posts and profile; interactions on own posts only |
| `ADMIN` | Not yet implemented |

Brand restrictions enforced in service layer via `assertCanInteract()`.

## Error Handling

- Throw NestJS HTTP exceptions from services — never return error objects
- Never expose raw DB errors to the client (no stack traces, no SQL)
- Use consistent error messages: `"Resource not found"`, `"Already exists"`, etc.

## Public Endpoints

Decorate with `@Public()`:
- `POST /auth/*` (except logout)
- `GET /auth/verify-email`
- `GET /posts` (public post list)
- `GET /brand` (public brand list)
