# StyleHub — Social Media Service

A production-grade **social media microservice** built with **NestJS**, powering feeds, real-time chat, notifications, and a full social graph for the StyleHub platform. Event-driven, containerized, and CI/CD-deployed.

<p align="left">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TypeORM-FE0902?style=flat-square&logo=typeorm&logoColor=white" alt="TypeORM" />
  <img src="https://img.shields.io/badge/RabbitMQ-FF6600?style=flat-square&logo=rabbitmq&logoColor=white" alt="RabbitMQ" />
  <img src="https://img.shields.io/badge/Socket.IO-010101?style=flat-square&logo=socketdotio&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Swagger-85EA2D?style=flat-square&logo=swagger&logoColor=black" alt="Swagger" />
</p>

> Part of **StyleHub**, a microservices platform combining e-commerce, social media, and AI-driven recommendations. This repository is the social media service — owned and built end-to-end.

---

## Highlights

- **59 REST endpoints** across **14 feature modules** — feeds, posts, interactions, follow graph, chat/DMs, notifications, search, and more.
- **Real-time** messaging and notifications over **Socket.IO** WebSockets with authenticated gateways.
- **Event-driven** architecture using **RabbitMQ** (topic exchange) for cross-service communication and decoupled side effects.
- **Secure auth**: JWT access + refresh tokens, email verification, password reset, bcrypt hashing, Passport strategies, and route-level rate limiting.
- **Media pipeline**: image/video uploads streamed to **Cloudinary**.
- **Transactional email** via Brevo/Sendinblue for verification and notifications.
- **Fully containerized** (Docker + Docker Compose) with **CI/CD** to Heroku via GitHub Actions.
- **Tested**: unit tests plus end-to-end tests against real PostgreSQL using **Testcontainers**.
- **Documented**: auto-generated **Swagger/OpenAPI** spec with a one-command Postman sync.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Social Media Service (NestJS)              │
│                                                              │
│  Auth ─ User ─ Posts ─ Feed ─ Follow ─ Interactions          │
│  Chat ─ Messaging ─ Notifications ─ Search ─ Brand           │
│  Realtime (Socket.IO) ─ Cloudinary ─ Common                  │
└───────┬───────────────────────┬──────────────────┬──────────┘
        │                       │                  │
   PostgreSQL              RabbitMQ            Cloudinary
   (TypeORM +            (topic exchange,     (media storage)
    migrations)          cross-service events)
```

Each module is self-contained (controller → service → repository) with DTO validation via `class-validator` and configuration validated at boot with **Joi**.

### Feature modules

| Module | Responsibility |
|---|---|
| `auth` | Registration, login, JWT access/refresh, email verification, password reset |
| `user` | Profiles, account management |
| `posts` | Post creation, media, lifecycle |
| `feed` | Personalized and chronological feeds |
| `follow` | Follow/unfollow, followers/following graph |
| `interactions` | Likes, comments, and engagement |
| `chat` / `messaging` | Direct messages and conversations |
| `notifications` | In-app and pushed notifications |
| `realtime` | Authenticated Socket.IO gateways |
| `search` | User and content search |
| `brand` | Brand accounts |
| `cloudinary` | Media upload/streaming |
| `common` | Shared guards, pipes, filters, utilities |

---

## Tech stack

**Framework** NestJS · TypeScript
**Data** PostgreSQL · TypeORM (migrations, entities)
**Messaging** RabbitMQ (`amqplib`, `@nestjs/microservices`) · Socket.IO
**Auth** JWT (`@nestjs/jwt`) · Passport · bcrypt · `@nestjs/throttler`
**Media & email** Cloudinary · Brevo/Sendinblue
**Validation** `class-validator` · `class-transformer` · Joi
**Docs** Swagger / OpenAPI · Postman sync
**Testing** Jest · Supertest · Testcontainers (PostgreSQL)
**DevOps** Docker · Docker Compose · GitHub Actions · Heroku

---

## Getting started

### Prerequisites
- Node.js 18+
- Docker & Docker Compose

### 1. Clone and install
```bash
git clone https://github.com/StyleHub1/Social-Media-Service.git
cd Social-Media-Service
npm install
```

### 2. Configure environment
Create a `.env` file (see the variables validated in `src/config/config.types.ts`):
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=social_media_DB

JWT_TOKEN=your_access_secret
JWT_REFRESH_TOKEN=your_refresh_secret
JWT_EMAIL_VERIFICATION_SECRET=your_email_secret

RABBITMQ_URL=amqp://localhost:5672
CLOUDINARY_URL=cloudinary://...
BREVO_API_KEY=...
```

### 3. Start infrastructure (PostgreSQL + RabbitMQ)
```bash
docker compose up -d
```

### 4. Run migrations and start
```bash
npm run migration:run
npm run start:dev
```

The API runs on `http://localhost:3000`. Interactive docs are available at `/api` (Swagger).

---

## Scripts

| Command | Description |
|---|---|
| `npm run start:dev` | Start in watch mode |
| `npm run build` | Production build |
| `npm run test` | Unit tests |
| `npm run test:e2e` | End-to-end tests (Testcontainers) |
| `npm run test:cov` | Coverage report |
| `npm run migration:generate` | Generate a TypeORM migration |
| `npm run migration:run` | Apply migrations |
| `npm run sync-postman` | Push the OpenAPI spec to Postman |

---

## Testing

```bash
npm run test        # unit
npm run test:e2e    # spins up a real PostgreSQL container via Testcontainers
npm run test:cov    # coverage
```

---

## Deployment

Containerized with a multi-stage `Dockerfile`. On push to `main`, GitHub Actions builds, tests, and deploys to Heroku, injecting secrets from the CI environment (no credentials are committed to the repo).

---

## Author

**Omar Sherif Elghamry** — Backend & AI Engineer
[LinkedIn](https://www.linkedin.com/in/omar-elghamry-3a7256248/) · [GitHub](https://github.com/omaaarsh)
