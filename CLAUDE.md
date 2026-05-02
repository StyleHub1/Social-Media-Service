# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev          # Run with hot reload
npm run build              # Compile TypeScript via nest build

# Testing
npm test                   # Run all unit tests
npm run test:watch         # Watch mode
npm run test:cov           # With coverage
npm run test:e2e           # End-to-end tests (requires DB)

# Run a single unit test file
npx jest src/modules/auth/tests/password.service.spec.ts

# Run a single e2e test file
npx jest --config ./jest-e2e.json --runInBand "test/feed"

# Database migrations
npm run migration:generate # Build + generate migration from entity diff
npm run migration:run      # Build + run pending migrations
npm run migration:revert   # Revert last migration

# Code quality
npm run lint               # ESLint with auto-fix
npm run format             # Prettier format
```

## Local Database

Start PostgreSQL via Docker before running the app or e2e tests:

```bash
docker-compose up -d
```

The compose file spins up `postgres:16` on port 5432 with database `social_media_DB`, user/password `postgres`.

## Environment Variables

Copy `.env` and fill in required values. Required keys (validated via Joi on startup):

- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` — local DB (omit when `DATABASE_URL` is set)
- `DATABASE_URL` — required in production (Heroku-style, enables SSL)
- `JWT_TOKEN`, `JWT_EXPIRES_IN` — access token
- `JWT_REFRESH_TOKEN`, `JWT_REFRESH_EXPIRES_IN`, `REFRESH_TOKEN_HASH_SECRET` — refresh token
- `JWT_EMAIL_VERIFICATION_SECRET`, `JWT_EMAIL_VERIFICATION_EXPIRES_IN` — email verification
- `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_NAME` — transactional email via Brevo/Sendinblue
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — media uploads
- `E_COMMERCE_SERVICE_URL` — external e-commerce service base URL
- `RABBITMQ_URL` — CloudAMQP connection string (e.g. `amqps://user:pass@host/vhost`); defaults to `amqp://guest:guest@localhost:5672`

## Architecture

### Overview

NestJS REST API (TypeScript) backed by PostgreSQL via TypeORM. The app runs on port 8000 by default.

Global guards are applied via `APP_GUARD` in `AppModule`: `ATGuard` (JWT access token) runs first, then `RolesGuard`. Routes opt out of auth with the `@Public()` decorator.

### Folder structure

```
src/
├── main.ts
├── app.module.ts
├── config/                          # Typed config per domain (app, auth, database, email, ecommerce,Rabbit MQ)
│   └── typed-config.service.ts      # TypedConfigService extends ConfigService
├── database/
│   └── migrations/                  # TypeORM migration files (001–010)
└── modules/
    ├── auth/
    │   ├── auth.controller.ts
    │   ├── dto/                     # registration, login, forgot/reset password, refresh
    │   ├── entities/                # BaseUser, RefreshToken, ResetToken
    │   ├── guards/                  # AT.guard.ts, RT.guard.ts
    │   ├── interfaces/              # JwtPayload, BaseUser interface
    │   ├── repositories/            # BaseUserRepository, RefreshTokenRepository, ResetTokenRepository
    │   ├── services/                # AuthService, BaseUsersService, JwtService, PasswordService,
    │   │                            #   EmailService, RefreshTokenService, ResetTokenService
    │   ├── strategies/              # at.strategies.ts, rt.strategies.ts
    │   └── tests/
    ├── user/
    │   ├── user.controller.ts
    │   ├── dto/
    │   ├── entities/                # UserProfile
    │   ├── enums/                   # Gender, UserStatus
    │   ├── repositories/
    │   └── services/
    ├── follow/
    │   ├── follow.controller.ts
    │   ├── follow.module.ts
    │   ├── dto/                     # create-follow, follow-response, get-follows-query
    │   ├── entities/                # Follow
    │   ├── enums/                   # FollowStatus (ACTIVE | BLOCKED)
    │   ├── events/                  # UserFollowedEvent, UserUnfollowedEvent
    │   ├── repositories/
    │   └── services/
    ├── interactions/
    │   ├── interactions.module.ts
    │   ├── controllers/             # interactions.controller.ts
    │   ├── dto/                     # create-comment, update-comment, create-like, get-interactions-query
    │   ├── entities/                # Comment (soft delete), Like
    │   ├── enums/                   # InteractionType
    │   ├── events/                  # CommentCreatedEvent, CommentDeletedEvent, PostReactedEvent, PostUnreactedEvent
    │   ├── repositories/            # comment.repository.ts, like.repository.ts
    │   └── services/
    ├── feed/
    │   ├── feed.module.ts
    │   ├── controllers/             # feed.controller.ts
    │   ├── dto/                     # feed-query, feed-response (FeedItemResponseDto, FeedPostDto)
    │   ├── entities/                # FeedItem
    │   ├── enums/                   # FeedItemType (POST | GLOBAL)
    │   ├── jobs/                    # FeedCleanupJob — daily cron, deletes items older than 30 days
    │   ├── listeners/               # FeedEventListener — handles post.created, post.deleted, follow.*
    │   ├── repositories/            # FeedRepository — bulk insert, raw follower/post queries via DataSource
    │   ├── services/                # FeedService — fan-out, backfill, cleanup, hybrid fallback
    │   └── tests/                   # Unit tests for FeedService and FeedEventListener
    ├── brand/
    │   ├── brand.controller.ts
    │   ├── dto/
    │   ├── entities/                # BrandProfile
    │   ├── enums/                   # BrandStatus
    │   ├── repositories/
    │   └── services/
    ├── posts/
    │   ├── controllers/
    │   ├── dto/                     # create, update, query
    │   ├── entities/                # Post (PostVisibility enum)
    │   ├── events/                  # PostCreatedEvent, PostUpdatedEvent, PostDeletedEvent
    │   ├── repositories/
    │   └── services/
    ├── messages/
    |   ├── event-bridge.service.    # Listens to internal events and publishes to RabbitMQ
    |   ├── messaging.service.ts     # RabbitMQ connection and publish method
    |   ├── messaging.module.ts      # Imports MessagingService and EventBridgeService
    ├── search/
    │   ├── search.controller.ts
    │   └── search.service.ts
    ├── cloudinary/
    │   ├── cloudinary.provider.ts
    │   └── cloudinary.service.ts
    └── common/
        ├── decorators/              # @Public(), @Roles(), @CurrentUser(), @Match()
        ├── enums/                   # Role enum
        ├── guards/                  # RolesGuard
        └── pagination/              # PaginationParams, PaginationResponse
```

