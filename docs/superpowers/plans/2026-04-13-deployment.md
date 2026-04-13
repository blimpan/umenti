# Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy all three Metis services — Next.js frontend, Express API, and Python SymPy service — so the app is fully accessible online, with CI/CD that automatically redeploys only the affected service on every push to `main`.

**Architecture:** Frontend on Vercel (native Next.js support, global CDN), API and SymPy service on Railway (same project, private networking so SymPy is never publicly exposed). The monorepo structure requires the API to be built from the repo root so pnpm can resolve the `@metis/types` workspace package; Railway handles this via a root-level `railway.toml`. Path-based deploy filtering prevents unrelated pushes from triggering unnecessary rebuilds.

**Tech Stack:** Vercel (Next.js hosting), Railway (Node.js + Python hosting), pnpm workspaces, Prisma migrations on startup, Railway private networking, Railway `watchPatterns`, Vercel `ignoreCommand`

---

## File Map

| File | Change |
|------|--------|
| `sympy-service/railway.toml` | **Create** — Railway config for Python service, with `watchPatterns` scoped to `sympy-service/**` |
| `railway.toml` | **Create** — Railway config for the API (at repo root, required for monorepo workspace resolution), with `watchPatterns` scoped to `apps/api/**` and `packages/**` |
| `apps/web/vercel.json` | **Create** — Vercel `ignoreCommand` to skip frontend builds when only API/SymPy files changed |
| `apps/api/package.json` | **Modify** — add `prisma migrate deploy` to the `start` script |
| `apps/api/src/index.ts` | **Modify** — lock CORS to `FRONTEND_URL` env var in production |

---

## Task 1: Add Railway config for the SymPy service

**Files:**
- Create: `sympy-service/railway.toml`

Railway reads `railway.toml` from the service's root directory. `watchPatterns` tells Railway to only trigger a redeploy when files inside `sympy-service/` change — a push that only touches `apps/api/` will be ignored by this service.

- [ ] **Step 1: Create `sympy-service/railway.toml`**

```toml
[build]
builder = "RAILPACK"
watchPatterns = ["sympy-service/**"]

[deploy]
startCommand = "uvicorn main:app --host 0.0.0.0 --port $PORT"
healthcheckPath = "/docs"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

- [ ] **Step 2: Commit**

```bash
git add sympy-service/railway.toml
git commit -m "chore: add Railway deployment config for sympy-service"
```

---

## Task 2: Add Railway config for the API

**Files:**
- Create: `railway.toml` (repo root)

The API service's root directory in Railway is set to `/` (repo root) so that pnpm can see `pnpm-workspace.yaml` and resolve `@metis/types`. Railway therefore reads `railway.toml` from the repo root. `watchPatterns` ensures this service only redeploys when API code or shared types change.

- [ ] **Step 1: Create `railway.toml` at the repo root**

```toml
[build]
builder = "RAILPACK"
buildCommand = "pnpm install --frozen-lockfile && pnpm --filter @metis/api build"
watchPatterns = ["apps/api/**", "packages/**"]

[deploy]
startCommand = "pnpm --filter @metis/api start"
healthcheckPath = "/health"
healthcheckTimeout = 30
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

- [ ] **Step 2: Commit**

```bash
git add railway.toml
git commit -m "chore: add Railway deployment config for api service"
```

---

## Task 3: Add Vercel ignore command for the frontend

**Files:**
- Create: `apps/web/vercel.json`

Vercel's `ignoreCommand` is executed within the Root Directory (`apps/web`), confirmed by the official docs. Exit 0 = skip the build; exit 1 = continue the build. The command checks two paths: `./` (the `apps/web` directory) and `../../packages/types` (relative from `apps/web` to `packages/types` at the repo root). A push that only touches `apps/api/` or `sympy-service/` will not trigger a frontend rebuild. A change to shared types will correctly trigger both the API and the frontend.

- [ ] **Step 1: Create `apps/web/vercel.json`**

```json
{
  "ignoreCommand": "git diff --quiet HEAD^ HEAD -- ./ ../../packages/types"
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/vercel.json
git commit -m "chore: skip Vercel builds when only non-frontend files changed"
```

---

## Task 4: Update API start script to run migrations

**Files:**
- Modify: `apps/api/package.json`

In production, the database schema must be up to date before the server starts. `prisma migrate deploy` applies any pending migrations non-interactively. The schema already declares `directUrl = env("DIRECT_URL")` which Prisma uses for migrations — so Railway just needs both `DATABASE_URL` and `DIRECT_URL` set in the environment.

- [ ] **Step 1: Update the `start` script in `apps/api/package.json`**

Replace:
```json
"start": "node dist/index.js",
```
With:
```json
"start": "prisma migrate deploy && node dist/index.js",
```

- [ ] **Step 2: Verify the build script still works locally**

