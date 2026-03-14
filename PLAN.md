# BrainLS Prototype -- Task Breakdown

Source: [Documentation/BrainLS-prototype-TDD.md](Documentation/BrainLS-prototype-TDD.md)

The tasks below are ordered by dependency. Each task is designed to be:

- Completable by one developer in a focused session
- Independently validateable (clear "done" criteria)
- Small enough to code-review quickly

### Agent Operating Principle

The agent should problem-solve independently -- debug errors, research solutions, try alternatives, and fix issues on its own. Asking the user for help is a **last resort**, only after exhausting reasonable approaches.

### Design Decisions (resolved gaps in the TDD)

**Enum values:**

- User `status`: `active`, `suspended`, `archived`
- WorkspaceMember `role`: `owner`, `admin`, `editor`, `viewer`
- WorkspaceMember `status`: `invited`, `active`, `removed`
- Card `status`: `active`, `draft`, `archived`
- SRS `srsState`: `new`, `learning`, `review`, `relearning`
- Review `rating`: `again`, `hard`, `good`, `easy`
- Workspace `kind`: `personal`, `shared`
- Deck `discoveryStatus`: `unlisted`, `listed`, `featured` (default: `unlisted`)

**SRS algorithm:** SM-2. Well-documented, battle-tested. Isolated in `lib/srs.ts` so it can be swapped for FSRS later.

**Passcode hashing:** bcrypt via `bcryptjs` (pure JS, no native deps).

**Better Auth + users table:** Extend Better Auth's `user` table with our additional columns (`username`, `status`, `personalWorkspaceId`, `archivedAt`). Better Auth's `name` serves as `displayName`, `image` as `avatarUrl`. One table, no sync.

**Pagination:** All list endpoints accept `limit` (default 50, max 100) + `offset` (default 0).

**Error handling:** Server actions return `{ success: true, data: T }` or `{ success: false, error: string, fieldErrors?: Record<string, string[]> }`. No throws.

**Card content schemas (prototype scope):**

- `front_back`: `{ front: string, back: string }`
- `multiple_choice`: `{ question: string, choices: string[], correctChoiceIndexes: number[] }`
- `cloze`, `image_occlusion`, `ai_question`: Deferred. Card type enum includes them but Zod schemas and UI are not built for the prototype. These card types are reserved for future implementation.

**UI approach:**

- Loading states: shadcn/ui Skeleton components
- Empty states: centered icon + descriptive text + primary action CTA
- Responsiveness: desktop-first, responsive by default via Tailwind. Study session UI gets explicit mobile attention.

### Documentation Requirements

Every task must produce documentation alongside code. Three types of docs live in the `Documentation/` folder:

1. **Task Specs** (`Documentation/tasks/task-NN-short-name.md`) -- One file per task. Created *before* the developer starts coding. Contains scope, acceptance criteria, dependencies, and files touched. Serves as the handoff brief.
2. **Developer Setup Guide** (`Documentation/setup-guide.md`) -- Created in Task 1, updated incrementally as new infrastructure is added (database in Task 4, auth in Task 11, uploads in Task 19).
3. **API Reference** (`Documentation/api-reference.md`) -- Created in Task 13 (first server actions). Each subsequent task that adds server actions / API routes appends its endpoints, inputs, outputs, and error cases to this file.

---

## Phase 1: Project Scaffolding

### Task 1 -- Initialize Next.js project with core tooling

Set up the foundational project shell.

- `npx create-next-app@latest` with App Router, TypeScript, Tailwind CSS, ESLint
- Add Prettier config + ESLint-Prettier integration
- Add Husky + lint-staged (lint + format on staged files)
- Create `.env.example` with placeholder values (see Environment Variables section below)
- Create `Documentation/setup-guide.md` covering: prerequisites (Node, npm), cloning, `npm install`, `npm run dev`, linting, and the env file
- Verify: `npm run dev` serves the default page, `npm run lint` passes, commit hook fires on `git commit`

