# Repository Guidelines

## Project Structure & Module Organization

This is a small full-stack todo application split by runtime.

- `frontend/`: Vue 3 + Vite + TypeScript client. Code is in `frontend/src/`: `api/` for HTTP clients, `components/` for reusable UI, `views/` for route screens, `router/` for navigation, `stores/` for Pinia state, and `assets/` or `styles/` for resources.
- `backend/`: Fastify + TypeScript API. Code is in `backend/src/`: `routes/`, `services/`, `db/`, `types/`, and `utils/`.
- `deploy/`: `nginx.conf`, `todo-app.service`, and backup scripts.
- `docs/`: project notes.
- Ignored local outputs include `node_modules/`, `dist/`, `data/`, `.env`, logs, and SQLite `*.db*` files.

## Build, Test, and Development Commands

Use `pnpm` from the repository root unless working inside a package directly.

- `pnpm dev:backend`: starts the Fastify API with `tsx watch`.
- `pnpm dev:frontend`: starts the Vite development server.
- `pnpm build:backend`: compiles backend TypeScript to `backend/dist/`.
- `pnpm build:frontend`: runs `vue-tsc -b` and creates the Vite production build.
- `pnpm build`: builds backend and frontend in sequence.
- `cd backend && pnpm start`: runs the compiled backend from `dist/server.js`.

## Coding Style & Naming Conventions

Keep TypeScript strict and explicit at module boundaries. Frontend code uses Vue SFCs with `<script setup lang="ts">`; name components and views in PascalCase, such as `TodoRow.vue` and `TodoListView.vue`. Backend files use lowercase domain names such as `auth.ts` and `todo.ts`; keep route handlers thin and put business logic in `services/`. Match existing formatting: frontend omits semicolons, backend uses them.

## Testing Guidelines

No test framework or `test` script is currently configured. For now, verify changes with the relevant build command and manual UI/API checks. When adding tests, prefer colocated `*.test.ts` files or a package-level `tests/` folder, and add matching `pnpm test` scripts before relying on them in CI.

## Commit & Pull Request Guidelines

There is no established Git history in this checkout. Use concise, imperative commit messages, optionally with a conventional prefix, for example `fix: handle expired auth token`. Pull requests should include a summary, affected areas (`frontend`, `backend`, `deploy`), verification commands, linked issues when applicable, and screenshots for UI changes.

## Security & Configuration Tips

Do not commit `.env` files, database files, logs, or generated `data/` contents. Set `JWT_SECRET` in production instead of using the backend default. Document host paths or secrets in `docs/` rather than embedding them in code.