```bash
cd apps/api && pnpm build
```
Expected: `dist/` directory is created with compiled JS files. No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json
git commit -m "chore: run prisma migrate deploy before api start in production"
```

---

## Task 5: Lock CORS to the production frontend URL

**Files:**
- Modify: `apps/api/src/index.ts`

The API currently runs `app.use(cors())` which accepts requests from any origin. In production this should only allow the Vercel frontend domain. A `FRONTEND_URL` env var controls this — when unset (local dev), it falls back to `*` (allow all), preserving the local development experience.

- [ ] **Step 1: Update CORS config in `apps/api/src/index.ts`**

Replace:
```typescript
app.use(cors())
```
With:
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL ?? '*',
}))
```

- [ ] **Step 2: Verify the API still starts locally**

```bash
cd apps/api && pnpm dev
```
Expected: `API running on http://localhost:3001` in the terminal. No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "chore: restrict CORS to FRONTEND_URL in production"
```

---

## Task 6: Push to GitHub

Railway and Vercel both deploy from GitHub. Push `main` to trigger the first round of deployments.

- [ ] **Step 1: Push to GitHub**

```bash
git push origin main
```
Expected: Branch pushed. All commits from Tasks 1–5 are on the remote.

---

## Task 7: Deploy SymPy service to Railway

Done via the Railway dashboard. No additional code changes.

- [ ] **Step 1: Create a Railway account** at [railway.app](https://railway.app) if you don't have one.

- [ ] **Step 2: Create a new Railway project**
  - Click "New Project" → "Deploy from GitHub repo"
  - Select the `metis` repository
  - When asked which service to create, choose "Empty service"

- [ ] **Step 3: Configure the SymPy service**
  - Service settings → "Source" tab
  - Set **Root Directory** to `sympy-service`
  - Railway will detect `requirements.txt` and read `railway.toml` from that directory
  - Set **Service Name** to `sympy-service`

- [ ] **Step 4: Set environment variables for SymPy** (Settings → Variables)
  - No custom variables needed — Railway sets `PORT` automatically

- [ ] **Step 5: Connect GitHub for auto-deploy**
  - Settings → "Source" tab → confirm the branch is set to `main`
  - Railway will now redeploy automatically on every push that matches `watchPatterns = ["sympy-service/**"]`

- [ ] **Step 6: Deploy and verify**
  - Click "Deploy". Watch the build logs — expect: `Uvicorn running on http://0.0.0.0:<PORT>`
  - Once deployed, click the service's public URL and append `/docs`
  - Expected: FastAPI auto-generated Swagger UI loads

- [ ] **Step 7: Copy the private networking hostname**
  - Service settings → "Networking" tab
  - Find the **Private Domain** (format: `sympy-service.railway.internal`)
  - Save this — needed in Task 8

---

## Task 8: Deploy the API to Railway

- [ ] **Step 1: Add a second service to the same Railway project**
  - In the Railway project, click "+ New Service" → "GitHub Repo" → same `metis` repo
  - Set **Service Name** to `api`

- [ ] **Step 2: Configure the root directory**
  - Settings → "Source" tab
  - Set **Root Directory** to `/` (repo root)
  - Railway will read `railway.toml` from the repo root, which already defines the build and start commands

- [ ] **Step 3: Connect GitHub for auto-deploy**
  - Confirm branch is set to `main`
  - Railway will now redeploy automatically on every push that matches `watchPatterns = ["apps/api/**", "packages/**"]`

- [ ] **Step 4: Set environment variables** (Settings → Variables)

  Copy values from your local `apps/api/.env` file:

  | Variable | Value |
  |----------|-------|
  | `DATABASE_URL` | Your Supabase pooler connection string (port 6543) |
  | `DIRECT_URL` | Your Supabase direct connection string (port 5432) |
  | `SUPABASE_PROJECT_URL` | Your Supabase project URL |
  | `SUPABASE_SECRET_KEY` | Your Supabase service role key |
  | `SYMPY_SERVICE_URL` | `http://sympy-service.railway.internal` (private hostname from Task 7, Step 7) |
  | `UPSTASH_REDIS_REST_URL` | Your Upstash Redis REST URL |
  | `UPSTASH_REDIS_REST_TOKEN` | Your Upstash Redis token |
  | `LLM_PROVIDER` | `anthropic` (or whichever you use in prod) |
  | `ANTHROPIC_API_KEY` | Your Anthropic API key |
  | `OPENAI_API_KEY` | Your OpenAI API key (if used) |
  | `GOOGLE_GENERATIVE_AI_API_KEY` | Your Google AI key (if used) |
  | `FRONTEND_URL` | Leave blank for now — fill in after Vercel deploy in Task 9 |

  Note: Do NOT set `SCORE_DECAY_UNIT` in production (leave unset = defaults to `weeks`).

- [ ] **Step 5: Deploy and verify**
  - Click "Deploy". Watch build logs — expect: TypeScript compilation, then `prisma migrate deploy` output, then `API running on http://localhost:<PORT>`
  - Once deployed, open the public URL + `/health`
  - Expected response: `{"status":"ok"}`

