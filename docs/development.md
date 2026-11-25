# Development

## Stack

| Part | Tech |
|---|---|
| Backend | Node.js 20+, Express 5, TypeScript, Zod, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL 17, Winston, Swagger UI, helmet, cors |
| Frontend | React 19, Vite, TypeScript, Tailwind CSS 3 |
| Tests | Vitest + Supertest against a real PostgreSQL test database |
| Scripts | PowerShell (installer, launcher), Windows batch (`start.cmd`, `nodehub.cmd`) |

Conventions follow [fullstack-ts-standards](https://github.com/MiguelSousa369/fullstack-ts-standards).

## Project layout

```
nodehub/
├── CLAUDE.md                  helpdesk rules Claude Code follows
├── README.md
├── docker-compose.yml         PostgreSQL (127.0.0.1:5433)
├── start.cmd                  database + build + run
├── nodehub.cmd                CLI entry point
├── backend/
│   ├── src/
│   │   ├── server.ts          app setup, routes, startup
│   │   ├── routes/            *.routes.ts
│   │   ├── controllers/       *.controller.ts
│   │   ├── services/          *.service.ts
│   │   ├── schemas/           *.schema.ts (Zod)
│   │   ├── middlewares/       *.middleware.ts
│   │   ├── lib/               prisma, tailscale, swagger
│   │   ├── utils/             logger, password, http-error
│   │   ├── docs/              OpenAPI YAML per resource
│   │   ├── cli/               nodehub CLI
│   │   └── generated/         Prisma client (generated, gitignored)
│   ├── prisma/                schema.prisma, migrations/, seed.ts, init/ (test DB)
│   ├── tests/                 API tests
│   └── .env.example
├── frontend/
│   └── src/
│       ├── App.tsx            manual router (Machines / History / Users)
│       ├── pages/             DashboardPage, HistoryPage, UsersPage, LoginPage
│       ├── components/        cards, dialogs, header
│       ├── hooks/             useMachines, useToast
│       ├── services/api.ts    fetch-based API client
│       └── types/index.ts     shared types
├── installer/                 client installer template
├── launcher/                  nodehub:// handler and registration
├── public-keys/               technicians' SSH public keys (not committed)
└── docs/
```

## Running in development

```powershell
docker compose up -d                       # PostgreSQL
cd backend; npm install; npm run dev       # API with reload on http://127.0.0.1:8737
cd frontend; npm install; npm run dev      # Vite on http://127.0.0.1:5173 (proxies /api)
```

## Scripts

**Backend** (`backend/`):

| Script | Does |
|---|---|
| `npm run dev` | Start with reload (`tsx watch`) |
| `npm run build` | Generate the Prisma client and compile to `dist/` (including the CLI) |
| `npm start` | Run the compiled server |
| `npm test` | API tests against `nodehub_test` |
| `npm run lint` | Type-check |
| `npm run db:migrate` | Create and apply a migration after editing `schema.prisma` |
| `npm run db:deploy` | Apply pending migrations (used by `start.cmd`) |
| `npm run seed` | First admin (if no users) |

**Frontend** (`frontend/`): `npm run dev`, `npm run build` (type-check + Vite build), `npm run lint`.

## Database changes

1. Edit `backend/prisma/schema.prisma`.
2. `npm run db:migrate -- --name <what_changed>`: creates `prisma/migrations/<timestamp>_<name>/`
   and regenerates the client.
3. Commit the schema and the migration together.

## Tests

`npm test` in `backend/` runs the API tests against a separate database, `nodehub_test`, created
by `backend/prisma/init/01-test-db.sql` on the container's first start. The test setup applies the
migrations and refuses to run against any database not named `nodehub_test` (unless
`DATABASE_URL_TEST` is set explicitly). Tailscale is mocked.

If the container was created before the init script existed, create the database once:

```powershell
docker exec nodehub-db psql -U nodehub -c "CREATE DATABASE nodehub_test OWNER nodehub;"
```

## Adding an endpoint

1. Zod schema in `schemas/<entity>.schema.ts` (export the schema and its inferred type).
2. Logic in `services/<entity>.service.ts` (no `req`/`res`).
3. Handler in `controllers/<entity>.controller.ts`: parse with Zod, call the service, respond;
   `next(err)` for unexpected errors; throw `HttpError(status, CODE, message)` for expected ones.
4. Route in `routes/<entity>.routes.ts`, mounted in `server.ts`.
5. OpenAPI in `docs/<entity>.yaml`.
6. Tests in `tests/`.
7. Client function in `frontend/src/services/api.ts`, types in `frontend/src/types/index.ts`.
8. New error codes: add them to [api.md](api.md).

## Conventions

- Code, comments, docs and UI in **English**.
- Backend files: `kebab-case` + type suffix (`machine.service.ts`).
- Errors: `{ error, code, details? }` with `UPPER_SNAKE` codes.
- Commits: one logical change per commit, imperative English messages
  (*Add …*, *Fix …*, *Document …*).
