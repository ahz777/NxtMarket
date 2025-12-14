# NxtMarket (Plain HTML Version)

## Setup

1. **Environment**: Copy `.env.example` to `.env` and set `MONGO_URI`, `SQL_URI`, `JWT_SECRET`, `PORT`, and `HEALTH_PORT`.
2. **Install dependencies**: Run `npm install` in the project root.
3. **Seed databases**: Import data from the files in the `data/` directory for MongoDB and SQL.
4. **Start servers**: Run `npm run dev` to start the Express server and ensure the health server is running on its port.
5. **Visit** `/catalog` to see the catalog page rendered with plain HTML templates.

## Documentation

See `docs/OVERVIEW.md`, `docs/DESCRIPTION.md`, and `docs/REQUIREMENTS.md` for comprehensive project details.