- [ ] **Step 6: Copy the API's public URL**
  - Settings → "Networking" tab → public domain (e.g. `api-production-xxxx.up.railway.app`)
  - Save this — needed for Vercel env vars in Task 9

---

## Task 9: Deploy the frontend to Vercel

- [ ] **Step 1: Create a Vercel account** at [vercel.com](https://vercel.com) if you don't have one.

- [ ] **Step 2: Import the repository**
  - Click "Add New Project" → import the `metis` GitHub repo
  - Framework Preset: **Next.js** (auto-detected)
  - **Root Directory**: Set to `apps/web`

  > Vercel is smart about pnpm workspaces — when Root Directory is a sub-package, it automatically runs `pnpm install` from the repo root so workspace dependencies like `@metis/types` resolve correctly. The `vercel.json` `ignoreCommand` will be picked up from `apps/web/vercel.json`.

- [ ] **Step 3: Connect GitHub for auto-deploy**
  - Confirm branch is set to `main`
  - Vercel will now auto-deploy on every push, but skip the build when `ignoreCommand` exits 0 (no changes in `apps/web` or `packages/types`)

- [ ] **Step 4: Set environment variables** (Project Settings → Environment Variables, before first deploy)

  | Variable | Value |
  |----------|-------|
  | `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
  | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Your Supabase anon (publishable) key |
  | `NEXT_PUBLIC_API_URL` | The Railway API public URL from Task 8 Step 6 (e.g. `https://api-production-xxxx.up.railway.app`) |

- [ ] **Step 5: Deploy**
  - Click "Deploy"
  - Watch build logs — expect: `pnpm install`, Next.js compilation, then "Build Completed"
  - Once deployed, copy the Vercel public URL (e.g. `metis-web.vercel.app`)

- [ ] **Step 6: Update `FRONTEND_URL` in Railway API**
  - Railway API service → Variables
  - Set `FRONTEND_URL` to the Vercel URL (e.g. `https://metis-web.vercel.app`)
  - Railway will automatically redeploy the API with the updated CORS setting

---

## Task 10: End-to-end smoke test

Verify all three services are wired together correctly.

- [ ] **Step 1: Test the SymPy service directly**

  Open `https://<sympy-railway-url>/docs` in a browser.
  Expected: FastAPI Swagger UI. Try the `/normalize` endpoint with `{"latex": "x^2"}`.
  Expected response: `{"sympyExpr": "x**2"}`

- [ ] **Step 2: Test the API health**

  ```bash
  curl https://<api-railway-url>/health
  ```
  Expected: `{"status":"ok"}`

- [ ] **Step 3: Test the frontend loads**

  Open the Vercel URL. Expected: Login/signup page renders. No console errors about missing env vars.

- [ ] **Step 4: Test full auth flow**

  Sign up or log in with an existing account. Expected: Redirected to the correct dashboard (teacher or student).

- [ ] **Step 5: Test a math exercise (end-to-end SymPy integration)**

  As a student, submit a math answer on any exercise. Expected: The answer is graded (no "sympy unreachable" errors in Railway API logs). Check Railway logs for `[sympy] check-equivalence` log lines to confirm the API is successfully calling the SymPy service over private networking.

- [ ] **Step 6: Verify path-filtered CI/CD works**

  Make a trivial change to a file only in `sympy-service/` (e.g. add a comment to `main.py`), commit and push.
  Expected:
  - Railway SymPy service: redeploy triggered
  - Railway API service: no redeploy (push didn't match `watchPatterns`)
  - Vercel: build skipped (`ignoreCommand` exits 0)

---

## CI/CD Behaviour Summary

After setup, every `git push origin main` triggers:

| Changed path | SymPy redeploys? | API redeploys? | Frontend redeploys? |
|---|---|---|---|
| `sympy-service/**` | ✓ | — | — |
| `apps/api/**` | — | ✓ | — |
| `packages/types/**` | — | ✓ | ✓ |
| `apps/web/**` | — | — | ✓ |
| `apps/api/**` + `apps/web/**` | — | ✓ | ✓ |
| `packages/types/**` + `apps/web/**` | — | ✓ | ✓ |

---

## Environment Variable Reference

### Railway — SymPy service
*(No manual variables needed — Railway sets `PORT` automatically)*

### Railway — API
```
DATABASE_URL
DIRECT_URL
SUPABASE_PROJECT_URL
SUPABASE_SECRET_KEY
SYMPY_SERVICE_URL=http://sympy-service.railway.internal
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
LLM_PROVIDER
ANTHROPIC_API_KEY
OPENAI_API_KEY               (if used)
GOOGLE_GENERATIVE_AI_API_KEY (if used)
FRONTEND_URL                 (Vercel URL, set after Task 9)
PORT                         (set by Railway automatically)
```

### Vercel — Frontend
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_API_URL      (Railway API public URL)
```
