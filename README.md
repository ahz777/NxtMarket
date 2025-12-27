# NxtMarket

NxtMarket is a full-stack e-commerce backend designed to support a multi-vendor marketplace with a clean, layered Node.js architecture. It combines **MongoDB** (catalog/domain objects) with **PostgreSQL** (transactional order data) and provides a production-oriented API surface for authentication, products, cart, checkout, payments (stub), webhooks, and multi-vendor fulfillment.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Key Features](#key-features)
- [Setup & Installation](#setup--installation)
  - [Environment Variables](#environment-variables)
  - [Database Setup](#database-setup)
  - [Migrations](#migrations)
  - [Seeding](#seeding)
  - [Run the App](#run-the-app)
  - [Run Tests](#run-tests)
- [API Reference](#api-reference)
  - [Auth](#auth)
  - [Products](#products)
  - [Cart](#cart)
  - [Orders](#orders)
  - [Payments](#payments)
  - [Uploads](#uploads)
  - [Vendor](#vendor)
  - [Admin](#admin)
- [Examples](#examples)
- [Folder Structure & Architecture](#folder-structure--architecture)
- [Health Server Deployment Notes](#health-server-deployment-notes)
- [Optional Redis Caching Notes](#optional-redis-caching-notes)
- [Operational Notes](#operational-notes)

---

## Project Overview

**Purpose:** Provide a robust backend foundation for a multi-vendor marketplace:

- Buyers browse products, manage a cart, check out, and pay.
- Vendors manage products, view orders that contain their items, and fulfill items.
- Admins manage orders and operational metrics.
- Webhooks simulate payment provider callbacks with replay protection and idempotency.

---

## Tech Stack

- **Node.js + Express** — REST API
- **MongoDB + Mongoose** — products, cart, users (domain layer)
- **PostgreSQL + Sequelize** — orders, order items, payment intents, idempotency keys, audit logs
- **Socket.IO** — order notifications (room-scoped)
- **Umzug** — d (production-safe schema evolution)
- **Multer** — product image uploads (local filesystem)
- **Jest + Supertest** — integration tests (optional in CI)
- **Redis (optional)** — caching via `ioredis`

---

## Key Features

- Role-based access control: `user`, `vendor`, `admin`
- Cart → checkout flow with **Idempotency-Key** support
- Payment intent + webhook flow (stub provider) with:
  - signature verification (placeholder algorithm)
  - webhook event idempotency
  - replay payload mismatch protection
- Multi-vendor fulfillment:
  - vendors ship their own items
  - order status can become `PARTIALLY_SHIPPED` then `SHIPPED`
- Uploads:
  - image-only validation (JPEG/PNG/WEBP)
  - local static hosting under `/public/uploads/...`
- Separate **health server** for `/health` and `/metrics`
- Optional Redis caching

---

## Setup & Installation

### Prerequisites

- Node.js 18+ (recommended)
- MongoDB running locally or via connection URI
- PostgreSQL running locally or via connection credentials
- (Optional) Redis

### Install dependencies

```bash
npm install

Environment Variables

Create a .env (or copy from .env.example if you maintain one):

# HTTP API
PORT=5000
CORS_ORIGIN=*

# Health server
HEALTH_PORT=4000

# Auth
JWT_SECRET=replace_me

# Mongo
MONGO_URI=mongodb://localhost:27017/nxtmarket

# Postgres (Sequelize)
SQL_HOST=localhost
SQL_DB=nxtmarket
SQL_USER=postgres
SQL_PASS=postgres
SQL_DIALECT=postgres

# Payments (webhook stub)
PAYMENTS_WEBHOOK_SECRET=replace_me_webhook_secret

# Optional Redis
REDIS_URL=redis://localhost:6379

# Tests (required to run Jest integration tests)
TEST_SQL_DATABASE_URL=postgres://postgres:postgres@localhost:5432/nxtmarket_test

    The SQL configuration can be environment-based (dev/test/prod). In test runs, the code expects TEST_SQL_DATABASE_URL for a dedicated test database.

Database Setup
MongoDB

Create database (automatic on first write). Ensure MONGO_URI points to a running Mongo instance.
PostgreSQL

Create the main database and a dedicated test database:

CREATE DATABASE nxtmarket;
CREATE DATABASE nxtmarket_test;

Migrations

This project uses Umzug migrations (recommended for production).

Run migrations:

npm run db:migrate

    If you previously used sequelize.sync({ alter: true }) during early development, consider migrating on a fresh database to avoid enum/type conflicts.

Seeding

Seed dev accounts and sample products:

npm run db:seed

Typical seeded accounts (example):

    Admin: admin@nxtmarket.local

    Vendor: vendor@nxtmarket.local

    User: user@nxtmarket.local

Run the App

Start the API server:

npm run dev

The API typically runs on:

    http://localhost:5000

Static uploads are served under:

    http://localhost:5000/public/uploads/products/<filename>

Run Tests

Run Jest integration tests:

export TEST_SQL_DATABASE_URL="postgres://postgres:postgres@localhost:5432/nxtmarket_test"
npm test

Run the CI-like smoke flow:

npm run test:smoke

API Reference

Base URL (local): http://localhost:5000
Auth
Method	Path	Description
POST	/api/auth/register	Register a new user/vendor/admin (role-based). Returns JWT token.
POST	/api/auth/login	Login and receive JWT token.
GET	/api/auth/me	Get current authenticated user profile.

    Auth endpoints may vary slightly depending on your auth module; confirm via src/modules/auth.

Products
Method	Path	Description
GET	/api/products	List products (supports query/filter/pagination).
GET	/api/products/:id	Get product details.
POST	/api/products	Create product (vendor/admin).
PATCH	/api/products/:id	Update product (owner vendor/admin).
DELETE	/api/products/:id	Delete product (owner vendor/admin).
Cart
Method	Path	Description
GET	/api/cart	Get current user cart.
POST	/api/cart/items	Add item to cart (productId, qty).
PATCH	/api/cart/items/:productId	Update quantity.
DELETE	/api/cart/items/:productId	Remove item.
DELETE	/api/cart	Clear cart.
Orders
Method	Path	Description
POST	/api/orders	Checkout current cart → creates order (requires Idempotency-Key header).
GET	/api/orders	List current user orders.
GET	/api/orders/:id	Get order + items (user/admin).
PATCH	/api/orders/:id/cancel	Cancel a PENDING order (user), restocks items.

Order status lifecycle (typical):

    PENDING → PAID → PARTIALLY_SHIPPED → SHIPPED

    PENDING → CANCELLED

    Refund flows can lead to REFUNDED

Payments (Stub Provider)
Method	Path	Description
POST	/api/payments/intents	Create payment intent for an order (orderId).
POST	/api/payments/webhook	Payment provider webhook (signature + idempotency + replay protection).

Webhook event types (stub):

    payment_succeeded

    payment_failed

    payment_refunded

Uploads
Method	Path	Description
POST	/api/uploads/products	Upload product images (multipart form-data images[]) vendor/admin.
POST	/api/uploads/products/:productId	Upload images and attach to product images[] vendor/admin.
Vendor
Method	Path	Description
GET	/api/vendor/orders	Vendor-scoped orders (only items for this vendor).
GET	/api/vendor/orders/:id	Vendor order details (only vendor items).
PATCH	/api/vendor/orders/:orderId/items/:itemId/ship	Mark a specific order item as shipped (vendor/admin).
Admin
Method	Path	Description
GET	/api/admin/orders	List all orders (filters + pagination, optional items).
GET	/api/admin/orders/:id	Order details + items.
PATCH	/api/admin/orders/:id/status	Change order status (state-machine enforced).
GET	/api/admin/metrics	Basic operational metrics (orders, revenue sum, etc.).
Examples
Register (Vendor)

curl -X POST "http://localhost:5000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Vendor One",
    "email":"vendor1@example.com",
    "password":"password123",
    "role":"vendor"
  }'

Example response:

{
  "token": "JWT_HERE",
  "user": {
    "id": "mongoObjectId",
    "email": "vendor1@example.com",
    "role": "vendor"
  }
}

Create Product (Vendor)

curl -X POST "http://localhost:5000/api/products" \
  -H "Authorization: Bearer VENDOR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "sku":"NX-2001",
    "title":"Nxt Mouse",
    "price":25,
    "stock":50,
    "categories":["electronics"]
  }'

Add to Cart (User)

curl -X POST "http://localhost:5000/api/cart/items" \
  -H "Authorization: Bearer USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{ "productId":"PRODUCT_ID", "qty":2 }'

Checkout (Idempotent)

    Checkout requires Idempotency-Key. Reusing the same key returns the same checkout result and prevents duplicate orders.

curl -X POST "http://localhost:5000/api/orders" \
  -H "Authorization: Bearer USER_JWT" \
  -H "Idempotency-Key: checkout-00000001"

Example response:

{
  "orderId": "uuid-order-id",
  "status": "PENDING",
  "total": "50.00"
}

Create Payment Intent

curl -X POST "http://localhost:5000/api/payments/intents" \
  -H "Authorization: Bearer USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{ "orderId":"uuid-order-id" }'

Simulate Webhook (payment_succeeded)

Signature algorithm (stub):

    signature = sha256(eventId + PAYMENTS_WEBHOOK_SECRET) (hex)

Compute signature:

node -e "const crypto=require('crypto'); const eventId='evt_1'; const secret=process.env.PAYMENTS_WEBHOOK_SECRET; console.log(crypto.createHash('sha256').update(eventId+secret).digest('hex'))"

Call webhook:

curl -X POST "http://localhost:5000/api/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "x-webhook-signature: <SIGNATURE>" \
  -d '{
    "eventId":"evt_1",
    "type":"payment_succeeded",
    "data":{"orderId":"uuid-order-id"}
  }'

Upload Product Images (Vendor)

curl -X POST "http://localhost:5000/api/uploads/products" \
  -H "Authorization: Bearer VENDOR_JWT" \
  -F "images=@/path/to/img1.jpg" \
  -F "images=@/path/to/img2.png"

Vendor Ships an Item

curl -X PATCH "http://localhost:5000/api/vendor/orders/<ORDER_ID>/items/<ITEM_ID>/ship" \
  -H "Authorization: Bearer VENDOR_JWT"

Folder Structure & Architecture

A typical structure (may include additional files/scripts):

.
├─ src/
│  ├─ config/               # env, DB clients, logger, redis, payments config
│  ├─ db/
│  │  ├─ migrations/        # Umzug migrations
│  │  └─ umzug.js           # migration runner
│  ├─ middleware/           # auth, validation, idempotency, rate limiters, error handling
│  ├─ modules/
│  │  ├─ auth/              # register/login, JWT issuing
│  │  ├─ users/             # user model (Mongo)
│  │  ├─ products/          # product model + CRUD (Mongo)
│  │  ├─ cart/              # cart model + endpoints (Mongo)
│  │  ├─ orders/            # checkout, order state machine, SQL order models/services
│  │  ├─ payments/          # payment intents + webhook handler (SQL)
│  │  ├─ uploads/           # multer config + upload endpoints
│  │  ├─ vendor/            # vendor order views + fulfillment
│  │  ├─ admin/             # admin order management + metrics
│  │  └─ audit/             # audit logging (SQL)
│  ├─ sockets/              # Socket.IO setup + room joining
│  ├─ core-http/            # standalone health server
│  ├─ scripts/              # migrate, seed, smoke
│  └─ server.js             # bootstraps app + DBs + sockets + health server
├─ tests/                   # Jest + Supertest integration tests
├─ postman/                 # Postman collection + environment (optional)
└─ README.md

Architecture layers

    Routes: define HTTP endpoints and compose middleware.

    Controllers: request/response shaping and parameter extraction.

    Services: business logic (checkout, shipping, state transitions).

    Models:

        Mongo (Mongoose): products, carts, users

        SQL (Sequelize): orders, items, idempotency, payment intents, audit logs

    Middleware: auth (JWT), validation, idempotency guard, rate limiters, error handling.

    Infrastructure: DB connectors, logger, sockets, migrations, scripts.

Health Server Deployment Notes

NxtMarket includes a lightweight separate HTTP server for operational checks.

    Default port: HEALTH_PORT (e.g., 4000)

    Endpoints:

        GET /health → { ok: true, uptime, memory }

        GET /metrics → basic metrics (e.g., request log size)

Deployment recommendations

    Run health server on an internal interface (private network or localhost behind a reverse proxy).

    Use it for Kubernetes liveness/readiness checks or external uptime monitors (restricted).

    Keep /metrics low-cardinality; do not expose sensitive operational data publicly.

Optional Redis Caching Notes

Redis can be enabled by setting:

REDIS_URL=redis://localhost:6379

Recommended caching targets:

    Public product list queries (GET /api/products) with a short TTL (e.g., 30–120s)

    Product by ID/SKU read-through cache

    Rate limiting storage (if you later switch from memory store to Redis store)

Cache invalidation guidelines:

    On product create/update/delete, invalidate keys for:

        product detail (product:<id>)

        product list/search caches (products:*)

    Keep TTL short for list endpoints to reduce complexity.

If Redis is unavailable:

    The application should degrade gracefully (skip caching, continue serving from DB).

    Ensure Redis connection errors do not crash the API process.

Operational Notes

    Use a dedicated Postgres database for tests (nxtmarket_test) because the test harness may drop tables/enums.

    Treat PAYMENTS_WEBHOOK_SECRET as sensitive; rotate per environment.

    Prefer migrations over sync({ alter: true }) in all non-local environments.

    Use Idempotency-Key for any endpoint that creates side effects and may be retried by clients (checkout, payment intent creation, etc.).

License

Add your preferred license information here.


If you want, I can tailor the endpoint list and env variables to match your **exact current repository state** by scanning your project tree—then regenerate the README so it is 100% aligned with the code you have locally.

```
