## App Overview
An AI-native learning platform that adapts its pedagogy to each subject. Students engage actively with material through exercises and Socratic scaffolding grounded in teacher-uploaded curriculum. Teachers get AI-assisted grading, diagnostic analytics, and tools to build and manage course content.

## Core Principles
- **Scaffolding over Solving:** The AI never gives a direct answer to the problem being worked on. Every response is a Socratic push toward independent retrieval.
- **Grounded in Curriculum:** All AI responses must be grounded in teacher-uploaded materials. Sources must be cited.
- **Active Retrieval First:** Students must prove comprehension before advancing.
- **Spaced Repetition:** Concepts queue for review when too much time has passed since last demonstrated comprehension.
- **Personalization:** Student interests and prior knowledge are part of the AI's context.
- **Teacher as Final Arbiter:** AI assists and flags, but the teacher verifies, corrects, and intervenes.

## Tech Stack
- **Frontend:** Next.js (`apps/web`)
- **Backend:** Node.js + Express (`apps/api`)
- **Database:** Supabase (managed Postgres)
- **ORM:** Prisma (in `apps/api`)
- **Auth:** Supabase Auth
- **Monorepo:** pnpm workspaces

## Project Structure
```
apps/
  web/          Next.js frontend
  api/          Express backend
packages/
  types/        Shared TypeScript types (imported by both apps)
docs/
  design-spec.md                    UI design index + visual language
  design-specs/                     Per-page UI specs
  painpoints-and-features.md        Teacher/student pain points and feature rationale
  user-flows.md                     Key user flows
  future-planned-features.md        Backlog of planned features
```

## Key Architectural Decisions
- All database access goes through Express + Prisma. The Supabase client is used **only for auth** — never for direct DB queries from the frontend.
- Shared TypeScript types live in `packages/types` and are imported by both `apps/web` and `apps/api`. Define API response shapes there, not inline.
- The backend is a separate service, not Next.js Server Actions — this is intentional.

## API Conventions (`apps/api`)
- **Env var names:** `SUPABASE_PROJECT_URL` and `SUPABASE_SECRET_KEY` (not the Supabase defaults `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`)
- **Adding a route:** create a router in `src/routes/`, apply `requireAuth` middleware, register it in `src/index.ts` under `/api/<name>`
- **Auth middleware:** `requireAuth` in `src/middleware/auth.ts` verifies the JWT and attaches `{ id, email }` to `req.user`
- **Prisma migrations:** require a direct DB connection (session pooler, port 5432). The transaction pooler (port 6543) does not work for migrations.

## Supabase Client Usage (`apps/web`)
- `src/lib/supabase/client.ts` — browser Client Components only
- `src/lib/supabase/server.ts` — Server Components and Route Handlers only
- `src/middleware.ts` — cannot use either helper; must inline `createServerClient` directly (needs to write cookies to the response object)

## Routing
- Student dashboard: `/student/dashboard`
- Teacher dashboard: `/teacher/dashboard`
- Role is stored in Supabase `user_metadata.role` (set at signup) and in the Prisma `User` table
- Dark mode is disabled (light mode only). Do not re-add `.dark` CSS or `next-themes`.

## Docs Reference
- Working on a feature? Read `docs/painpoints-and-features.md` first for context on why it exists.
- Working on a page or UI component? Read the relevant spec in `docs/design-specs/`.
- Unsure what's planned vs. built? Check `docs/future-planned-features.md`.