### Task 2 -- Set up shadcn/ui, Lucide icons, and app layout shell

- Initialize shadcn/ui (`npx shadcn@latest init`)
- Install Lucide React icons
- Create a minimal root layout with a placeholder sidebar/nav and main content area
- Verify: app renders with a styled layout shell using shadcn components

### Task 3 -- Set up Vitest

- Install Vitest + config (`vitest.config.ts`)
- Add a trivial sample test to confirm the pipeline works
- Add `npm run test` script
- Verify: `npm run test` passes

---

## Phase 2: Database Foundation

### Task 4 -- Postgres + Drizzle ORM connection and migration pipeline

- Install `drizzle-orm`, `drizzle-kit`, `drizzle-zod`, `pg` (or `postgres`)
- Create `drizzle.config.ts` and `db/index.ts` connection module
- Configure `.env` for `DATABASE_URL`
- Update `Documentation/setup-guide.md` with: Postgres setup (local install or Docker one-liner), `DATABASE_URL` configuration, how to run migrations
- Verify: `npx drizzle-kit generate` and `npx drizzle-kit migrate` run successfully against a local Postgres instance (even with an empty schema)

### Task 5 -- Schema: Layer 1 (Identity) -- `users` table

Define the Drizzle schema for:

```
users: id, email, username, displayName, avatarUrl, status,
       personalWorkspaceId, createdAt, updatedAt, archivedAt
```

- Generate and run migration
- Verify: table exists in Postgres with correct columns, types, and unique constraints (`email`, `username`)

### Task 6 -- Schema: Layer 2 (Ownership) -- `workspaces`, `workspace_settings`, `workspace_members`

Define Drizzle schemas for all three tables per the TDD entity definitions:

- `workspaces`: id, name, slug, description, avatarUrl, kind, createdByUserId, timestamps
- `workspace_settings`: workspaceId (PK), allowPublicPublishing, allowMemberInvites, allowViewerDeckUse, settingsJson, updatedAt
- `workspace_members`: id, workspaceId, userId, role, status, joinedAt, timestamps
- FK references to `users` and `workspaces`
- Verify: migration runs, all three tables exist with correct FKs and constraints

### Task 7 -- Schema: Layer 3 (Content) -- `deck_definitions`, `card_definitions`, `assets`

Define Drizzle schemas:

- `deck_definitions`: id, workspaceId, title, slug, description, viewPolicy, usePolicy, forkPolicy, passcodeHash, shareToken (unique), createdByUserId, updatedByUserId, forkedFromDeckDefinitionId (self-ref FK), publishedAt, discoveryStatus, timestamps, archivedAt
- `card_definitions`: id, deckDefinitionId, cardType, status, contentJson, parentCardId (self-ref FK), parentVersionAtGeneration, version, createdByUserId, updatedByUserId, timestamps, archivedAt
- `assets`: id, workspaceId, kind, storageKey, mimeType, originalFilename, fileSizeBytes, createdAt
- Verify: migration runs, tables exist with all FKs

### Task 8 -- Schema: Layer 4 (Study State) -- `user_decks`, `user_card_states`, `review_logs`

Define Drizzle schemas:

- `user_decks`: id, userId, deckDefinitionId, srsConfigJson, srsConfigVersion, lastStudiedAt, timestamps, archivedAt
- `user_card_states`: id, userDeckId, cardDefinitionId, srsState, dueAt, intervalDays, easeFactor, reps, lapses, lastReviewedAt, srsVersionAtLastReview, timestamps
- `review_logs`: id, userDeckId, userCardStateId, cardDefinitionId, idempotencyKey, reviewedAt, rating, wasCorrect, responseMs, srsStateBefore/After, intervalDaysBefore/After, easeFactorBefore/After, srsVersionUsed, metadataJson, createdAt
- Verify: migration runs, tables exist, `review_logs` is append-only by design (no `updatedAt`)

---

## Phase 3: Validation Layer

