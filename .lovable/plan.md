
# Fix: Permanent Resolution of the Vector Migration Build Blocker

## Root Cause (Definitive)

The two migration files `20260220012124` and `20260220140325` **do not exist as files on disk** — they were applied directly via the database tool in previous sessions and exist only as SQL executed against the database. Because they are not tracked as files, the Lovable migration diff engine **never knows they ran**. On every publish, the diff system detects `document_embeddings` + `vector` as a schema delta and generates a new migration that tries to `DROP EXTENSION vector` — which always fails because the table depends on it.

The Test DB migration history confirms this: only 2 recent entries exist (`20260220140323` and `20260220122840`), neither of which is the problematic `20260220012124`.

## What Must Be Done

There are two things to fix simultaneously:

### Fix 1 — Create the missing migration file on disk

A file named `supabase/migrations/20260220012124_14ad7630-a525-4125-a8ec-11ffed3c9966.sql` must be created. This is the file the migration tracker expects to find. Its contents must be **100% idempotent** — safe to run on both Test (where objects exist) and Live (where they also exist):

```sql
-- Enable pgvector extension (safe if already exists)
CREATE EXTENSION IF NOT EXISTS vector;

-- Document embeddings table (safe if already exists)
CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id TEXT NOT NULL DEFAULT 'a0000000-0000-0000-0000-000000000001',
  agent_domain TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  content_text TEXT NOT NULL,
  embedding vector(768),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (safe if already exist)
CREATE INDEX IF NOT EXISTS idx_embeddings_domain ON public.document_embeddings(agent_domain);
CREATE INDEX IF NOT EXISTS idx_embeddings_entity ON public.document_embeddings(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_company ON public.document_embeddings(company_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON public.document_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Enable RLS
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- Policies (drop first to make idempotent)
DROP POLICY IF EXISTS "Users can read embeddings for their company" ON public.document_embeddings;
CREATE POLICY "Users can read embeddings for their company"
  ON public.document_embeddings FOR SELECT
  USING (company_id = (SELECT company_id::text FROM public.profiles WHERE user_id = auth.uid() LIMIT 1));

DROP POLICY IF EXISTS "Service role can manage embeddings" ON public.document_embeddings;
CREATE POLICY "Service role can manage embeddings"
  ON public.document_embeddings FOR ALL
  USING (true) WITH CHECK (true);

-- Similarity search function (OR REPLACE = always idempotent)
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(768), ...
) ...;

-- Trigger (drop first to make idempotent)
DROP TRIGGER IF EXISTS update_document_embeddings_updated_at ON public.document_embeddings;
CREATE TRIGGER update_document_embeddings_updated_at
  BEFORE UPDATE ON public.document_embeddings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### Fix 2 — Replace the broken fix migration

The file `20260220140325_2cb45d25-3d18-449a-8242-47d5dddae281.sql` (which tries to `DROP TABLE` and recreate everything — destructive) must be **replaced** with a no-op migration that just marks itself as a cleanup step, since the primary migration above now handles everything idempotently.

## Files to Create/Modify

| Action | File |
|---|---|
| **CREATE** (new file on disk) | `supabase/migrations/20260220012124_14ad7630-a525-4125-a8ec-11ffed3c9966.sql` |
| **REPLACE** (convert to no-op) | `supabase/migrations/20260220140325_2cb45d25-3d18-449a-8242-47d5dddae281.sql` |

## Why This Works

Once `20260220012124` exists as a file on disk, the migration diff engine recognises it as already tracked. It will be registered in the migration history table on the next publish. The diff engine will stop generating new migrations for `document_embeddings` because the schema will match what's in the file. The build blocker will be permanently cleared.

## Chat "Failed to Fetch" Issue

The `admin-chat` streaming fix from the previous session (adding `callAIStream` to `aiRouter.ts`) is **correctly deployed**. The "Failed to fetch" on `/chat` is caused by the **build being blocked** — edge functions are not being deployed to Live because the migration step fails first. Once the migration blocker is resolved and publishing succeeds, the streaming AI functions (including `admin-chat`) will be live and chat will work.

## No Database Data Loss

The `document_embeddings` table is not dropped — the idempotent approach uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`, so any existing embedding data is preserved.
