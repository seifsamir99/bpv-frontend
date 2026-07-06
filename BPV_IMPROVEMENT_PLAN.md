# BPV System Analysis & Improvement Recommendations

## Current System Overview

### Frontend (React/Vite + TailwindCSS)
- Card & Table views for 44+ vouchers
- CRUD operations with auto-save
- PDC/CDC type filtering
- Print functionality
- AI Chat widget (n8n integration)

### Backend (Railway + Google Sheets)
- Serverless API on Railway
- Google Sheets as database (60 voucher template slots)
- Dual sheet sync (BPV detail + "all Bpv" summary)

### n8n Workflow
- Chat Trigger → AI Agent (Claude Sonnet 4.5) → Google Sheets Tool
- Basic setup with minimal configuration

---

## Recommended Improvements

### 1. Frontend Improvements

| Feature | Why | Priority |
|---------|-----|----------|
| **Search/Filter by text** | Find vouchers by company name, description, or cheque number | High |
| **Sorting** | Sort by date, amount, BPV number | High |
| **Date range filter** | Filter vouchers by date period | Medium |
| **Dashboard/Analytics** | Show totals, charts (monthly spend, by company) | Medium |
| **Bulk operations** | Delete/export multiple vouchers at once | Medium |
| **Keyboard shortcuts** | Quick navigation (Ctrl+N for new, etc.) | Low |
| **Dark mode** | User preference | Low |
| **Offline support** | Cache vouchers locally, sync when online | Low |

### 2. n8n Workflow Improvements

| Feature | Why | Priority |
|---------|-----|----------|
| **System prompt** | Give the AI context about BPV, company, and what it can help with | High |
| **More tools** | Add calculation tools, date helpers, PDF generation | High |
| **Memory/Context** | Remember conversation history per user | Medium |
| **Email notifications** | Alert on large payments or unusual activity | Medium |
| **Scheduled reports** | Weekly/monthly BPV summaries via email | Medium |
| **Multi-sheet access** | Access other company sheets if needed | Low |
| **Voice input** | Whisper integration for voice commands | Low |

### 3. Backend/Data Improvements

| Feature | Why | Priority |
|---------|-----|----------|
| **Expand beyond 60 vouchers** | Current limit is 60 template slots | High |
| **Audit trail** | Track who created/modified each voucher | High |
| **Data validation** | Validate amounts, dates, required fields | Medium |
| **Duplicate detection** | Warn on duplicate cheque numbers | Medium |
| **API authentication** | Add API keys or JWT for security | Medium |
| **Backup automation** | Auto-backup sheets to Drive | Low |
| **Move to real database** | PostgreSQL/Supabase for better scaling | Low |

### 4. AI Chat Enhancements

| Feature | Why | Priority |
|---------|-----|----------|
| **Quick actions** | "Show today's vouchers", "Total for January" | High |
| **Create via chat** | "Create voucher for Alpha Tech, 5000 AED" | High |
| **Natural language queries** | "How much did we pay Salam Express?" | High |
| **Export reports** | "Email me this month's summary" | Medium |
| **Smart suggestions** | Auto-complete company names, predict amounts | Medium |

---

## Implementation Plan: All Quick Wins

### 1. Smart Search Bar (Fuzzy Search)
**File**: `src/components/VoucherList.jsx`
- Add search input above the voucher grid
- **Fuzzy matching** - handles typos and partial matches:
  - "alfa tec" → finds "ALPHA TECH"
  - "mohamd" → finds "MOHAMMED HESHAM"
  - "salam" → finds "SALAM EXPRESS"
- Search across: company name, description, cheque number, BPV number
- Real-time filtering as user types
- Uses `fuse.js` library for intelligent fuzzy search
- Shows match score/relevance

### 2. Column Sorting
**File**: `src/components/VoucherList.jsx`
- Add sort dropdown or clickable headers
- Sort options: Date (newest/oldest), Amount (high/low), BPV Number
- Persist sort preference

### 3. Date Range Filter
**File**: `src/components/VoucherList.jsx`
- Add month/year picker or date range inputs
- Quick presets: This Month, Last Month, This Year
- Filter vouchers by date field

### 4. Totals Display
**File**: `src/components/VoucherList.jsx`
- Show total amount of filtered vouchers
- Show count of filtered vouchers
- Update dynamically as filters change

### 5. AI System Prompt (in n8n workflow)
**Location**: Your existing n8n BPV workflow → AI Agent node → Settings

The chatbot already works! We just need to configure the AI Agent node with a **system prompt** so Claude knows the context. Currently it has `"options": {}` (no instructions).