### Module structure

Each domain module lives under `src/modules/<name>/` and typically contains: `*.module.ts`, `*.controller.ts`, `services/`, `repositories/`, `entities/`, `dto/`, `guards/`.

| Module | Responsibility |
|---|---|
| `auth` | Registration, email verification, login, logout, password reset, JWT access/refresh token lifecycle |
| `user` | User profile management (complete profile, update, avatar upload); emits `user.profile.completed` on first profile completion |
| `brand` | Brand profile management (complete profile, update, logo upload); emits `brand.profile.completed` on first profile completion |
| `posts` | CRUD for posts with image/video uploads; soft delete; pagination; `reactionsCount` and `commentsCount` counters |
| `follow` | Follow/unfollow between users; paginated followers/following lists; follow status check; emits `follow.followed` / `follow.unfollowed` events; updates `followersCount` / `followingCount` on `BaseUser` atomically |
| `interactions` | Reactions (like/unlike) and comments on posts; both operations use DB transactions to keep post counters in sync; soft delete for comments; emits `post.reacted`, `post.unreacted`, `comment.created`, `comment.deleted` events; brands may only interact with their own posts |
| `feed` | Fan-out-on-write feed. `FeedEventListener` listens to `post.created` (bulk-inserts a `feed_item` per follower + self), `post.deleted` (cleanup), `follow.followed` (backfill last 20 posts), `follow.unfollowed` (cleanup). `GET /feed` returns personal feed or falls back to recent PUBLIC posts (`type: GLOBAL`) for new users. `FeedCleanupJob` purges items older than 30 days daily at 3am. `feed_items` table has `UNIQUE(ownerId, postId)` for idempotent inserts and indexes on `(ownerId, createdAt DESC)` and `(ownerId, authorId)`. |
| `search` | Cross-entity search across users and brands by name, ranked by score |
| `cloudinary` | Thin wrapper around Cloudinary SDK; used by user, brand, and posts modules |
| `messaging` | RabbitMQ publisher via `amqplib`. `MessagingService` connects on startup and asserts a durable topic exchange `stylehub`. `EventBridgeService` listens to internal `@nestjs/event-emitter` events and forwards them with `social.*` routing keys. `UserService` and `BrandService` also call `publish()` directly after profile creation. If RabbitMQ is down the app continues — messages are dropped with a warning log. |
| `common` | Shared decorators (`@Public`, `@Roles`, `@CurrentUser`), guards (`RolesGuard`), pagination helpers |

### Identity model

`BaseUser` (`base_users` table) is the single authentication identity. It holds `email`, `password`, `role` (`USER | BRAND | ADMIN`), `isActive`, and counters (`followersCount`, `followingCount`, `postsCount`). Role-specific profile data lives in separate `UserProfile` and `BrandProfile` entities joined one-to-one.

