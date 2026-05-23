# TypeScript Reviewer — Social-Media-Service

Reference for TypeScript type safety, async correctness, and NestJS-specific idioms to check in this project.

---

## No `any`

```typescript
// WRONG
async findById(id: any): Promise<any> { ... }

// CORRECT
async findById(id: string): Promise<MyEntity | null> { ... }
```

---

## Typed Async Returns

```typescript
// WRONG
async create(dto: CreateMyDto) { ... }

// CORRECT
async create(dto: CreateMyDto): Promise<MyResponseDto> { ... }
```

---

## Entity Columns — Explicit Types

```typescript
// WRONG
@Column()
field: string;

// CORRECT
@Column({ type: 'varchar', length: 255 })
field: string;

@Column({ type: 'integer', default: 0 })
count: number;

@Column({ type: 'enum', enum: MyEnum, default: MyEnum.ACTIVE })
status: MyEnum;
```

---

## Missing Await

```typescript
// WRONG — fire and forget (unhandled rejection)
async doThing(): Promise<void> {
  this.repo.save(entity); // not awaited
}

// CORRECT
async doThing(): Promise<void> {
  await this.repo.save(entity);
}
```

---

## Unhandled Event Handler Errors

```typescript
// CORRECT — always try/catch in event handlers
@OnEvent('post.created', { async: true })
async handlePostCreated(event: PostCreatedEvent): Promise<void> {
  try {
    await this.service.fanOut(event.postId, event.authorId);
  } catch (err) {
    this.logger.error('Fan-out failed', err.stack);
    // Never re-throw
  }
}
```

---

## Use @CurrentUser() — Never Manual JWT Decode

```typescript
// WRONG
@Get()
getProfile(@Req() req) {
  const userId = req.user.sub; // untyped
}

// CORRECT
@Get()
getProfile(@CurrentUser() user: JwtPayload) {
  return this.service.getProfile(user.sub);
}
```

---

## Return ResponseDto — Never Raw Entity

```typescript
// WRONG
return entity;

// CORRECT
return plainToInstance(MyResponseDto, entity, { excludeExtraneousValues: true });

// For arrays
return items.map(item => plainToInstance(MyResponseDto, item, { excludeExtraneousValues: true }));
```

---

## Optional Chaining and Null Safety

```typescript
// WRONG
const name = user.profile.firstName;

// CORRECT
const name = user.profile?.firstName ?? 'Unknown';
```

---

## Response DTO — @Expose() on Every Field

```typescript
// WRONG — field silently excluded when excludeExtraneousValues: true
export class MyResponseDto {
  id: string;       // no @Expose
  field: string;    // no @Expose
}

// CORRECT
export class MyResponseDto {
  @Expose() id: string;
  @Expose() field: string;
  @Expose() createdAt: Date;
}
```

---

## class-validator — Every Input DTO Field Decorated

```typescript
export class CreateMyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsEnum(MyEnum)
  status: MyEnum;

  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(10)
  tagIds: string[];
}
```

---

## Typed Entity Relations

```typescript
// WRONG
@ManyToOne(() => BaseUser)
author: any;

// CORRECT
@ManyToOne(() => BaseUser, { nullable: false })
author: BaseUser;

@Column()
authorId: string; // always add explicit FK column
```

---

## Common Anti-Patterns

| Anti-pattern | Correct alternative |
|-------------|-------------------|
| `any` type | Explicit interface or generic |
| `console.log` | `this.logger.error/warn/log` |
| Magic number | Named constant |
| `req.user as any` | `@CurrentUser() user: JwtPayload` |
| Raw entity returned | `plainToInstance(ResponseDto, entity)` |
| `let` for values never reassigned | `const` |
| Non-null assertion `!` without guard | Optional chaining or explicit null check |
| Missing `{ async: true }` on `@OnEvent` | Add `{ async: true }` |
