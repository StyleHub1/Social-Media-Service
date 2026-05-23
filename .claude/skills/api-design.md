# API Design — Social-Media-Service

Reference for REST conventions, endpoint design, response shapes, and pagination patterns in this project.

---

## REST Conventions

| Operation | Method | Status | Note |
|-----------|--------|--------|------|
| Create resource | POST | 201 | `@HttpCode(HttpStatus.CREATED)` |
| Get list | GET | 200 | Always paginated |
| Get single | GET | 200 | 404 if not found |
| Partial update | PATCH | 200 | Use `PartialType(CreateDto)` |
| Delete | DELETE | 200 | Never use PUT |

---

## URL Design

```
GET    /posts
POST   /posts
GET    /posts/:id
PATCH  /posts/:id
DELETE /posts/:id

# Actions (when verbs don't fit)
POST   /auth/login
POST   /auth/logout
POST   /auth/refresh
PATCH  /chat/conversations/:id/seen
```

Use kebab-case for multi-word paths: `/forgot-password`, `/complete-profile`.

---

## Auth Rules per Endpoint

| Decorator | When |
|-----------|------|
| `@Public()` | Genuinely unauthenticated: `GET /posts`, `POST /auth/login` |
| `@Roles(Role.USER)` | User-only: follow, feed |
| `@Roles(Role.BRAND)` | Brand-only: brand profile |
| `@Roles(Role.USER, Role.BRAND)` | Both: posts, notifications, chat |

---

## Response Shapes

### Single resource

```json
{ "id": "uuid", "field": "value", "authorId": "uuid", "createdAt": "2024-01-01T00:00:00.000Z" }
```

### Paginated list

```json
{ "data": [...], "total": 100, "page": 1, "limit": 20 }
```

No extra envelope — never wrap in `{ success: true, data: ... }`.

---

## Pagination

All list endpoints use `PaginationParams`:

```typescript
export class PaginationParams {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 20;
}
```

Always enforce `Math.min(limit, 50)` in the service. Never allow unbounded queries.

---

## Rate Limits

| Endpoint type | Limit | Decorator |
|--------------|-------|-----------|
| Global default | 60 req/min | None needed |
| Notification endpoints | 30 req/min | `@Throttle({ default: { limit: 30, ttl: 60000 } })` |
| Chat send endpoints | 20 req/min | `@Throttle({ default: { limit: 20, ttl: 60000 } })` |

---

## DTO Design

### Input DTO

```typescript
export class CreatePostDto {
  @IsString() @IsOptional() @MaxLength(2000)
  content?: string;

  @IsEnum(PostVisibility) @IsOptional()
  visibility?: PostVisibility = PostVisibility.PUBLIC;

  @IsArray() @IsOptional() @IsString({ each: true })
  imageIds?: string[];
}
```

### Update DTO

```typescript
export class UpdatePostDto extends PartialType(CreatePostDto) {}
```

### Response DTO

```typescript
export class PostResponseDto {
  @Expose() id: string;
  @Expose() content: string;
  @Expose() authorId: string;
  @Expose() authorType: 'USER' | 'BRAND';
  @Expose() visibility: PostVisibility;
  @Expose() reactionsCount: number;
  @Expose() createdAt: Date;
  // NOT exposed: deletedAt, raw DB fields
}
```

---

## HTTP Error Codes

| Situation | Code | NestJS Exception |
|-----------|------|-----------------|
| Resource not found | 404 | `NotFoundException` |
| Duplicate / conflict | 409 | `ConflictException` |
| Not the owner | 403 | `ForbiddenException` |
| Invalid input | 400 | `BadRequestException` |
| Not authenticated | 401 | `UnauthorizedException` |

Always throw from services — never return error objects.

---

## Public Endpoints in This Project

| Endpoint | Reason |
|----------|--------|
| `POST /auth/register` | Registration |
| `POST /auth/login` | Login |
| `GET /auth/verify-email` | Email link |
| `POST /auth/forgot-password` | Password reset request |
| `POST /auth/reset-password` | Password reset |
| `POST /auth/refresh` | Token rotation (RTGuard) |
| `GET /posts` | Public post list |
| `GET /brand` | Public brand list |

---

## File Upload Endpoints

```typescript
@Post('profile/image')
@Roles(Role.USER)
@UseInterceptors(FileInterceptor('image'))
uploadImage(
  @CurrentUser() user: JwtPayload,
  @UploadedFile(
    new ParseFilePipe({
      validators: [
        new MaxFileSizeValidator({ maxSize: 4 * 1024 * 1024 }), // 4 MB
        new FileTypeValidator({ fileType: /^image\/(jpeg|jpg|png|webp)$/ }),
      ],
    }),
  )
  file: Express.Multer.File,
) {
  return this.userService.uploadAvatar(user.sub, file);
}
```

Allowed: `jpg`, `jpeg`, `png`, `webp`. Max: 4 MB. All uploads go through Cloudinary.