### Task 9 -- Zod schemas for card content types

Create Zod schemas for each `cardType` defined in TDD Section 6:

- `FrontBackCardSchema` -- `{ front: string, back: string }`
- `MultipleChoiceCardSchema` -- `{ question: string, choices: string[], correctChoiceIndexes: number[] }`
- `cloze`, `image_occlusion`, `ai_question` are reserved in the card type enum but schemas are deferred
- Create a discriminated resolver: given a `cardType` string, return the correct schema (returns null/throws for deferred types)
- Write Vitest unit tests for each schema (valid + invalid payloads)
- Verify: all tests pass

### Task 10 -- Zod schemas for API mutation inputs

Create Zod input schemas for key mutations:

- CreateWorkspace, UpdateWorkspace
- InviteWorkspaceMember, UpdateMemberRole
- CreateDeck, UpdateDeck
- CreateCard, UpdateCard
- SubmitReview
- Write Vitest tests for representative valid/invalid inputs
- Verify: all tests pass

---

## Phase 4: Authentication

### Task 11 -- Better Auth integration

- Install and configure Better Auth with session-based authentication
- Set up sign-up, sign-in, sign-out server actions / route handlers
- Connect Better Auth to the `users` table (or its own table with a link)
- Update `Documentation/setup-guide.md` with: Better Auth env vars, how to generate `BETTER_AUTH_SECRET`
- Verify: a user can sign up, sign in, and sign out; session is persisted; protected routes redirect unauthenticated users

### Task 12 -- Auto-create personal workspace on sign-up

- On successful registration, create a personal `workspace` (kind: `personal`) and set `users.personalWorkspaceId`
- Create corresponding `workspace_settings` row with defaults
- Create `workspace_members` row (role: `owner`)
- This should be transactional
- Verify: after sign-up, user has a personal workspace; querying `workspaces` and `workspace_members` confirms the records

---

## Phase 5: Workspace Features

### Task 13 -- Workspace CRUD operations

- Server actions / API routes: create workspace, get workspace, update workspace, archive workspace
- Workspace `slug` auto-generation from `name`
- Validate inputs with Zod schemas from Task 10
- Create `Documentation/api-reference.md` and document the workspace endpoints (inputs, outputs, error cases)
- Verify: can create a shared workspace, fetch it by ID/slug, update its name, archive it

### Task 14 -- Workspace member management

- Server actions: invite member (creates `workspace_members` with status `invited`), accept invite, update role, remove member
- Enforce role hierarchy: only `owner`/`admin` can invite or change roles
- Append member management endpoints to `Documentation/api-reference.md`
- Verify: invite flow works end-to-end; role changes enforce hierarchy

### Task 15 -- Centralized permission module

Build `lib/permissions.ts` (or similar) as specified in TDD Section 10.

This module must evaluate:

- Workspace role of the acting user
- Deck-level policies (view, use, fork)
- Workspace settings (allowPublicPublishing, allowMemberInvites, allowViewerDeckUse)
- Share tokens and passcodes

Expose functions like: `canViewDeck(user, deck)`, `canEditDeck(user, deck)`, `canForkDeck(user, deck)`, `canUseDeck(user, deck)`, `canManageMembers(user, workspace)`

- Write Vitest tests covering each policy combination
- Verify: all permission tests pass

---

## Phase 6: Deck and Card Content

### Task 16 -- Deck CRUD within a workspace

- Server actions: create deck, get deck, list decks in workspace, update deck, archive deck
- Set default sharing policies on creation (private, none, none)
- Enforce permissions via the module from Task 15
- Append deck CRUD endpoints to `Documentation/api-reference.md`
- Verify: authorized user can CRUD decks; unauthorized user is rejected

### Task 17 -- Card CRUD within a deck

