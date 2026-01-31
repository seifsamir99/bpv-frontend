# BPV-PDC Sync Workflow

## Overview
This document describes the sync workflow between BPV (Bank Payment Voucher) data and PDC (Post-Dated Cheque) monthly sheets.

## Google Sheet
- **Sheet ID**: `1DZfS3J6Men-XuX11nXAYnMhgQKCn4SJTFDDFxlEQAwk`
- **URL**: https://docs.google.com/spreadsheets/d/1DZfS3J6Men-XuX11nXAYnMhgQKCn4SJTFDDFxlEQAwk

## Sync Flow Architecture

```
BPV Sheet (Manual Entry)
    ↓
"all Bpv" Sheet (IF formulas auto-pull from BPV)
    ↓
Monthly PDC Sheets (FILTER formulas auto-pull from "all Bpv")
```

### 1. BPV Sheet
- Contains voucher templates #1-55
- User enters: BPV Number, Date, Company Name, Cheque #, Cheque Date, Amount
- PDC/CDC dropdown in each voucher header

### 2. "all Bpv" Sheet
- IF formulas detect when COMPANY NAME is filled in BPV
- Columns: BPV#, Company Name, Description, Date, Cheque#, Cheque Date, Total, Type (PDC/CDC)

### 3. Monthly PDC Sheets (JAN PDC - DEC PDC)
- FILTER formula pulls from "all Bpv" where TYPE="PDC" and month matches
- Sorted by cheque date ascending

## Sync Trigger Logic
Entry appears in monthly PDC when:
1. TYPE = "PDC" (column H in 'all Bpv')
2. COMPANY NAME is not empty (column B) - **primary trigger**
3. CHEQUE DATE is not empty (column F)
4. CHEQUE DATE month matches target sheet

## Current Sheet Structure (v2)

```
Row 1:    Headers (Sn, Company name, Cheq no, Amount, Date)
Row 2:    [FILTER FORMULA] - synced data from BPV
Row 3-29: (reserved for synced data expansion)
Row 30+:  Manual data section
```

## FILTER Formula
```
=IFERROR(SORT(FILTER({'all Bpv'!A2:A,'all Bpv'!B2:B,'all Bpv'!E2:E,'all Bpv'!G2:G,'all Bpv'!F2:F},
  'all Bpv'!H2:H="PDC",
  'all Bpv'!B2:B<>"",
  'all Bpv'!F2:F<>"",
  IF(ISNUMBER('all Bpv'!F2:F),MONTH('all Bpv'!F2:F),VALUE(INDEX(SPLIT('all Bpv'!F2:F,"/"),0,1)))={month}
),5,TRUE),"")
```

## Column Mapping
| all Bpv | Monthly PDC | Description |
|---------|-------------|-------------|
| A | A (Sn) | BPV Number |
| B | B | Company Name |
| E | C | Cheque Number |
| G | D | Amount |
| F | E | Date |

## Date Format Handling
Formula handles both:
- Serial dates (e.g., 46149) - uses MONTH() directly
- Text dates (e.g., "3/17/2026") - splits by "/" and extracts month

## Key Scripts

### `execution/setup_pdc_sync_v2.py`
Current sync setup script:
- Puts FILTER formula at row 2
- Moves manual data to row 30+
- Removes duplicates (same cheque # in both synced and manual)

Commands:
```bash
python execution/setup_pdc_sync_v2.py dry-run     # Preview
python execution/setup_pdc_sync_v2.py run         # Apply all
python execution/setup_pdc_sync_v2.py single "MAR PDC"  # Single sheet
```

### `execution/setup_pdc_dynamic_sync.py`
Alternative: Formula after manual data (deprecated)

### `execution/bpv_service.py`
Core BPV CRUD operations for the frontend

## Duplicate Handling
When synced data and manual data have the same cheque number:
- Keep the synced version (from BPV)
- Remove from manual data section

## Manual Data
- Located at row 30+ in each sheet
- User adds TOTAL row manually at the bottom
- Will not be overwritten by sync

## Troubleshooting

### Formula not showing data
1. Check "all Bpv" has entries with TYPE="PDC"
2. Verify COMPANY NAME is filled
3. Check CHEQUE DATE month matches

### Re-run sync
```bash
python execution/setup_pdc_sync_v2.py run
```

## Last Updated
2026-01-29
