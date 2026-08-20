-- Step A: Delete email duplicates, keep oldest per (customer_id, email)
DELETE FROM contacts
WHERE id NOT IN (
  SELECT DISTINCT ON (customer_id, LOWER(TRIM(email)))
    id
  FROM contacts
  WHERE email IS NOT NULL AND customer_id IS NOT NULL
  ORDER BY customer_id, LOWER(TRIM(email)), created_at ASC
)
AND email IS NOT NULL
AND customer_id IS NOT NULL;

-- Step B: Delete phone-only duplicates (no email), keep oldest per (customer_id, phone)
DELETE FROM contacts
WHERE id NOT IN (
  SELECT DISTINCT ON (customer_id, phone)
    id
  FROM contacts
  WHERE phone IS NOT NULL AND email IS NULL AND customer_id IS NOT NULL
  ORDER BY customer_id, phone, created_at ASC
)
AND phone IS NOT NULL AND email IS NULL AND customer_id IS NOT NULL;

-- Step C: Add partial unique index to prevent future email duplicates
CREATE UNIQUE INDEX IF NOT EXISTS contacts_unique_customer_email
  ON contacts (customer_id, LOWER(TRIM(email)))
  WHERE email IS NOT NULL AND customer_id IS NOT NULL;