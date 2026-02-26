

# Link "Quotations" Quick-Access Tab to Documents → Quotations Sub-Tab

## What Changes

When you click **Quotations** in the top quick-access strip, it will navigate to the **Documents** section with the **Quotations** sub-tab already selected, instead of going to the standalone estimates tab.

## Files to Change

| File | Change |
|---|---|
| `src/components/accounting/AccountingDocuments.tsx` | Add optional `initialDocType` prop; use it to initialize `activeDoc` state; add `useEffect` to sync when prop changes |
| `src/pages/AccountingWorkspace.tsx` | Add `docSubTab` state; change Quotations button from `tab: "estimates"` to `tab: "documents"` with a `docType` field; update click handler to set `docSubTab`; pass `initialDocType` to `AccountingDocuments` |

## Technical Details

**AccountingDocuments.tsx:**
- Update `Props` interface to accept `initialDocType?: DocType`
- Destructure: `{ data, initialDocType }`
- Add `useEffect` that sets `activeDoc` when `initialDocType` changes (so clicking the quick-access button after mount still works)

**AccountingWorkspace.tsx:**
- Add state: `const [docSubTab, setDocSubTab] = useState<string | undefined>()`
- Change Quotations entry to `{ label: "Quotations", tab: "documents", docType: "quotation", count: qb.estimates.length }`
- Update click handler: when a button has `docType`, call `setDocSubTab(item.docType)` alongside `setActiveTab(item.tab)`; otherwise clear it with `setDocSubTab(undefined)`
- Pass prop: `<AccountingDocuments data={qb} initialDocType={docSubTab} />`

