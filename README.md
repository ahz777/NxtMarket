# NxtMarket

A full-stack Node.js backend for a multi-vendor marketplace. It blends MongoDB (catalog, users, carts) with PostgreSQL + Sequelize (orders, payments, audit logs) and ships production-friendly features such as idempotent checkout, webhook replay protection, and Socket.IO order notifications.

---

## Project Overview

- Purpose: serve as a robust backend foundation for marketplaces with vendors, buyers, and admins.
- Data model split: MongoDB for domain/catalog; Postgres for transactional order/payment data.
- Operational extras: health server, structured logging, optional Redis caching, file uploads, and Socket.IO notifications.

## Tech Stack

- Node.js + Express
- MongoDB + Mongoose
- PostgreSQL + Sequelize (runtime `sequelize.sync()` creates tables/enums)
- Socket.IO for real-time order updates
- Multer for local file uploads
- Winston for logging
- Optional Redis client (disabled by default)

---

## Setup & Installation

Refer to Setup & Installation.md

## API Endpoints

**API Tests**

Refer to curl_scripts.md

**Auth**

- POST `/api/auth/register` ? create user/vendor/admin (role-based)
- POST `/api/auth/login` ? login, returns JWT
- GET `/api/auth/me` ? current user profile

**Products**

- GET `/api/products` ? list with filters/pagination
- GET `/api/products/:id` ? product detail
- POST `/api/products` ? create (vendor/admin)
- PATCH `/api/products/:id` ? update (owner vendor/admin)
- DELETE `/api/products/:id` ? remove (owner vendor/admin)

**Cart**

- GET `/api/cart` ? fetch current cart
- POST `/api/cart/items` ? add item `{ productId, qty }`
- PATCH `/api/cart/items/:productId` ? update quantity
- DELETE `/api/cart/items/:productId` ? remove item
- DELETE `/api/cart` ? clear cart

**Orders**

- POST `/api/orders` ? checkout current cart (requires `Idempotency-Key` header)
- GET `/api/orders` ? list user orders
- GET `/api/orders/:id` ? order details + items
- PATCH `/api/orders/:id/cancel` ? cancel PENDING order

**Payments (stub provider)**

- POST `/api/payments/intents` ? create payment intent for an order
- POST `/api/payments/webhook` ? webhook receiver with signature + replay protection

**Uploads**

- POST `/api/uploads/products` ? upload product images (multipart, `images[]`)

**Vendor**

- GET `/api/vendor/orders` ? vendor-facing order view
- PATCH `/api/vendor/orders/:orderId/items/:itemId/ship` ? mark item shipped

**Admin**

- GET `/api/admin/orders` ? admin list
- GET `/api/admin/orders/:id` ? admin order detail

**Health**

- GET `/health` ? basic readiness
- GET `/metrics` ? lightweight metrics

---

## Folder Structure & Architecture

```
src/
  config/          # env, DB clients, logger, redis config
  middleware/      # auth, validation, idempotency, rate limiters, error handling
  modules/         # domain modules (auth, users, products, cart, orders, payments, uploads, vendor, admin, audit)
  sockets/         # Socket.IO setup + room joining
  core-http/       # standalone health server
  scripts/         # seed utilities
  server.js        # bootstraps app + DBs + sockets + health server
public/            # static assets (including uploads)
logs/              # application logs
```

**Architecture layers**

- Routes: define HTTP endpoints and compose middleware.
- Controllers: shape request/response and extract params.
- Services: business logic (checkout, shipping, state transitions).
- Models: Mongo (products, carts, users) and SQL via Sequelize (orders, items, idempotency, payment intents, audit logs).
- Infrastructure: DB connectors, logger, sockets, scripts.

---

## Health Server Deployment

- Runs separately under `HEALTH_PORT` (default 5001).
- Endpoints: `GET /health`, `GET /metrics`.
- Recommendation: bind to internal interface or behind reverse proxy; suitable for k8s liveness/readiness.

## Optional Redis Caching

- Enable with `REDIS_ENABLED=true` and `REDIS_URL`.
- Good targets: product list/detail caching, rate limiting storage.
- Keep TTLs short; degrade gracefully if Redis is unavailable.

---

## Notes

- Tables/enums are created automatically on startup; ensure the Postgres user can create tables and types.
- Use `Idempotency-Key` for order-creating endpoints to prevent duplicates.

---

For setup, installation & curl tests refer to
Setup & Installation.md
curl_scripts.md
