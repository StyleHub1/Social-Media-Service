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
npx jest --config ./jest-e2e.json --runInBand "test/notifications"
npx jest --config ./jest-e2e.json --runInBand "test/chat"

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
- `RABBITMQ_URL` — CloudAMQP connection string (e.g. `amqps://user:pass@host/vhost`); defaults to `amqp://guest:guest@localhost:5672`
- `ALLOWED_ORIGINS` — comma-separated list of allowed WebSocket/CORS origins (e.g. `https://app.example.com,https://staging.example.com`)

## Architecture

### Overview

NestJS REST API (TypeScript) backed by PostgreSQL via TypeORM, with real-time features via Socket.IO. The app runs on port 8000 by default.

Global guards are applied via `APP_GUARD` in `AppModule`: `ATGuard` (JWT access token) runs first, then `RolesGuard`, then `ThrottlerGuard` (global rate limit: 60 req/min). Routes opt out of auth with the `@Public()` decorator.

### Folder structure

```
src/
├── main.ts
├── app.module.ts
├── config/                          # Typed config per domain (app, auth, database, email, rabbitmq)
│   └── typed-config.service.ts      # TypedConfigService extends ConfigService
├── database/
│   └── migrations/                  # TypeORM migration files (001–013)
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
    │   ├── jobs/                    # FeedCleanupJob — daily cron at 3am UTC, deletes items older than 30 days
    │   ├── listeners/               # FeedEventListener — handles post.created, post.deleted, follow.*
    │   ├── repositories/            # FeedRepository — bulk insert, raw follower/post queries via DataSource
    │   ├── services/                # FeedService — fan-out, backfill, cleanup, hybrid fallback
    │   └── tests/                   # Unit tests for FeedService and FeedEventListener
    ├── notifications/
    │   ├── notification.module.ts
    │   ├── controllers/             # notification.controller.ts
    │   ├── dto/                     # get-notifications-query, notification-response
    │   ├── entities/                # Notification
    │   ├── enums/                   # NotificationType (NEW_FOLLOWER | POST_LIKED | POST_COMMENTED)
    │   ├── listeners/               # NotificationEventListener — handles follow.followed, post.reacted, comment.created
    │   ├── repositories/            # NotificationRepository — create, find, markAsRead, markAllAsRead, countUnread
    │   └── services/                # NotificationService, NotificationRealtimeService
    ├── chat/
    │   ├── chat.module.ts
    │   ├── controllers/             # chat.controller.ts
    │   ├── dto/                     # send-message, conversation-query, message-query, chat-response, cursor-pagination
    │   ├── entities/                # Conversation, ChatMessage
    │   ├── enums/                   # MessageStatus (SENT | DELIVERED | SEEN)
    │   ├── repositories/            # ConversationRepository, MessageRepository
    │   └── services/                # ChatService, TypingService
    ├── realtime/
    │   ├── realtime.module.ts
    │   └── realtime.gateway.ts      # Socket.IO gateway — auth, chat:send/typing/seen events
    ├── messaging/
    │   ├── event-bridge.service.ts  # Listens to internal events and publishes to RabbitMQ
    │   ├── messaging.service.ts     # RabbitMQ connection, reconnect, buffer, and publish
    │   └── messaging.module.ts      # Imports MessagingService and EventBridgeService
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

Each domain module lives under `src/modules/<name>/` and typically contains: `*.module.ts`, `*.controller.ts`, `services/`, `repositories/`, `entities/`, `dto/`.

| Module | Responsibility |
|---|---|
| `auth` | Registration, email verification, login, logout, password reset, JWT access/refresh token lifecycle |
| `user` | User profile management (complete profile, update, avatar upload); emits `user.profile.completed` on first profile completion |
| `brand` | Brand profile management (complete profile, update, logo upload); emits `brand.profile.completed` on first profile completion |
| `posts` | CRUD for posts with image/video uploads; soft delete; pagination; `reactionsCount` and `commentsCount` counters |
| `follow` | Follow/unfollow between users; paginated followers/following lists; follow status check; emits `follow.followed` / `follow.unfollowed` events; updates `followersCount` / `followingCount` on `BaseUser` atomically |
| `interactions` | Reactions (like/unlike) and comments on posts; both operations use DB transactions to keep post counters in sync; soft delete for comments; emits `post.reacted`, `post.unreacted`, `comment.created`, `comment.deleted` events; brands may only interact with their own posts |
| `feed` | Fan-out-on-write feed. `FeedEventListener` listens to `post.created` (bulk-inserts a `feed_item` per follower + self), `post.deleted` (cleanup), `follow.followed` (backfill last 20 posts), `follow.unfollowed` (cleanup). `GET /feed` returns personal feed or falls back to recent PUBLIC posts (`type: GLOBAL`) for new users. `FeedCleanupJob` purges items older than 30 days daily at 3am UTC. `feed_items` table has `UNIQUE(ownerId, postId)` for idempotent inserts and indexes on `(ownerId, createdAt DESC)` and `(ownerId, authorId)`. |
| `notifications` | Event-driven push notifications. `NotificationEventListener` handles `follow.followed` → `NEW_FOLLOWER`, `post.reacted` → `POST_LIKED`, `comment.created` → `POST_COMMENTED`. Skips self-interactions. Persists to `notifications` table and delivers in real time via `RealtimeGateway.sendToUser()` on the `notification:new` event. Rate limited at 30 req/min per user. |
| `chat` | 1-to-1 direct messaging. `conversations` table has a `UNIQUE(participantA, participantB)` constraint (participants stored in lexicographic order to prevent duplicates). Messages support `SENT → DELIVERED → SEEN` status transitions. `ChatService` automatically upgrades to `DELIVERED` when recipient is online. `TypingService` manages ephemeral typing indicators in memory with a 2s debounce and 3s auto-stop. Batch unread-count query via `batchCountUnread` avoids N+1. Rate limited at 20 req/min on send endpoints. |
| `realtime` | Socket.IO gateway (`RealtimeGateway`). On connect: verifies JWT from `socket.handshake.auth.token` and joins the user to their own room (`socket.join(userId)`). Handles `chat:send`, `chat:typing`, and `chat:seen` WebSocket events. `sendToUser(userId, event, data)` is the shared delivery method used by chat and notifications. CORS origin restricted to `ALLOWED_ORIGINS` env var. |
| `messaging` | RabbitMQ publisher via `amqplib`. `MessagingService` connects on startup, asserts a durable topic exchange `stylehub`, buffers messages when disconnected, and reconnects every 5s. `EventBridgeService` listens to internal `@nestjs/event-emitter` events and forwards them with `social.*` routing keys. All handlers are async with try/catch — errors logged, never propagated. |
| `search` | Cross-entity search across users and brands by name, ranked by score |
| `cloudinary` | Thin wrapper around Cloudinary SDK; used by user, brand, and posts modules |
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

**Retention**: `FeedCleanupJob` runs `@Cron('0 3 * * *', { timeZone: 'UTC' })` and deletes `feed_items` older than 30 days. Requires `ScheduleModule.forRoot()` in `AppModule` (already wired).

Controller endpoint (requires `Role.USER` or `Role.BRAND`):
- `GET /feed` — paginated personal feed with hybrid global fallback

### Notifications

`notifications` table stores one row per notification event. Key columns: `recipientId`, `actorId` (nullable, set to NULL on actor deletion), `type` (`NEW_FOLLOWER | POST_LIKED | POST_COMMENTED`), `postId` (nullable), `isRead`, `readAt`. Indexes on `(recipientId, createdAt DESC)` for the list read path and a partial index on `(recipientId, isRead) WHERE isRead = false` for unread counts.

**Event handling**: `NotificationEventListener` listens to `follow.followed`, `post.reacted`, and `comment.created` asynchronously (`{ async: true }`). Self-interactions are silently skipped. Each handler calls `NotificationService.createAndDeliver()` which persists the record and then pushes it to the recipient via `RealtimeGateway.sendToUser()` on the `notification:new` event.

**`markAsRead`** uses a TypeORM QueryBuilder update (`WHERE id = ? AND recipientId = ? AND isRead = false`) — returns `null` (→ 404) when no rows are affected, i.e. notification belongs to another user or doesn't exist.

Controller endpoints (require `Role.USER` or `Role.BRAND`, rate limited at 30 req/min):
- `GET /notifications` — paginated list, newest first
- `GET /notifications/unread-count` — returns `{ count: number }`
- `PATCH /notifications/read-all` — mark all unread as read
- `PATCH /notifications/:id/read` — mark single notification as read (404 if wrong user or not found)

### Chat

`conversations` table enforces a canonical participant ordering: `participantA < participantB` (UUID lexicographic). This guarantees `UNIQUE(participantA, participantB)` prevents duplicate conversations regardless of who initiates. `lastMessageAt` is updated on every send and used to sort conversation lists.

`chat_messages` table: `conversationId`, `senderId`, `content`, `status` (`SENT | DELIVERED | SEEN`), `seenAt`. Cursor-based pagination on `(conversationId, createdAt DESC, id DESC)`. Unread count uses a partial index `WHERE status != 'SEEN'`.

**Status transitions**: `SENT` → `DELIVERED` (immediate, if recipient is online at send time, checked via `gateway.server.in(userId).fetchSockets()`). `DELIVERED` / `SENT` → `SEEN` (via `markConversationAsSeen` or `chat:seen` WebSocket event). Status pushes are delivered via `sendToUser(senderId, 'chat:status', { messageId, status, timestamp })`.

**Typing indicators**: `TypingService` manages in-memory state. Debounce window: 2s (repeated `isTyping:true` within 2s updates timestamp but doesn't reset the auto-stop timer). Auto-stop: 3s after the last typing event, the server emits `isTyping:false` on the client's behalf. State is process-local (best-effort for multi-instance deployments).

**Unread counts**: `batchCountUnread` executes a single `GROUP BY` query for all conversations to avoid N+1 when loading the conversation list.

Controller endpoints (require `Role.USER` or `Role.BRAND`):
- `POST /chat/messages` — send direct message (auto-creates conversation); rate limited at 20 req/min
- `GET /chat/conversations` — list conversations ordered by most recent activity (paginated)
- `POST /chat/conversations` — get or create conversation by participant ID
- `GET /chat/conversations/:id/messages` — cursor-paginated message history
- `POST /chat/conversations/:id/messages` — send message to existing conversation; rate limited at 20 req/min
- `PATCH /chat/conversations/:id/seen` — mark all messages as seen

### Realtime (WebSocket)

`RealtimeGateway` is a Socket.IO gateway mounted on the same HTTP server. On connection:
1. Reads JWT from `socket.handshake.auth.token` (header-based only — query-string transport is disabled for security)
2. Verifies the token via `JwtService.verifyToken()`
3. Joins the socket to the user's room (`socket.join(userId)`)
4. Unauthorized connections are silently disconnected

On disconnect: `TypingService.clearUserState(userId)` is called and `isTyping:false` is emitted to all affected conversation partners.

**Inbound WebSocket events** (client → server):

| Event | Payload | Description |
|---|---|---|
| `chat:send` | `{ conversationId, content }` | Send a message (mirrors REST `POST /chat/conversations/:id/messages`) |
| `chat:typing` | `{ conversationId, isTyping }` | Forward typing indicator after debounce |
| `chat:seen` | `{ conversationId }` | Mark conversation as seen |

**Outbound WebSocket events** (server → client):

| Event | Payload | Description |
|---|---|---|
| `chat:message` | `MessageResponseDto` | New incoming message |
| `chat:status` | `{ messageId, status, timestamp }` | Message status update (DELIVERED or SEEN) |
| `chat:typing` | `{ userId, conversationId, isTyping }` | Other participant's typing indicator |
| `chat:error` | `{ message }` | Error response for failed `chat:send` |
| `notification:new` | `NotificationResponseDto` | Real-time notification delivery |

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

`EventBridgeService` bridges internal NestJS events to RabbitMQ topic exchange `stylehub` with `social.*` routing keys. All handlers are `async` with `try/catch` — failures are logged but never propagate to the originating request.

| Internal event | RabbitMQ routing key | Key payload fields |
|---|---|---|
| `user.profile.completed` | `social.user.profile-completed` | `userId`, `email`, `username`, `firstName`, `lastName`, `phoneNumber`, `bio`, `gender` |
| `user.profile.updated` | `social.user.profile-updated` | `userId`, `email`, `username`, `firstName`, `lastName`, `bio`, `profileImageUrl`, `gender`, `phoneNumber` |
| `user.profile.deleted` | `social.user.profile-deleted` | `userId`, `username` |
| `brand.profile.completed` | `social.brand.profile-completed` | `brandId`, `email`, `brandName`, `username`, `bio`, `websiteUrl` |
| `brand.profile.updated` | `social.brand.profile-updated` | `brandId`, `email`, `brandName`, `username`, `bio`, `websiteUrl`, `profileImageUrl` |
| `brand.profile.deleted` | `social.brand.profile-deleted` | `brandId`, `username` |
| `post.created` | `social.post.created` | `postId`, `authorId`, `visibility`, `createdAt` |
| `post.updated` | `social.post.updated` | `postId`, `authorId`, `updatedAt` |
| `post.deleted` | `social.post.deleted` | `postId`, `authorId` |
| `follow.followed` | `social.follow.followed` | `followId`, `followerId`, `followingId`, `createdAt` |
| `follow.unfollowed` | `social.follow.unfollowed` | `followerId`, `followingId` |
| `post.reacted` | `social.interaction.reacted` | `likeId`, `userId`, `postId`, `authorId`, `createdAt` |
| `post.unreacted` | `social.interaction.unreacted` | `userId`, `postId`, `authorId` |
| `comment.created` | `social.interaction.commented` | `commentId`, `authorId`, `postId`, `postAuthorId`, `createdAt` |
| `chat.message.sent` | `social.chat.message-sent` | `messageId`, `conversationId`, `senderId`, `recipientId`, `createdAt` |
| `chat.message.read` | `social.chat.message-read` | `conversationId`, `readBy`, `readAt` |

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
| 012 | `012-create-notifications-table.ts` | Creates `notifications` table with `notification_type_enum`, indexes on `(recipientId, createdAt DESC)` and partial index on unread |
| 013 | `013-create-chat-tables.ts` | Creates `conversations` (with `UNIQUE(participantA, participantB)` and `CHECK participantA < participantB`) and `chat_messages` (with `message_status_enum`, cursor pagination index, and partial unread index) tables |

### Configuration

Typed config is accessed via `TypedConfigService` (extends `ConfigService`) with a `ConfigType` interface keyed by `app`, `database`, `auth`, `email`, `rabbitmq`. All env vars are validated at startup with a Joi schema in `src/config/config.types.ts`.

### CI/CD

Two separate GitHub Actions workflows:

- **`ci.yml`** — runs on every push and pull request to any branch. Installs dependencies, runs lint, builds, and executes unit tests. No deployment.
- **`cd.yml`** — runs on push to `main` only. Has two jobs: `test` (spins up a Postgres service container and runs e2e tests) and `deploy` (depends on `test`). Deploys to Heroku via Container Registry (`heroku.yml` + Docker), then automatically runs `heroku run "npm run migration:run:prod" --app $APP_NAME --exit-code` to apply pending migrations after every successful deploy.
