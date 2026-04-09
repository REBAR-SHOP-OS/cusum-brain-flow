

# Rename Shape Code "TYPE T3" to "TYPE T3a"

## Change
Update the `shape_code` field in `custom_shape_schematics` table for the record with id `c4aa6c87-b9b2-4c05-9760-b93a04e1dcdc` from `TYPE T3` to `TYPE T3a`.

## Implementation
Single database migration:
```sql
UPDATE custom_shape_schematics 
SET shape_code = 'TYPE T3a' 
WHERE id = 'c4aa6c87-b9b2-4c05-9760-b93a04e1dcdc';
```

No code changes needed — the UI reads shape codes dynamically from the database.

