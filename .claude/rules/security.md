# Security Rules

## JWT & Auth

- Access tokens: short-lived (set by `JWT_EXPIRES_IN`)
- Refresh tokens: hashed before storage — never store raw tokens
- On login: all previous refresh tokens are revoked
- On refresh: old token revoked, new pair issued (rotation)
- JWT payload: `{ sub, role, email, isProfileComplete, iss: "auth-service", aud: "ecommerce-service" }`
- Always verify `iss` and `aud` claims in strategies

## Password Reset

- 6-digit numeric code sent via Brevo email
- Code is verified and consumed in a single `resetPassword` call
- Reset tokens stored in `reset_tokens` table — invalidate on use

## WebSocket Security

- JWT read from `socket.handshake.auth.token` only — query-string transport disabled
- Unauthorized sockets are disconnected silently (no error broadcast)
- CORS origins restricted to `ALLOWED_ORIGINS` env var — never wildcard in production

## Environment Variables

Never hardcode secrets. Required at startup (validated via Joi):
- `JWT_TOKEN`, `JWT_REFRESH_TOKEN`, `JWT_EMAIL_VERIFICATION_SECRET`
- `REFRESH_TOKEN_HASH_SECRET`
- `BREVO_API_KEY`
- `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

If any required secret is missing, the app fails to start.

## Authorization Patterns

- Route-level: `@Roles(Role.USER)` guard enforces role
- Resource-level: service checks `currentUser.sub === resource.authorId` before mutation
- Brand interaction restriction: `assertCanInteract()` in `InteractionsService` — brands may only interact with their own posts

## File Uploads

- Allowed types: `jpg`, `jpeg`, `png`, `webp` for images
- Max avatar/logo size: 4 MB
- Videos: up to 5 images, 3 videos per post
- All uploads go through Cloudinary — never store files locally

## Rate Limiting

- Global: 60 req/min (ThrottlerGuard)
- Notifications: 30 req/min
- Chat send: 20 req/min

## Input Validation

- All DTOs use `class-validator`
- `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` is applied globally
- Never pass raw user input to DB queries — always go through typed DTOs