### Auth flow

1. Register → email verification link sent via Brevo
2. Verify email → `isEmailVerified = true`
3. Login → issues short-lived access token + refresh token (hashed and stored in DB); all previous refresh tokens revoked on each login
4. Refresh → old token revoked, new pair issued (rotation)
5. Logout → all refresh tokens for entity revoked
6. Password reset → `forgotPassword` sends a 6-digit code via email; `resetPassword` verifies the code and updates the password in one step

JWT payload carries `sub` (entity id), `role`, `email`, `isProfileComplete`, `iss: "auth-service"`, `aud: "ecommerce-service"`.

Controller endpoints (all `@Public()` except logout):
- `POST /auth/register` — register new user/brand
- `GET /auth/verify-email?token=` — verify email link
- `POST /auth/login` — login, returns access + refresh tokens
- `POST /auth/forgot-password` — sends 6-digit reset code via email
- `POST /auth/reset-password` — verify code + set new password
- `POST /auth/refresh` — rotate refresh token pair (uses RTGuard)
- `POST /auth/logout` — revoke all refresh tokens (requires AT)

### Posts

Posts support optional text content, multiple images, and multiple videos uploaded to Cloudinary. Visibility is controlled by the `PostVisibility` enum (`PUBLIC | FOLLOWERS | PRIVATE`, default `PUBLIC`). Soft delete is used (`deletedAt`). Post creation/update/deletion emits events via `@nestjs/event-emitter` (`post.created`, `post.updated`, `post.deleted`). Only the post author can update or delete their posts (enforced in service layer).

Controller endpoints (require `Role.USER` or `Role.BRAND`, except `GET /posts` which is `@Public()`):
- `POST /posts` — create post (multipart: up to 5 images, 3 videos via Cloudinary)
- `GET /posts` — list all posts, paginated (public)
- `GET /posts/me` — current user's posts (paginated)
- `GET /posts/user/:userId` — another user's posts (paginated)
- `GET /posts/:id` — get single post by ID
- `PATCH /posts/:id` — update post (author only)
- `DELETE /posts/:id` — soft-delete post (author only)

### Follow

`FollowService` wraps follow/unfollow in a `DataSource` transaction to atomically update the `follows` table and increment/decrement `followersCount` / `followingCount` on `base_users`. A unique constraint on `(followerId, followingId)` surfaces as a `ConflictException`. Events `follow.followed` and `follow.unfollowed` are emitted via `@nestjs/event-emitter`.

Controller endpoints (all require `Role.USER`):
- `POST /follow` — follow a user
- `DELETE /follow/:followingId` — unfollow
- `GET /follow/followers` — current user's followers (paginated)
- `GET /follow/following` — current user's following (paginated)
- `GET /follow/:userId/followers` — another user's followers
- `GET /follow/:userId/following` — another user's following
- `GET /follow/status/:followingId` — check if current user follows target

### Interactions

`InteractionsService` handles reactions (likes) and comments. Both react/unreact and add/delete comment use `DataSource` transactions to keep `reactionsCount` / `commentsCount` on `posts` in sync. Comments use soft delete (`deletedAt`). Brands may only interact with their own posts (`assertCanInteract`). Comment deletion is allowed by either the comment author or the post owner.

Controller endpoints (require `Role.USER` or `Role.BRAND`):
- `POST /interactions/reactions/:postId` — react to post
- `DELETE /interactions/reactions/:postId` — unreact
- `GET /interactions/reactions/:postId` — list reactions (paginated)
- `POST /interactions/comments` — add comment
- `PATCH /interactions/comments/:commentId` — update comment (author only)
- `DELETE /interactions/comments/:commentId` — delete comment (author or post owner)
- `GET /interactions/comments/:postId` — list comments (paginated)

### Feed

`feed_items` table stores one row per `(ownerId, postId)` pair — no post content duplication. Key columns: `ownerId`, `postId`, `authorId` (denormalized for O(1) unfollow cleanup without joining posts), `type` (`POST | GLOBAL`), `createdAt`. Unique constraint on `(ownerId, postId)` makes all inserts idempotent via `ON CONFLICT DO NOTHING`.

**Read path** (`GET /feed`): single index scan on `(ownerId, createdAt DESC)` + one PK join to `posts`. If the result is empty, falls back to querying recent `PUBLIC` posts directly (hybrid fan-out-on-read) and returns them with `type: GLOBAL`.

**Write path**: `FeedEventListener` handles four events asynchronously (`{ async: true }`) — errors are caught and logged, never propagated to the emitting request. Bulk inserts are chunked at 500 rows.

