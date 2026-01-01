## Setup & Installation

### Prerequisites

- Node.js 18+
- MongoDB instance
- PostgreSQL instance (user with create-table permissions)

### Install dependencies

```bash
npm install
```

### Environment variables (.env example)

Create a .env file
Copy data from .env.example to .env
Change the data to fit your environment

### Database setup

- MongoDB: database is created on first write.
- PostgreSQL: create the primary database:

```sql
CREATE DATABASE nxtmarket;
```

### Seeding (dev data)

```bash
npm run db:seed
```

Creates default users:

- admin@nxt.com password: Admin@123
- vendor1@nxt.com password: Vendor@123
- alice@nxt.com password: User@123

### Run the app

```bash
npm run dev
```
