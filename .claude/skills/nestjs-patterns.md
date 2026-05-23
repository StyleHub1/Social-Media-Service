# NestJS Patterns — Social-Media-Service

Reference for NestJS module structure, providers, guards, decorators, and event emitter patterns used in this project.

---

## Module Structure

Every domain module lives under `src/modules/<name>/` and must follow this layout exactly:

```
<name>/
├── <name>.module.ts
├── <name>.controller.ts
├── services/
│   └── <name>.service.ts
├── repositories/
│   └── <name>.repository.ts
├── entities/
│   └── <name>.entity.ts
├── dto/
│   ├── create-<name>.dto.ts
│   ├── update-<name>.dto.ts       # optional, use PartialType
│   └── <name>-response.dto.ts
├── enums/
│   └── <name>.enum.ts             # if any
├── events/
│   └── <name>-<action>.event.ts   # if any
└── tests/
    └── <name>.service.spec.ts
```

E2E tests live outside: `test/<name>/<name>.e2e-spec.ts`

---

## Module File

```typescript
@Module({
  imports: [TypeOrmModule.forFeature([MyEntity])],
  controllers: [MyController],
  providers: [MyService, MyRepository],
  exports: [MyService], // only if other modules need it
})
export class MyModule {}
```

Register in `src/app.module.ts` imports array.

---

## Controller Patterns

Controllers are HTTP-only — no business logic, no DB calls.

```typescript
@Controller('resource')
export class MyController {
  constructor(private readonly myService: MyService) {}

  @Get()
  @Public()
  findAll(@Query() query: PaginationParams): Promise<PaginationResponse<MyResponseDto>> {
    return this.myService.findAll(query);
  }

  @Post()
  @Roles(Role.USER)
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateMyDto,
  ): Promise<MyResponseDto> {
    return this.myService.create(user.sub, dto);
  }

  @Post('send')
  @Roles(Role.USER, Role.BRAND)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  send(@CurrentUser() user: JwtPayload, @Body() dto: SendDto) {
    return this.myService.send(user.sub, dto);
  }

  @Get(':id')
  @Roles(Role.USER, Role.BRAND)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.myService.findOne(id, user.sub);
  }

  @Patch(':id')
  @Roles(Role.USER)
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateMyDto,
  ) {
    return this.myService.update(id, user.sub, dto);
  }

  @Delete(':id')
  @Roles(Role.USER)
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.myService.remove(id, user.sub);
  }
}
```

---

## Guards and Decorators

| Decorator | File | Purpose |
|-----------|------|---------|
| `@Public()` | `src/modules/common/decorators/public.decorator.ts` | Bypass JWT auth |
| `@Roles(Role.X)` | `src/modules/common/decorators/roles.decorator.ts` | Restrict by role |
| `@CurrentUser()` | `src/modules/common/decorators/current-user.decorator.ts` | Extract JWT payload |

Global guard order (applied in `AppModule`): `ATGuard` → `RolesGuard` → `ThrottlerGuard`

Default throttle: **60 req/min**. Override per-method with `@Throttle({ default: { limit, ttl } })`.

---

## Service Patterns

```typescript
@Injectable()
export class MyService {
  constructor(
    private readonly myRepository: MyRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(userId: string, dto: CreateMyDto): Promise<MyResponseDto> {
    const existing = await this.myRepository.findByField(dto.field);
    if (existing) throw new ConflictException('Already exists');

    const entity = await this.myRepository.create({ ...dto, authorId: userId });

    // Emit AFTER successful DB write
    this.eventEmitter.emit('my.created', new MyCreatedEvent(entity.id, userId));

    return plainToInstance(MyResponseDto, entity, { excludeExtraneousValues: true });
  }

  async findOne(id: string): Promise<MyResponseDto> {
    const entity = await this.myRepository.findById(id);
    if (!entity) throw new NotFoundException('Not found');
    return plainToInstance(MyResponseDto, entity, { excludeExtraneousValues: true });
  }

  async update(id: string, userId: string, dto: UpdateMyDto): Promise<MyResponseDto> {
    const entity = await this.myRepository.findById(id);
    if (!entity) throw new NotFoundException('Not found');
    if (entity.authorId !== userId) throw new ForbiddenException('Not the owner');

    const updated = await this.myRepository.update(id, dto);
    return plainToInstance(MyResponseDto, updated, { excludeExtraneousValues: true });
  }

  async remove(id: string, userId: string): Promise<void> {
    const entity = await this.myRepository.findById(id);
    if (!entity) throw new NotFoundException('Not found');
    if (entity.authorId !== userId) throw new ForbiddenException('Not the owner');
    await this.myRepository.softDelete(id);
    this.eventEmitter.emit('my.deleted', { id, authorId: userId });
  }
}
```

---

## Event Emitter Patterns

```typescript
// Emit after DB write — event naming: <domain>.<action>
this.eventEmitter.emit('post.created', new PostCreatedEvent(post.id, authorId, post.createdAt));

// Listen — ALWAYS { async: true }
@OnEvent('post.created', { async: true })
async handlePostCreated(event: PostCreatedEvent): Promise<void> {
  try {
    await this.doSomething(event);
  } catch (err) {
    this.logger.error('Failed to handle post.created', err.stack);
    // Never re-throw — swallow to protect the emitting request
  }
}
```

---

## Pagination

```typescript
// Controller
@Get()
findAll(@Query() query: PaginationParams): Promise<PaginationResponse<MyResponseDto>> {
  return this.myService.findAll(query);
}

// Service
async findAll(query: PaginationParams): Promise<PaginationResponse<MyResponseDto>> {
  const { page = 1, limit = 20 } = query;
  const take = Math.min(limit, 50); // hard cap
  const skip = (page - 1) * take;
  const [items, total] = await this.myRepository.findAndCount({ skip, take });
  return {
    data: items.map(i => plainToInstance(MyResponseDto, i, { excludeExtraneousValues: true })),
    total,
    page,
    limit: take,
  };
}
```

---

## Response DTO

```typescript
export class MyResponseDto {
  @Expose() id: string;
  @Expose() field: string;
  @Expose() authorId: string;
  @Expose() createdAt: Date;
  // Never expose: passwords, hashed tokens, deletedAt
}
```

Always return via `plainToInstance(MyResponseDto, entity, { excludeExtraneousValues: true })`.

---

## Input DTO

```typescript
export class CreateMyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  field: string;

  @IsOptional()
  @IsEnum(MyEnum)
  status?: MyEnum;
}
```

`ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` is applied globally.

---

## DataSource Transaction

```typescript
constructor(
  private readonly dataSource: DataSource,
) {}

async createWithCounter(dto: CreateDto): Promise<void> {
  await this.dataSource.transaction(async (manager) => {
    await manager.save(MyEntity, { ...dto });
    await manager.increment(OtherEntity, { id: dto.targetId }, 'count', 1);
  });
}
```