**Backfill cap**: on `follow.followed`, only the 20 most recent posts by the followed user are backfilled. This prevents large inserts when following prolific accounts.

**Retention**: `FeedCleanupJob` runs `@Cron('0 3 * * *')` and deletes `feed_items` older than 30 days. Requires `ScheduleModule.forRoot()` in `AppModule` (already wired).

Controller endpoint (requires `Role.USER` or `Role.BRAND`):
- `GET /feed` — paginated personal feed with hybrid global fallback

### Search

`SearchService.search()` fans out to both `UserService` and `BrandService` in parallel and merges results ranked by `score`. `getAccountById()` tries `UserService` first, then falls back to `BrandService` — use this when the caller doesn't know the account type.

### User

Controller endpoints (require `Role.USER`):
- `GET /user/profile` — get current user's profile
- `POST /user/complete-profile` — complete profile (first-time setup, emits `user.profile.completed`)
- `PATCH /user/profile` — update profile fields
- `DELETE /user/account` — delete account
- `POST /user/profile/image` — upload avatar (jpg/jpeg/png/webp, max 4 MB)
- `GET /user/profile/image` — get current avatar URL

### Brand

Controller endpoints (require `Role.BRAND`):
- `GET /brand/profile` — get current brand's profile
- `POST /brand/complete-profile` — complete profile (first-time setup, emits `brand.profile.completed`)
- `PATCH /brand/profile` — update brand profile fields
- `POST /brand/profile/image` — upload logo (jpg/jpeg/png/webp, max 4 MB)

### Messaging routing keys

`EventBridgeService` bridges internal NestJS events to RabbitMQ topic exchange `stylehub` with `social.*` routing keys:

| Internal event | RabbitMQ routing key | Key payload fields |
|---|---|---|
| `user.profile.completed` | `social.user.profile-completed` | `userId`, `username`, `firstName`, `lastName`, `phoneNumber`, `gender` |
| `brand.profile.completed` | `social.brand.profile-completed` | `brandId`, `brandName`, `username`, `bio`, `websiteUrl`, `profileImageUrl` |
| `post.created` | `social.post.created` | `postId`, `authorId`, `visibility`, `createdAt` |
| `post.updated` | `social.post.updated` | `postId`, `authorId`, `updatedAt` |
| `post.deleted` | `social.post.deleted` | `postId`, `authorId` |
| `follow.followed` | `social.follow.followed` | `followId`, `followerId`, `followingId`, `createdAt` |
| `follow.unfollowed` | `social.follow.unfollowed` | `followerId`, `followingId` |
| `post.reacted` | `social.interaction.reacted` | `likeId`, `userId`, `postId`, `authorId`, `createdAt` |
| `post.unreacted` | `social.interaction.unreacted` | `userId`, `postId`, `authorId` |
| `comment.created` | `social.interaction.commented` | `commentId`, `authorId`, `postId`, `postAuthorId`, `createdAt` |

### Migrations

Migration files live in `src/database/migrations/`. `typeorm.config.ts` at project root is the DataSource used by the CLI. `synchronize` is disabled — always use migrations for schema changes.

| # | File | Description |
|---|------|-------------|
| 001 | `001-create-base-users-table.ts` | Creates `base_users` table with role enum and auth fields |
| 002 | `002-create-users-table.ts` | Creates `user_profiles` table (one-to-one with `base_users`) |
| 003 | `003-create-brands-table.ts` | Creates `brand_profiles` table (one-to-one with `base_users`) |
| 004 | `004-create-refresh-tokens-table.ts` | Creates `refresh_tokens` table with hashed token storage |
| 005 | `005-create-reset-tokens-table.ts` | Creates `reset_tokens` table for password reset codes |
| 006 | `006-create-posts-table.ts` | Creates `posts` table with visibility enum and soft delete |
| 007 | `007-create-follows-table.ts` | Creates `follows` table with `follows_status_enum`, unique constraint, and indexes |
| 008 | `008-create-interactions-tables.ts` | Adds `reactionsCount` and `commentsCount` columns to `posts` |
| 009 | `009-create-comments-table.ts` | Creates `comments` table with soft delete and indexes |
| 010 | `010-create-likes-table.ts` | Creates `likes` table with unique constraint on `(userId, postId)` |
| 011 | `011-create-feed-items-table.ts` | Creates `feed_items` table with `authorId`, `UNIQUE(ownerId, postId)`, and indexes for feed reads and unfollow cleanup |

### Configuration

Typed config is accessed via `TypedConfigService` (extends `ConfigService`) with a `ConfigType` interface keyed by `app`, `database`, `auth`, `email`, `ecommerce`. All env vars are validated at startup with a Joi schema in `src/config/config.types.ts`.