- Server actions: create card, get card, list cards in deck, update card, archive card
- On create: validate `contentJson` against `cardType` using Zod schemas from Task 9; reject invalid payloads
- On update: increment `version`, validate new content, do NOT reset any SRS state (per TDD 3.4)
- Enforce workspace permissions
- Append card CRUD endpoints to `Documentation/api-reference.md`
- Verify: can create cards of each type with valid content; invalid content is rejected; version increments on edit

### Task 18 -- Deck sharing policy management

- Server actions: update deck `viewPolicy`, `usePolicy`, `forkPolicy`
- Generate / revoke `shareToken` for link-based sharing
- Set / clear `passcodeHash` for passcode-based access
- Append sharing policy endpoints to `Documentation/api-reference.md`
- Verify: policies update correctly; share tokens are unique; passcode hash is stored (not plaintext)

---

## Phase 7: Asset Management

### Task 19 -- UploadThing integration + Asset record creation

- Install and configure UploadThing
- Create upload route handler
- On successful upload callback: create `assets` row with storageKey, mimeType, originalFilename, fileSizeBytes, linked to workspace
- Update `Documentation/setup-guide.md` with: UploadThing account setup, `UPLOADTHING_TOKEN` configuration
- Append upload endpoints to `Documentation/api-reference.md`
- Verify: file uploads succeed; `assets` table has a corresponding row; file is retrievable via URL

### Task 20 -- Asset references in card content

- Update card creation/editing to allow `imageAssetId` (and similar) fields in `contentJson`
- Validate that referenced asset IDs exist in the same workspace
- Verify: can create an `image_occlusion` card referencing an uploaded asset; cross-workspace asset references are rejected

---

## Phase 8: Study System (Core Loop)

### Task 21 -- Add deck to study library

- Server action: "add deck to library" -- creates `UserDeck` + initial `UserCardState` rows for each active card in the deck
- Enforce `usePolicy` via permissions module
- Initial SRS state: `new`, `dueAt` = now, `easeFactor` = 2.5, `reps` = 0, `lapses` = 0
- Append add-to-library endpoint to `Documentation/api-reference.md`
- Verify: after adding a deck, `user_decks` and `user_card_states` rows exist; duplicate add is idempotent or rejected

### Task 22 -- SRS scheduling engine

- Implement core SRS algorithm (SM-2 or similar) as a pure function in `lib/srs.ts`
- Input: current `UserCardState` + review `rating`
- Output: next `srsState`, `dueAt`, `intervalDays`, `easeFactor`
- This is pure logic, no DB interaction
- Write comprehensive Vitest tests (new card, learning, review, lapse scenarios)
- Verify: all SRS tests pass; edge cases handled (first review, lapse, easy bonus)

### Task 23 -- Fetch due cards

- Server action / query: given a `userDeckId`, return cards where `dueAt <= now()`
- Join `user_card_states` with `card_definitions` to return card content alongside SRS state
- Verify: only due cards are returned; cards with future `dueAt` are excluded

### Task 24 -- Submit review + ReviewLog creation

- Server action: submit a review for a card
  - Accepts: `userCardStateId`, `rating`, `responseMs` (optional)
  - Calls SRS engine from Task 22 to compute new state
  - Updates `user_card_states` with new SRS values
  - Creates immutable `review_logs` row with before/after state snapshots
  - Uses `idempotencyKey` to prevent duplicate submissions
  - Updates `user_decks.lastStudiedAt`
- Append review submission + due cards endpoints to `Documentation/api-reference.md`
- Verify: after review, `user_card_states` reflects new SRS state; `review_logs` has the event; duplicate idempotency key is rejected

### Task 25 -- Review history query

- Server action: fetch review history for a user+card or user+deck
- Return `review_logs` ordered by `reviewedAt` descending
- Verify: history returns correct chronological data

---

## Phase 9: Deck Forking

### Task 26 -- Fork a deck

