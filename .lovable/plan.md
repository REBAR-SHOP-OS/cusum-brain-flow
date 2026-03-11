

## Cancel 4 Scheduled Posts (March 11)

### What
Change the status of all 4 scheduled Instagram posts from `scheduled` back to `draft` so the cron job does not publish them.

### How
Run a single database update on the `social_posts` table:

```sql
UPDATE social_posts
SET status = 'draft', qa_status = 'needs_review'
WHERE status = 'scheduled'
  AND id IN (
    '04b73c43-5cac-46ed-a4b2-0f53903f64d6',
    'b89c8d2f-92e6-4239-836c-8e253ff3f5f1',
    'aea50175-ebc2-464e-84e3-aea4ae0a5001',
    'd32fcd46-8cfb-4da1-a3e0-15a7893fd884'
  );
```

This resets all 4 posts to draft/needs_review so nothing gets auto-published. No code changes needed — just a data update.

