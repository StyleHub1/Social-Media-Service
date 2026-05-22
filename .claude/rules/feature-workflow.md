# Feature Development Workflow

This is the MANDATORY flow for every new feature in this project. Follow every step in order. Do not skip steps. Do not write code before planning.

---

## Step 1 — Plan First (ALWAYS)

**Agent:** `planner`
**Trigger:** Before touching any file

Invoke the planner agent with the feature description. It will:
- Read existing modules to understand the codebase
- Invoke `/nestjs-patterns`, `/api-design`, `/database-migrations`, `/security-review`
- Output: endpoints, files to create/modify, DB schema, events, migration number, risks
- Recommend which agents to run next

**Rules applied:** `nestjs.md`, `api-conventions.md`, `database.md`

Do not proceed to Step 2 until the plan is reviewed and agreed upon.

---

## Step 2 — Create the Git Branch

**Agent:** none — run manually
**Trigger:** After plan is approved, before writing any code

```bash
git checkout main
git pull origin main
git checkout -b feat/<feature-name>
```

Branch naming: `feat/story-module`, `fix/feed-author-type`, `refactor/chat-service`

**Rule applied:** `github.md` — always pull main first, use correct branch naming format

---

## Step 3 — Scaffold the Module

**Agent:** `nestjs-feature`
**Trigger:** After branch is created

Invoke the nestjs-feature agent with the planner output. It will:
- Read 2-3 existing modules (e.g. `src/modules/brand/`, `src/modules/posts/`) to match code style
- Invoke `/nestjs-patterns`, `/backend-patterns`, `/api-design`, `/tdd-workflow`, `/typescript-reviewer`
- Generate every file completely — no placeholders:
  - `<name>.module.ts`
  - `<name>.controller.ts`
  - `services/<name>.service.ts`
  - `repositories/<name>.repository.ts`
  - `entities/<name>.entity.ts`
  - `dto/create-<name>.dto.ts`
  - `dto/<name>-response.dto.ts`
  - `tests/<name>.service.spec.ts`

**Rules applied:** `nestjs.md`, `api-conventions.md`, `security.md`, `typeorm.md`

---

## Step 4 — Create the Migration

**Agent:** `migration-helper`
**Trigger:** After module is scaffolded, if a new entity or schema change is needed

Invoke the migration-helper agent. It will:
- Invoke `/database-migrations`, `/postgres-patterns`
- Check `src/database/migrations/` for the next number
- Generate the complete migration with `up()` and `down()`
- Include all required indexes and unique constraints

After reviewing the generated migration, apply it:
```bash
npm run migration:run
```

**Rules applied:** `typeorm.md`, `database.md`

---

## Step 5 — Review the Code

**Agent:** `nestjs-reviewer` then `api-reviewer`
**Trigger:** After all implementation files are written

First invoke `nestjs-reviewer`. It checks:
- Module and architecture correctness
- TypeScript type safety (no `any`, typed async returns)
- Service, repository, entity, DTO patterns
- Guards, auth, event handling, WebSocket patterns
- Invokes `/nestjs-patterns`, `/typescript-reviewer`, `/backend-patterns`, `/security-review`, `/code-review`

Then invoke `api-reviewer`. It checks:
- Controller layer (no business logic, correct decorators)
- DTO validation and response shape
- Pagination, error handling, rate limiting
- Invokes `/nestjs-patterns`, `/typescript-reviewer`, `/security-review`, `/backend-patterns`, `/postgres-patterns`

Fix all CRITICAL and HIGH issues before moving to Step 6.

**Rules applied:** All rule files cross-checked

---

## Step 6 — Write E2E Tests

**Agent:** `e2e-writer`
**Trigger:** After code review passes (no CRITICAL or HIGH issues)

Invoke the e2e-writer agent. It will:
- Invoke `/e2e-testing`, `/tdd-workflow`
- Read `test/brand/brand.e2e-spec.ts` to match the existing setup style
- Generate a complete spec covering every endpoint:
  - Happy path (200/201)
  - Unauthenticated — 401
  - Wrong role — 403
  - Validation failure — 400
  - Not found — 404
  - Conflict/duplicate — 409

Run the tests before committing:
```bash
docker-compose up -d
npx jest --config ./jest-e2e.json --runInBand "test/<module>"
```

**Rule applied:** `testing.md` — real DB always, `--runInBand`, 80% coverage minimum

---

## Step 7 — Commit and Open PR

**Agent:** none — run manually
**Trigger:** After all tests pass

Pre-commit checklist:
- [ ] Unit tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Lint clean: `npm run lint`
- [ ] E2E tests pass: `npm run test:e2e`
- [ ] No `.env` or secret files staged
- [ ] Branch rebased on latest main: `git fetch origin && git rebase origin/main`

Commit:
```bash
git add src/modules/<name>/ src/database/migrations/<number>-...
git commit -m "feat(<name>): <short description>"
git push -u origin feat/<feature-name>
```

PR description must include:
- **What:** what changed
- **Why:** why this change was needed
- **How to test:** steps to verify manually or via tests

Merge strategy: Squash and Merge. Delete branch after merge.

**Rule applied:** `github.md`

---

## Full Flow at a Glance

```
planner
  └─► git checkout -b feat/<name>
        └─► nestjs-feature  (scaffold all files)
              └─► migration-helper  (DB schema + indexes)
                    └─► nestjs-reviewer  (code quality)
                          └─► api-reviewer  (API conventions)
                                └─► e2e-writer  (tests)
                                      └─► git commit + PR
```

## Rules Each Step Enforces

| Step | Rules Applied |
|------|---------------|
| Plan | `nestjs.md`, `api-conventions.md`, `database.md` |
| Branch | `github.md` |
| Scaffold | `nestjs.md`, `api-conventions.md`, `security.md`, `typeorm.md` |
| Migration | `typeorm.md`, `database.md` |
| Review | All rule files |
| E2E tests | `testing.md` |
| Commit + PR | `github.md` |

## Hard Rules — Never Break These

- Never write code before the planner produces and approves a plan
- Never commit directly to `main`
- Never skip the code review steps
- Never merge with failing tests
- Never enable `synchronize: true` in TypeORM config
- Never use `git add .` blindly — stage specific files only
- Never open a PR from a branch behind `main` — rebase first
