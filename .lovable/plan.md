
# Clone Full QuickBooks Customer Detail View

## Overview
Redesign the Customer Details tab and header to display ALL fields from QuickBooks `raw_json` -- matching the QuickBooks customer detail page exactly. Currently we only show a handful of fields; QB has 30+ fields available.

## What Changes

### 1. Expand Header Section with ALL QB Contact Fields

The header currently shows: email, phone, billing address, shipping address. QuickBooks also shows:
- **Mobile phone** (`Mobile.FreeFormNumber`)
- **Alternate phone** (`AlternatePhone.FreeFormNumber`)
- **Fax** (`Fax.FreeFormNumber`)
- **Website** (`WebAddr.URI`)
- **Title / Suffix** (`Title`, `Suffix`)
- **Given Name / Middle / Family Name** (`GivenName`, `MiddleName`, `FamilyName`)
- **Balance with Jobs** (`BalanceWithJobs`)
- **Preferred Delivery Method** (`PreferredDeliveryMethod`)
- **Payment Method** (`PaymentMethodRef.name`)
- **Sales Terms** (`SalesTermRef.name`)
- **Taxable** (`Taxable`)
- **Active** status (`Active`)
- **Print on Check Name** (`PrintOnCheckName`)
- **QB Notes** (`Notes`)
- **Created / Last Updated** (`MetaData.CreateTime`, `MetaData.LastUpdatedTime`)
- **Currency** (`CurrencyRef.name`)

### 2. Redesign Customer Details Tab into Organized Sections

Replace the current simple form with grouped sections (matching QuickBooks layout):

**Section 1: "Contact Information"**
- Display Name, Given Name, Middle Name, Family Name, Title, Suffix
- All read-only (synced from QB) with labels

**Section 2: "Communication"**
- Primary Email, Primary Phone, Mobile, Alternate Phone, Fax, Website
- Read-only for QB-synced fields

**Section 3: "Addresses"**
- Full Billing Address (Line1, City, Province/State, Postal Code)
- Full Shipping Address (same structure)
- Read-only (from QB)

**Section 4: "Payment & Billing"**
- Payment Method, Sales Terms, Preferred Delivery Method, Taxable, Currency, Print on Check Name
- Read-only (from QB)

**Section 5: "Local Settings" (editable)**
- Name, Company Name, Status, Type, Payment Terms, Credit Limit
- These are the ERP-local fields users can edit and save

### 3. Expand Financial Summary

Add more financial context to the summary card:
- **QB Balance** (`Balance` from `qb_customers`)
- **Balance with Jobs** (`BalanceWithJobs`)
- Open Balance (computed from transactions, already exists)
- Overdue (already exists)

### 4. Files Modified

| File | Change |
|------|--------|
| `src/components/customers/CustomerDetail.tsx` | Major update: expand header with all QB fields, redesign Customer Details tab into organized sections with all QB `raw_json` fields displayed, expand financial summary |

### No other files change. No database changes needed.

## Technical Details

- All new fields are extracted from the existing `qbCustomer?.raw_json` object already queried on line 65-77
- No new queries needed -- just more fields extracted from `qbJson`
- QB-synced fields shown as read-only with clean labels in organized card sections
- Editable local fields (name, company, status, type, payment terms, credit limit) remain as form inputs with the existing save mutation
- The `CustomerDetailsForm` component will be expanded to accept the full `qbJson` object as a prop and render all sections
- Full billing/shipping addresses will show Line1, City, CountrySubDivisionCode (province), PostalCode on separate lines instead of a single concatenated string
