

# Run Manual SQL on Live Database

## What's happening
You need to run this SQL directly on the **Live** database. This contains DML statements (DELETE, CREATE OR REPLACE FUNCTION) that the deployment system ignores in migration files.

## Action Required
Since you're already in the Cloud SQL editor view:

1. Make sure **Live** is selected (not Test)
2. Paste and run the full SQL block you shared
3. Confirm once it succeeds

I cannot run DML on Live from here — the migration tool only affects the Test environment, and per project memory, the deployment diff tool ignores data-modifying statements. You need to execute this manually in the SQL editor you currently have open.

**After you confirm it ran successfully**, I can proceed with any code changes if needed.

