

# Remove "Edit" Button from Editor Toolbar

## Change
Remove the "Edit" button (with pencil icon) from the top-right toolbar in `ProVideoEditor.tsx`.

## File: `src/components/ad-director/ProVideoEditor.tsx`
**Lines 1545-1547** — Delete the Edit button:
```typescript
<Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => handleSetActiveTab("brand-kit")}>
  <Edit3 className="w-3 h-3" /> Edit
</Button>
```

Also check if `Edit3` import from lucide-react is still used elsewhere; if not, remove it from the import statement.