- Server action: fork a deck into a target workspace
- Enforce `forkPolicy` via permissions module
- Creates new `DeckDefinition` with `forkedFromDeckDefinitionId` set to original
- Deep-copies all active `CardDefinition` rows into the new deck (new IDs, reset version to 1)
- Does NOT copy any `UserDeck` / `UserCardState` data
- Append fork endpoint to `Documentation/api-reference.md`
- Verify: forked deck exists in target workspace; cards are independent copies; original deck is unmodified; fork lineage is recorded

---

## Phase 10: Seed Data + Developer Experience

### Task 27 -- Seed script

- Create `db/seed.ts` that populates:
  - 3+ sample users with personal workspaces
  - 1 shared workspace with multiple members (different roles)
  - 3+ decks across workspaces (different sharing policies)
  - 10+ cards of varying types per deck
  - Study state and review history for at least 1 user
  - 1-2 uploaded assets
- Add `npm run seed` script
- Verify: `npm run seed` populates all tables; app can query and display seed data

---

## Phase 11: UI -- Auth and Navigation

### Task 28 -- Auth UI (sign-up, sign-in, sign-out)

- Build sign-up and sign-in pages using shadcn/ui form components
- Wire to Better Auth actions from Task 11
- Add sign-out button in nav
- Protect app routes with auth middleware
- Verify: full auth flow works in the browser

### Task 29 -- Dashboard and workspace switcher

- After sign-in, show dashboard listing user's workspaces (personal + shared)
- Workspace switcher in sidebar/nav
- Clicking a workspace navigates to its detail view
- Verify: user sees their workspaces; can switch between them

---

## Phase 12: UI -- Core Content

### Task 30 -- Workspace detail + deck list view

- Show workspace name, description, members summary
- List all decks in the workspace (respect `viewPolicy`)
- "Create Deck" button for authorized users
- Verify: decks render correctly; create deck form works

### Task 31 -- Deck detail + card list view

- Show deck title, description, sharing policies
- List all cards in the deck with card type badges
- "Add Card" / "Edit Card" actions for authorized users
- Verify: cards render with correct type indicators; CRUD actions work

### Task 32 -- Card editor (by card type)

- Dynamic form that switches based on `cardType`
- `front_back`: two text fields
- `multiple_choice`: question + dynamic choice list + correct answer selection
- Validates with Zod schemas before submission
- Verify: can create and edit each card type; invalid content shows validation errors

---

## Phase 13: UI -- Study Experience

### Task 33 -- Study session UI

- "Study" button on a deck the user has added to their library
- Fetches due cards (Task 23)
- Displays card front, user flips to reveal back (or interacts per card type)
- User rates their recall (Again / Hard / Good / Easy or similar)
- Submits review (Task 24), advances to next card
- Shows session summary when no more due cards
- Verify: full study loop works; SRS state updates are reflected; session ends gracefully

### Task 34 -- Deck library + study progress view

- Show all decks in user's study library (`user_decks`)
- Display progress stats: cards due, cards learned, last studied
- "Add to Library" action from deck detail page (per use policy)
- Verify: library shows correct decks; stats reflect actual data; add-to-library respects policies

---

## Dependency Graph

