# Vizzy Web

AI-powered rebar & business management platform.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm (comes with Node.js)

## Setup

```sh
# 1. Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Fill in the values in .env with your Lovable Cloud / Supabase credentials

# 4. Start the dev server
npm run dev
```

> **Security:** Never commit `.env` to version control. Copy `.env.example` to `.env` and fill in your credentials locally.

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build locally |

## Tech Stack

- **React 18** + **TypeScript**
- **Vite** — build tooling
- **Tailwind CSS** + **shadcn/ui** — styling & components
- **Lovable Cloud** — backend (database, auth, edge functions, storage)
- **Framer Motion** — animations
- **TanStack Query** — data fetching