**How to add in n8n:**
1. Open your BPV workflow in n8n
2. Click the "AI Agent" node
3. Go to Options → System Message
4. Paste this system prompt:

```
You are BPV Assistant for Newell Electromechanical Works LLC.

BPV = Bank Payment Voucher - a document recording payments made by the company.

You have access to the BPV Google Sheet with these fields:
- BPV Number, Date, Type (PDC/CDC)
- Company Name, Description, Cheque Number, Cheque Date
- Debit Amount, Credit Amount, Total

PDC = Post-Dated Cheque, CDC = Current-Dated Cheque

You can help users:
- Find payments by company name (e.g., "How much did we pay Alpha Tech?")
- Get totals for date ranges (e.g., "Total payments in January 2026")
- List recent vouchers (e.g., "Show last 5 vouchers")
- Answer questions about specific vouchers

Always format amounts in AED with commas (e.g., 50,560.00 AED).
Be concise and helpful.
```

**No code changes needed** - this is all configured in n8n UI.

---

## Files to Modify

| File | Changes |
|------|---------|
| `package.json` | Add `fuse.js` for fuzzy search |
| `src/components/VoucherList.jsx` | Add SearchBar, SortDropdown, DateFilter, Totals |
| `src/App.jsx` | Add search/sort/dateFilter state |
| n8n workflow | Update AI Agent with system prompt |

## Dependencies to Add
- `fuse.js` - Lightweight fuzzy search library (handles typos, partial matches)

---

## Verification Steps

1. **Search**: Type company name → only matching vouchers show
2. **Sort**: Click sort option → vouchers reorder correctly
3. **Date Filter**: Select month → only that month's vouchers show
4. **Totals**: Verify sum matches filtered vouchers
5. **AI Chat**: Ask "What is BPV?" → AI explains with context
6. **AI Query**: Ask "How much did we pay Alpha Tech?" → AI answers correctly

---

## Completed Improvements

### 1. Search Field Selector (Completed: Feb 2026)
- Added dropdown to select search field: All Fields, Company, Cheque #, BPV #, Description
- Replaced fuzzy search with exact substring matching
- Fixes issue where "alphatech" was matching "tech" in other companies

### 2. Autocomplete for Description & Company Name (Completed: Feb 2026)
**Files Modified:**
- `src/components/AutocompleteInput.jsx` (NEW)
- `src/components/LineItemsTable.jsx`
- `src/components/VoucherForm.jsx`
- `src/App.jsx`

**Features:**
- Dropdown appears on focus showing previous entries
- Filters suggestions as you type (case-insensitive)
- Click to select, then continue editing (fully editable)
- Keyboard navigation: Arrow keys, Enter, Escape
- Max 8 suggestions shown at once
- Works for both Company Name (single line) and Description (multiline)

### 3. Dashboard Landing Page & Salaries Module (Completed: Feb 2026)
**New Files:**
- `src/pages/Dashboard.jsx` - Landing page with module cards
- `src/pages/BPVPage.jsx` - BPV Manager (refactored from App.jsx)
- `src/pages/SalariesPage.jsx` - HR Salaries page
- `src/components/PageHeader.jsx` - Reusable header with back button
- `src/components/SalaryForm.jsx` - Full HR salary form
- `src/components/SalaryList.jsx` - Salary list with search/filter
- `src/services/salaryApi.js` - Salary API client
- `src/hooks/useSalaries.js` - Salary CRUD hook

**Modified Files:**
- `src/App.jsx` - Now uses React Router
- `src/main.jsx` - Wrapped with BrowserRouter
- `package.json` - Added react-router-dom

**Architecture:**
```
Dashboard (/)
├── Accounts → /bpv → BPV Manager
└── HR → /salaries → Salaries Page
```

**Salary Form Fields:**
- Employee Name, Position (with autocomplete)
- Basic Salary, Housing/Transport/Other Allowances
- Deductions, Net Pay (auto-calculated)
- Payment Date, Method (Cash/Bank/Cheque)
- Bank Name, Cheque Number, Notes

**Note:** Backend for salaries (Google Sheet + API endpoints) needs to be created separately.

### 4. Payroll Calculation — n8n Removed (Completed: Feb 2026)
Replaced both n8n salary workflows (Labour + Staff) with a frontend-driven payroll system. No more n8n dependency for payroll.

**New Files:**
- `src/utils/payrollCalculation.js` — Pure calculation functions ported from n8n JS code nodes
- `src/pages/PayrollPage.jsx` — Payroll UI with Labour/Staff tabs, month selector, results table, save-to-sheet