```mermaid
graph TD
    T1[T1: Next.js Init] --> T2[T2: shadcn/ui Setup]
    T1 --> T3[T3: Vitest Setup]
    T1 --> T4[T4: Postgres + Drizzle]
    T4 --> T5[T5: Users Schema]
    T5 --> T6[T6: Workspace Schema]
    T6 --> T7[T7: Content Schema]
    T7 --> T8[T8: Study State Schema]
    T3 --> T9[T9: Card Zod Schemas]
    T3 --> T10[T10: API Zod Schemas]
    T5 --> T11[T11: Better Auth]
    T11 --> T12[T12: Auto Personal WS]
    T6 --> T12
    T6 --> T13[T13: Workspace CRUD]
    T10 --> T13
    T13 --> T14[T14: Member Mgmt]
    T6 --> T15[T15: Permissions Module]
    T9 --> T15
    T15 --> T16[T16: Deck CRUD]
    T7 --> T16
    T16 --> T17[T17: Card CRUD]
    T9 --> T17
    T16 --> T18[T18: Sharing Policies]
    T8 --> T19_upload[T19: UploadThing]
    T19_upload --> T20[T20: Asset Refs]
    T17 --> T20
    T8 --> T21[T21: Add to Library]
    T15 --> T21
    T3 --> T22[T22: SRS Engine]
    T21 --> T23[T23: Due Cards Query]
    T22 --> T24[T24: Submit Review]
    T23 --> T24
    T24 --> T25[T25: Review History]
    T15 --> T26[T26: Deck Forking]
    T17 --> T26
    T8 --> T27[T27: Seed Script]
    T11 --> T28[T28: Auth UI]
    T2 --> T28
    T28 --> T29[T29: Dashboard UI]
    T13 --> T29
    T29 --> T30[T30: WS Detail UI]
    T16 --> T30
    T30 --> T31[T31: Deck Detail UI]
    T17 --> T31
    T31 --> T32[T32: Card Editor UI]
    T9 --> T32
    T21 --> T33[T33: Study Session UI]
    T24 --> T33
    T33 --> T34[T34: Library + Progress]
end
```



---

## Git and Repository Setup

### Remote

- **Repo**: `git@github.com:WalkerFrederick/brainls-proto.git` (SSH)
- **Default branch**: `main`
- **Initial commit**: `.gitignore`, `.env.template`, `.cursorignore`

### Branch Protection (GitHub Ruleset -- already active)

The `main` branch is protected with a GitHub ruleset:

- All changes must go through a **pull request** (no direct pushes)
- Requires at least **1 approval** before merging
- **Force pushes blocked**
- **Branch deletion blocked**
- Once CI is set up (Task 3+), add required status checks (lint, test)

### Developer Workflow

- The agent works on a single long-running feature branch, committing after each completed task
- The branch stays open until the user decides to create a PR against `main`
- Commit messages reference the task number (e.g., `task-01: initialize Next.js project with core tooling`)
- The user will tell the agent when to push and/or open a PR

### Windows SSH Note

Git for Windows bundles its own SSH (`C:\Program Files\Git\usr\bin\ssh.exe`) which does not use the Windows OpenSSH agent. If `git push` fails with `Permission denied (publickey)` but `ssh -T git@github.com` works, set:

```powershell
[System.Environment]::SetEnvironmentVariable("GIT_SSH", "C:\Windows\System32\OpenSSH\ssh.exe", "User")
```

This is a one-time fix persisted in user environment variables.

### What Is Committed vs Ignored

- **Committed**: `.gitignore`, `.env.template`, `.cursorignore`
- **Gitignored**: `.env`, `.env.*` (except `.env.template`), `node_modules/`, `.next/`, `coverage/`, `Documentation/`
- **Cursorignored**: `.env`, `.env.*` (prevents Cursor from indexing secrets)
- `Documentation/` is kept local only (gitignored) -- it is not pushed to the remote

---

## Environment Variables You Need to Provide

The `.env` file is already configured with real values for all variables listed in `.env.template`. The agent cannot read `.env` (blocked by `.cursorignore`) but can trust that every variable in `.env.template` has a working value set locally.

### Required from Task 4 (Database)

- `DATABASE_URL` -- Postgres connection string
  - Format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`
  - Local dev example: `postgresql://postgres:postgres@localhost:5432/brainls`
  - You can use a local Postgres install, Docker (`docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres`), or a hosted service like Neon / Supabase / Railway

### Required from Task 11 (Authentication)

- `BETTER_AUTH_SECRET` -- Random string used to sign sessions (generate with `openssl rand -base64 32` or any random string generator)
- `BETTER_AUTH_URL` -- The base URL of the running app
  - Local dev: `http://localhost:3000`
- *(Optional, if you want social login)* OAuth provider credentials -- only if you choose to enable Google/GitHub sign-in:
  - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  - These are **not required** for the prototype -- email/password auth works without them

