# TDD Workflow — Social-Media-Service

Reference for unit test structure, mocking patterns, and coverage requirements in this project.

---

## Mandatory TDD Cycle

1. **RED** — Write a failing test for the behaviour
2. **GREEN** — Write the minimum implementation to pass
3. **IMPROVE** — Refactor without breaking tests
4. **VERIFY** — Run `npm test` and confirm ≥ 80% coverage on service files

Never write implementation code before the test exists.

---

## Unit Test File Location

```
src/modules/<name>/tests/<name>.service.spec.ts
src/modules/<name>/tests/<name>.listener.spec.ts   # if event listener exists
```

---

## Test Module Setup

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';

describe('MyService', () => {
  let service: MyService;
  let repository: jest.Mocked<MyRepository>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyService,
        {
          provide: MyRepository,
          useValue: {
            findById: jest.fn(),
            findAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: { transaction: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<MyService>(MyService);
    repository = module.get(MyRepository);
    eventEmitter = module.get(EventEmitter2);
  });
```

---

## AAA Pattern

```typescript
it('should create a resource and emit event', async () => {
  // Arrange
  const userId = 'user-id-123';
  const dto = { content: 'Hello' };
  const saved = { id: 'entity-id', authorId: userId, ...dto, createdAt: new Date() };
  repository.create.mockResolvedValue(saved);

  // Act
  const result = await service.create(userId, dto);

  // Assert
  expect(repository.create).toHaveBeenCalledWith({ ...dto, authorId: userId });
  expect(eventEmitter.emit).toHaveBeenCalledWith(
    'my.created',
    expect.objectContaining({ id: 'entity-id' }),
  );
  expect(result.id).toBe('entity-id');
});
```

---

## Required Test Cases per Service Method

### `create()`
- [ ] Success — creates entity, returns DTO, emits event
- [ ] Conflict — throws `ConflictException` when duplicate exists

### `findAll()`
- [ ] Returns paginated result (`data`, `total`, `page`, `limit`)
- [ ] Applies hard limit cap (max 50)
- [ ] Returns empty `data` when no results

### `findOne()`
- [ ] Success — returns DTO for existing resource
- [ ] Not found — throws `NotFoundException`

### `update()`
- [ ] Success — updates and returns updated DTO
- [ ] Not found — throws `NotFoundException`
- [ ] Forbidden — throws `ForbiddenException` when `userId !== entity.authorId`

### `remove()`
- [ ] Success — soft-deletes record, emits event
- [ ] Not found — throws `NotFoundException`
- [ ] Forbidden — throws `ForbiddenException` when not owner

---

## Exception Testing

```typescript
it('should throw NotFoundException when resource does not exist', async () => {
  repository.findById.mockResolvedValue(null);
  await expect(service.findOne('nonexistent-id')).rejects.toThrow(NotFoundException);
});

it('should throw ForbiddenException when user is not the owner', async () => {
  repository.findById.mockResolvedValue({ id: 'eid', authorId: 'other-user' } as any);
  await expect(service.update('eid', 'requesting-user', { content: 'new' })).rejects.toThrow(ForbiddenException);
});

it('should throw ConflictException on duplicate', async () => {
  repository.findByField.mockResolvedValue({ id: 'existing' } as any);
  await expect(service.create('user-id', { field: 'duplicate' })).rejects.toThrow(ConflictException);
});
```

---

## Mocking Transactions

```typescript
it('should execute in a transaction', async () => {
  const manager = {
    save: jest.fn().mockResolvedValue(savedEntity),
    increment: jest.fn().mockResolvedValue(undefined),
  };
  dataSource.transaction.mockImplementation(async (fn) => fn(manager));

  await service.follow('follower-id', 'following-id');

  expect(dataSource.transaction).toHaveBeenCalled();
  expect(manager.save).toHaveBeenCalled();
  expect(manager.increment).toHaveBeenCalledTimes(2);
});
```

---

## Event Listener Tests

```typescript
it('should handle event and not throw on error', async () => {
  service.processEvent = jest.fn().mockRejectedValue(new Error('DB error'));
  const loggerSpy = jest.spyOn(listener['logger'], 'error').mockImplementation();

  await listener.handleMyEvent({ id: 'event-id', authorId: 'author' });

  expect(loggerSpy).toHaveBeenCalled();
  // Must NOT throw — listener errors are swallowed
});
```

---

## Run Commands

```bash
npm test                                              # All unit tests
npm run test:cov                                      # With coverage report
npx jest src/modules/my/tests/my.service.spec.ts      # Single file
```

Coverage target: **≥ 80%** on service files. Migration files and `main.ts` excluded.

---

## Test Naming

```typescript
describe('MyService', () => {
  describe('create', () => {
    it('should create a resource successfully', () => {});
    it('should throw ConflictException when resource already exists', () => {});
  });
  describe('findOne', () => {
    it('should return the resource when it exists', () => {});
    it('should throw NotFoundException when resource does not exist', () => {});
  });
});
```

Format: `should <expected behaviour> when <condition>`.
