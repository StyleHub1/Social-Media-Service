# GitHub Workflow Rules

## Before Starting Any Work

1. Switch to `main` and pull latest:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Verify you are up to date before branching — never branch from a stale `main`

## Branch Naming

Format: `<type>/<short-description>`

| Type | When to Use |
|------|-------------|
| `feat/` | New feature or endpoint |
| `fix/` | Bug fix |
| `refactor/` | Code restructure, no behavior change |
| `test/` | Adding or fixing tests |
| `chore/` | Deps, config, tooling, CI |
| `docs/` | Documentation only |

Examples:
- `feat/brand-public-list`
- `fix/feed-author-type`
- `refactor/chat-query-builder`
- `test/brand-e2e`

Rules:
- Use lowercase kebab-case
- Keep it short (3-5 words max)
- Never work directly on `main`

## Commit Messages

Format: `<type>(<scope>): <short description>`

```
feat(brand): add public GET /brand endpoint
fix(auth): remove unused role field from password reset DTOs
test(feed): add e2e tests for feed authorType field
```

- Scope in parentheses is optional but recommended
- Imperative mood: "add" not "added", "fix" not "fixed"
- Keep subject line under 72 characters
- Add a body if the why is not obvious

## Development Loop

```bash
git checkout main
git pull origin main
git checkout -b feat/my-feature

# ... make changes, run tests ...

git add <specific files>        # never blindly add everything
git commit -m "feat(module): description"

git push -u origin feat/my-feature
```

## Before Opening a PR

- [ ] All unit tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Lint clean: `npm run lint`
- [ ] E2E tests pass (if touching API endpoints): `npm run test:e2e`
- [ ] No `.env` or secret files staged
- [ ] Branch is rebased on latest `main`

Sync with main before opening:
```bash
git fetch origin
git rebase origin/main
```

## Pull Request

- Title mirrors commit style: `feat(brand): add public brand list`
- Description must include:
  - **What**: what changed
  - **Why**: why this change was needed
  - **How to test**: steps to verify manually or via tests
- Keep PRs focused — one feature or fix per PR
- Do not mix refactoring with feature work in the same PR

## Code Review

- Address all comments before merging
- Resolve a conversation only after the change is applied
- Request re-review after significant changes

## Merging

- Prefer **Squash and Merge** for feature branches to keep `main` history clean
- Never force-push to `main`
- Delete the branch after merging

## Hotfixes

```bash
git checkout main
git pull origin main
git checkout -b fix/critical-bug-description
# fix, test, push, open PR, fast-track review, merge
```

## What NOT to Do

- Never commit directly to `main`
- Never force-push a shared branch
- Never commit `node_modules`, `.env`, or build artifacts
- Never open a PR from a branch that is far behind `main` — rebase first
- Never skip lint or tests before pushing