### Required from Task 19 (File Uploads)

- `UPLOADTHING_TOKEN` -- API token from your UploadThing dashboard
  - Sign up at [uploadthing.com](https://uploadthing.com), create an app, and copy the token
  - This is only needed when you reach Phase 7 (Asset Management), so it can wait

### Always present (framework defaults)

- `NEXT_PUBLIC_APP_URL` -- Public-facing app URL (used for generating share links, asset URLs, etc.)
  - Local dev: `http://localhost:3000`

### Summary `.env.example`

```
# Database (Task 4)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/brainls

# Auth (Task 11)
BETTER_AUTH_SECRET=replace-with-random-secret
BETTER_AUTH_URL=http://localhost:3000

# OAuth providers -- optional, only if enabling social login
# GITHUB_CLIENT_ID=
# GITHUB_CLIENT_SECRET=
# GOOGLE_CLIENT_ID=
# GOOGLE_CLIENT_SECRET=

# File uploads (Task 19)
UPLOADTHING_TOKEN=replace-with-uploadthing-token

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### When each variable is needed

- **Tasks 1-3**: No env vars needed (scaffolding only)
- **Tasks 4-8**: `DATABASE_URL`
- **Tasks 9-10**: No env vars needed (pure validation logic)
- **Tasks 11-12**: `DATABASE_URL` + `BETTER_AUTH_SECRET` + `BETTER_AUTH_URL`
- **Tasks 13-18**: Same as above
- **Tasks 19-20**: Add `UPLOADTHING_TOKEN`
- **Tasks 21+**: All of the above

---

## Notes for Task Handoff

- All tasks are committed to a single feature branch. PRs are created when the user requests one.
- **Before starting a task**, create (or verify) its task spec file at `Documentation/tasks/task-NN-short-name.md`. The spec should contain:
  - **Title** and one-line summary
  - **Dependencies** (which prior tasks must be complete)
  - **Scope** (what this task does and does not cover)
  - **Acceptance criteria** (bulleted checklist a reviewer can verify)
  - **Key files** (files expected to be created or modified)
- Tasks within the same phase can often be parallelized across developers (e.g., T9 and T10 can run in parallel; T22 has no DB dependency and can start as soon as Vitest is set up).
- The SRS engine (Task 22) is a great candidate for early development since it is pure logic with no infrastructure dependencies beyond Vitest.
- UI tasks (Phase 11-13) depend on backend tasks but can be stubbed/mocked if developers want to work in parallel.

### Documentation folder structure at completion

```
Documentation/
  BrainLS-prototype-TDD.md          (existing -- source of truth)
  setup-guide.md                     (created Task 1, updated Tasks 4, 11, 19)
  api-reference.md                   (created Task 13, appended by each API task)
  tasks/
    task-01-nextjs-init.md
    task-02-shadcn-setup.md
    task-03-vitest-setup.md
    task-04-postgres-drizzle.md
    task-05-users-schema.md
    task-06-workspace-schema.md
    task-07-content-schema.md
    task-08-study-state-schema.md
    task-09-card-zod-schemas.md
    task-10-api-zod-schemas.md
    task-11-better-auth.md
    task-12-personal-workspace.md
    task-13-workspace-crud.md
    task-14-member-management.md
    task-15-permissions-module.md
    task-16-deck-crud.md
    task-17-card-crud.md
    task-18-sharing-policies.md
    task-19-uploadthing.md
    task-20-asset-refs.md
    task-21-add-to-library.md
    task-22-srs-engine.md
    task-23-due-cards.md
    task-24-submit-review.md
    task-25-review-history.md
    task-26-deck-forking.md
    task-27-seed-script.md
    task-28-auth-ui.md
    task-29-dashboard-ui.md
    task-30-workspace-detail-ui.md
    task-31-deck-detail-ui.md
    task-32-card-editor-ui.md
    task-33-study-session-ui.md
    task-34-library-progress-ui.md
```

