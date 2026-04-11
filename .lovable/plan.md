

# New Edge Function: `vizzy-voice` — PersonaPlex Voice Bridge API

## What This Does
Creates a backend endpoint that your local PersonaPlex voice bridge can call to ask simple questions about your business data (orders, customers, leads, machines, cut plans) and get back plain English answers.

## Endpoint Details

| Field | Value |
|---|---|
| **Route** | `POST /vizzy-voice` |
| **Production URL** | `https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/vizzy-voice` |
| **Request Body** | `{ "text": "latest orders", "source": "personaplex" }` |
| **Response** | `{ "reply": "Your latest three orders are ..." }` |

## Implementation

### 1. Create `supabase/functions/vizzy-voice/index.ts`
- Uses `handleRequest` wrapper with `authMode: "none"` (internal bridge, no user auth)
- Parses `text` from body, lowercases it, matches against keyword patterns
- Queries via service client (read-only SELECT queries only)

### Supported Queries (v1)

| User Says (contains) | Query | Response Format |
|---|---|---|
| "how many orders" | `SELECT count(*) FROM orders` | "You currently have X orders." |
| "how many customers" | `SELECT count(*) FROM customers` | "You have X customers." |
| "how many leads" | `SELECT count(*) FROM leads` | "There are X leads in the pipeline." |
| "how many machines" | `SELECT count(*) FROM machines` | "You have X machines registered." |
| "how many cut plans" | `SELECT count(*) FROM cut_plans` | "There are X cut plans." |
| "latest orders" | `SELECT order_number, status FROM orders ORDER BY created_at DESC LIMIT 3` | Natural sentence listing the 3 orders with statuses |
| Anything else | — | "I can answer questions about orders, customers, leads, machines, and cut plans." |

### Error Handling
- Missing `text` field → `{ "error": "text field is required" }` (400)
- DB query failure → `{ "error": "..." }` (500)
- All responses include CORS headers

### 2. Add config entry to `supabase/config.toml`
```toml
[functions.vizzy-voice]
verify_jwt = false
```

## What You'll Call From Your Local Bridge

```
POST https://uavzziigfnqpfdkczbdo.supabase.co/functions/v1/vizzy-voice
Headers:
  Content-Type: application/json
  apikey: <your anon key>
Body:
  { "text": "latest orders", "source": "personaplex" }
```

## Scope
- 1 new file: `supabase/functions/vizzy-voice/index.ts`
- 1 line added to `supabase/config.toml`
- No database changes, no frontend changes

