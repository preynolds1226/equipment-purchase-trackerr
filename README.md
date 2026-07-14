# Equipment Purchase Tracker

Mobile-first purchasing request tracker for a heavy-equipment repair shop.

## Stack

- Next.js
- TypeScript
- Tailwind CSS
- Supabase-ready PostgreSQL schema and typed client

## Current Scope

- Responsive desktop and mobile navigation
- Light and dark mode styling
- Placeholder pages for the first workflow areas
- Supabase database migration for employees, vendors, requests, activity, and purchase history
- TypeScript database types

The UI is not connected to Supabase data yet.

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Supabase Setup

Create a Supabase project before connecting the app to live data.

### 1. Create a Supabase Project

1. Sign in to Supabase.
2. Create a new project.
3. Save the project URL and publishable key from Project Settings > API.

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local` and fill in your own values:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported for older Supabase projects, but new setup should use `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

Only use `SUPABASE_SERVICE_ROLE_KEY` in server-only code. Do not expose it in browser components.

### 3. Apply the Database Migration

Apply the SQL migration in:

```text
supabase/migrations/20260713204000_initial_schema.sql
```

You can apply it by either:

- Pasting the migration into the Supabase SQL Editor and running it.
- Using the Supabase CLI after linking this project to your Supabase project.

### 4. Confirm Authentication

In Supabase Authentication:

1. Enable the sign-in method you want to use first, such as email/password or magic links.
2. Add your local site URL for development: `http://localhost:3000`.
3. Add your deployed Vercel URL later.

The database uses Row Level Security. The included policies allow only authenticated users to read or change rows.

The app includes a `/login` page with email/password and magic-link sign-in. Protected app pages redirect to login when no Supabase session is active.

### 5. Request Defaults

The database automatically:

- Creates UUID primary keys.
- Sets `created_at` values.
- Updates `updated_at` on row changes.
- Generates request numbers like `REQ-000001`.
- Sets request `created_by` and activity `performed_by` from the authenticated Supabase user when available.