**Modified Files:**
- `src/App.jsx` — Added `/payroll` route
- `src/pages/Dashboard.jsx` — Added Payroll module card
- `bpv-backend/index.js` — Added `POST /api/payroll` endpoint (writes to Monthly Payroll 2026 sheet, auto-creates tabs)

**Calculation Logic (from n8n workflows):**

*Labour:*
- Paid days = Present + Off + Sick + P
- Deduction days = Leave + Joined + Absent
- Penalty rule: if Absent days > 3, each absent day counts as 2× deduction
- OT rate = (Rate/Day ÷ 8) × 1.25
- Net Salary = (Rate/Day × Paid Days) + (OT Hours × OT Rate)

*Staff:*
- Same paid/deduction day logic, no OT
- Net Salary = (Rate/Day × Paid Days) − Other Deductions (from employee record)

**Data sources (all existing endpoints, no new GETs):**
- `GET /api/employees?type=labour|staff` — rates, OT hours, deductions
- `GET /api/attendance?type=labour|staff` — day-by-day attendance

**Output sheet:** Monthly Payroll 2026 (`1_q5QsmF9gZ2jeJqDpcSHU2iCeJyjIAQntK92G4iFsOg`)
- Labour tabs: "Labour Jan", "Labour Feb", etc.
- Staff tabs: "Staff Jan", "Staff Feb", etc.
- Tabs auto-created if they don't exist

### 5. Attendance Fixes (Completed: Feb 2026)
**Bug A — Google Sheets "Invalid" validation error:**
- Changed `valueInputOption` from `USER_ENTERED` to `RAW` in attendance PUT and bulk POST endpoints
- `RAW` bypasses data-validation rules; attendance statuses are plain text

**Bug B — Sunday auto-fill not writing to sheet:**
- Removed `isCurrentMonth` guard from `autoFillSundays` effect in `AttendancePage.jsx`
- Sundays now auto-fill as "Off" for any month viewed, not just current

**Bug C — Casing inconsistency (sheet had "present", app showed "Present"):**
- Added `normalizeStatus()` in backend that maps known statuses to canonical casing before writing
- Canonical set: Present, Absent, Leave, Off, Sick, Joined, Holiday

**Feature — "Mark All As…" dropdown:**
- Replaced hardcoded "Mark All Present" / "Mark All Off" buttons with a single dropdown
- Dropdown shows all statuses (including custom ones) with colour chips
- Respects search/designation filters; disabled on Sundays

### 6. PDC Tracker Print Feature (Completed: Feb 2026)
**File Modified:** `src/pages/PDCPage.jsx`

**Features:**
- Print button next to List/Calendar toggle
- Opens print-friendly page with:
  - Company header (NEWELL ELECTROMECHANICAL WORKS LLC)
  - Month/year title with total count and amount
  - Stats summary (Not Released / Released)
  - Week color legend
  - PDC table sorted by cheque date
  - Total row at bottom
- **Week-based date colorization** (only date column colored):
  - Week 1 (Days 1-7): Light Blue `#E3F2FD`
  - Week 2 (Days 8-14): Light Green `#E8F5E9`
  - Week 3 (Days 15-21): Light Yellow `#FFF8E1`
  - Week 4 (Days 22-28): Light Pink `#FCE4EC`
  - Week 5 (Days 29-31): Light Purple `#F3E5F5`
- Auto-triggers print dialog
- Uses `print-color-adjust: exact` for proper color printing

### 7. CDC Tracker (Completed: Feb 2026)
**New File:** `src/pages/CDCPage.jsx`
**Modified Files:** `src/App.jsx`

**Features:**
- Full CDC (Current-Dated Cheques) tracker page at `/cdc`
- Filters BPV vouchers with `pdcType === 'CDC'`
- Orange theme (vs Cyan for PDC)
- Statuses: "Pending" and "Cleared" (vs "Not Released"/"Released" for PDC)
- Same features as PDC Tracker:
  - Month/Year selector
  - Stats cards (Pending count/total, Cleared count/total)
  - List view with sortable table
  - Calendar view with color-coded cheques
  - Print functionality with week-based date coloring
  - Status change dropdown
- Links to PDC Tracker and BPV Manager
- Uses same backend endpoint (`/api/pdc/status-by-cheque`) for status persistence

**Route:** `/cdc` → `CDCPage`

**Navigation:**
- Dashboard has CDC Tracker card (rose/pink color)
- BPV Manager has "Quick Links" to both PDC and CDC trackers
- PDC Tracker links to CDC Tracker and BPV Manager
- CDC Tracker links to PDC Tracker and BPV Manager
