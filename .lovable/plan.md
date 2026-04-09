

# Delete TYPE T3a and Add TYPE T3 + TYPE T3A

## Current State
- One record exists: `TYPE T3a` (id: `c4aa6c87-...`) — needs to be deleted

## Steps

### Step 1 — Upload Images to Storage
Upload the two user-provided images to the `shape-schematics` bucket:
- `user-uploads://image-377.png` → `TYPE_T3.png` (T3 — simple hoop with G=LAP, C=CIRCUM, O)
- `user-uploads://image-378.png` → `TYPE_T3A.png` (T3A — hoop with K=LAP, A, G, C=CIRCUM, O)

### Step 2 — Delete Old Record
```sql
DELETE FROM custom_shape_schematics WHERE id = 'c4aa6c87-b9b2-4c05-9760-b93a04e1dcdc';
```

### Step 3 — Insert Two New Records
```sql
INSERT INTO custom_shape_schematics (shape_code, image_url, ai_analysis, uploaded_by)
VALUES
  ('TYPE T3', '<storage_url>/TYPE_T3.png', '{"shape_code":"T3","confidence":1,"description":"Hoop or spiral shape with lap (G=LAP), circumference (C=CIRCUM), and diameter (O)."}', 'system'),
  ('TYPE T3A', '<storage_url>/TYPE_T3A.png', '{"shape_code":"T3A","confidence":1,"description":"Hoop or spiral shape with lap (K=LAP), internal dimensions (A, G), circumference (C=CIRCUM), and diameter (O)."}', 'system');
```

### Result
- `TYPE T3a` removed
- `TYPE T3` added (simple hoop)
- `TYPE T3A` added (hoop with A/G internal dimensions)
- No code changes needed — UI reads dynamically from the database

