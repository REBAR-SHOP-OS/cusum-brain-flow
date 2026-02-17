
# Upgrade VendorDetail to Match CustomerDetail (QB Clone)

## Problem
The current VendorDetail is a minimal view -- just the vendor name, a few inline contact fields, and a flat 2-column grid under "Supplier Details". It's missing:
- Avatar with initials
- Copy-to-clipboard buttons on contact fields
- Rich contact info grid in the header (Mobile, Alt Phone, Fax shown separately)
- Proper Financial Summary card (matching CustomerDetail style with QB Balance line)
- Organized detail sections (Contact Info, Communication, Address, Payment & Billing, QB Metadata)
- Many QB fields not extracted at all (GivenName, FamilyName, Mobile, AlternatePhone, PrintOnCheckName, BillRate, CostRate, Vendor1099, T4AEligible, T5018Eligible)

## Available QB Vendor Fields (from database)
AcctNum, Active, AlternatePhone, Balance, BillAddr, BillRate, CompanyName, CostRate, CurrencyRef, DisplayName, FamilyName, GivenName, Id, MetaData, Mobile, PrimaryEmailAddr, PrimaryPhone, PrintOnCheckName, SyncToken, T4AEligible, T5018Eligible, TermRef, V4IDPseudonym, Vendor1099

## Changes (single file: `src/components/accounting/VendorDetail.tsx`)

### 1. Header Upgrade
- Add avatar circle with initials (same pattern as CustomerDetail)
- Show status badge + company name below display name
- Add Copy button next to email and phone

### 2. Contact Info Grid in Header
Extract and display in a grid (matching CustomerDetail layout):
- Email (with copy button)
- Phone (with copy button)
- Mobile (new -- from `qbJson?.Mobile?.FreeFormNumber`)
- Alt. Phone (new -- from `qbJson?.AlternatePhone?.FreeFormNumber`)
- Website
- Billing Address

### 3. Financial Summary Card
Replace the current inline open-balance / overdue card with a proper Financial Summary card matching CustomerDetail:
- QB Balance (from `qb_vendors.balance`)
- Open Balance (computed from open bills)
- Overdue (computed)

### 4. "Supplier Details" Tab -- Organized Sections
Replace the flat grid with organized Card sections:

**Contact Information**: DisplayName, GivenName, FamilyName, PrintOnCheckName
**Communication**: Email, Phone, Mobile, Alt Phone
**Address**: Billing Address (multi-line format)
**Payment & Billing**: Payment Terms, Account No., Bill Rate, Cost Rate, Currency, Vendor1099, T4A Eligible, T5018 Eligible, Taxable
**QuickBooks Metadata**: QB ID, Active, Notes, Created, Updated

### 5. Extract Missing Fields
Add extraction of these fields from `qbJson`:
- `Mobile?.FreeFormNumber`
- `AlternatePhone?.FreeFormNumber`
- `GivenName`, `FamilyName`
- `PrintOnCheckName`
- `BillRate`, `CostRate`
- `Vendor1099`
- `T4AEligible`, `T5018Eligible`

### 6. Import Updates
Add: `Copy`, `Globe`, `Smartphone`, `User` from lucide-react

## File Changed

| File | Change |
|------|--------|
| `src/components/accounting/VendorDetail.tsx` | Full UI upgrade to match CustomerDetail pattern |

## No Behavior Changes
- All existing transaction list, sync, delete/void logic stays identical
- Only the visual layout and data extraction is enhanced
