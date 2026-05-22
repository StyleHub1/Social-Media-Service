# Testing Rules

## Test Types

| Type | Location | Command |
|------|----------|---------|
| Unit | `src/modules/<name>/tests/` | `npm test` |
| E2E | `test/<name>/` | `npm run test:e2e` |

## Unit Tests

- Use Jest with NestJS testing utilities (`Test.createTestingModule`)
- Mock all external dependencies (repositories, services, event emitter)
- Focus on service layer logic — do not unit-test controllers
- File naming: `<name>.service.spec.ts`, `<name>.listener.spec.ts`

## E2E Tests

- Require a running PostgreSQL instance — start via `docker-compose up -d`
- Run single module: `npx jest --config ./jest-e2e.json --runInBand "test/<name>"`
- Use `--runInBand` always for e2e — tests share DB state and must not run in parallel
- Each e2e test file should set up its own test data and clean up after
- Test the full HTTP layer including auth headers and response shape

## What to Test

Unit:
- Service methods with all branches (success, not found, conflict, forbidden)
- Event listener handlers
- Utility functions / transformations

E2E:
- Happy path for each endpoint
- Auth enforcement (unauthenticated → 401, wrong role → 403)
- Validation errors (missing required fields → 400)
- Conflict cases (duplicate follow, duplicate reaction → 409)

## Coverage Target

80% minimum on service files. Do not count generated migration files or `main.ts` in coverage.

## Mocking

- Mock `DataSource` and `QueryRunner` for transaction-heavy services
- Use `jest.spyOn` over manual mocks where possible
- Never mock the DB in e2e tests — always use real PostgreSQL
