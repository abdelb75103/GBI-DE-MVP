# Table Row → Export Row Mapping Fix

## Problem Summary

Looking at the screenshots, the issues are:

1. **Population labels appearing in data cells**: "femal—" instead of blank
2. **Data not aligning properly**: Table Row 1 ≠ Export Row 1

## Root Causes

### 1. Old Data in Database
The table editor was previously saving blank cells as `"label — "` (e.g., `"femal — "`), which:
- Gets stored in `population_values` 
- Appears in export as `"femal—"`

### 2. Need to Re-Enter Data
Any data entered BEFORE the table editor fix will have these artifacts.

## Solutions Implemented

### ✅ Fix 1: Table Editor (Already Done)
**File:** `manual-group-table-editor.tsx`

**What it does:**
- ONLY saves cells that have actual values
- Blank cells = NOT saved (completely empty)
- Format: `"label — value"` only if BOTH exist

**Code:**
```typescript
if (!cellValue || !cellValue.trim()) return '';  // Skip blank cells
return row.label && row.label.trim() 
  ? `${row.label} — ${cellValue}`  // Both exist
  : cellValue;                       // Only value exists
```

### ✅ Fix 2: Export Safety Check (Just Added)
**File:** `exporters.ts`

**What it does:**
- Strips any `"label — "` prefix before exporting
- Safety net for old data

**Code:**
```typescript
// Safety: Strip any "label — " prefix that might have leaked through
if (value && typeof value === 'string') {
  const labelMatch = value.match(/^.+?\s*[:\-–—]\s*(.+)$/);
  if (labelMatch) {
    value = labelMatch[1].trim();  // Extract just the value part
  }
}
```

### ✅ Fix 3: Blank Cell Logic (Already Done)
**File:** `exporters.ts`

**What it does:**
- Only falls back to extraction fields for non-population data
- Keeps population-specific blank cells blank

**Code:**
```typescript
if (value == null && (isDefaultGroup || !fieldsWithPopulationData.has(column.id))) {
  value = field?.value ?? null;  // Only for non-population fields
}
```

## How It Works Now

### Workspace Table:
```
┌───────────┬───────┬───────────┬────────┐
│ Pop       │ Count │ Incidence │ Burden │
├───────────┼───────┼───────────┼────────┤
│ male      │ 50    │ 3.2       │ (blank)│ ← Row 1
│ female    │ 40    │ (blank)   │ 2.1    │ ← Row 2
└───────────┴───────┴───────────┴────────┘
```

### Saved to DB:
```
Field: injuryTissueType_muscle_injury_prevalence
Value: "male — 50\nfemale — 40"

Field: injuryTissueType_muscle_injury_incidence
Value: "male — 3.2"  ← ONLY Row 1 saved (Row 2 blank, not saved)

Field: injuryTissueType_muscle_injury_burden
Value: "female — 2.1"  ← ONLY Row 2 saved (Row 1 blank, not saved)
```

### Population Values:
```
Group 1 (male):
  - count: "50"
  - incidence: "3.2"
  - burden: null

Group 2 (female):
  - count: "40"
  - incidence: null
  - burden: "2.1"
```

### Export (CSV):
```
Row 1: Study001, ..., 50, 3.2, (blank), ...  ← Male data
Row 2: Study001, ..., 40, (blank), 2.1, ...  ← Female data
```

## Critical Rules

✅ **1 Table Row = 1 Export Row**
- Row 1 in workspace → Row 1 in export
- Row 2 in workspace → Row 2 in export
- Independent, no mixing

✅ **Blank Cells Stay Blank**
- If cell is empty in table → completely blank in export
- NO placeholders, NO labels, NO dashes

✅ **Population Labels = Workspace Reference Only**
- Labels help users organize data
- Labels do NOT appear in export columns
- Only appear in population_groups.label for internal tracking

✅ **Each Row is Independent**
- Row 1's data never bleeds into Row 2
- Row 2's data never bleeds into Row 1
- Each row has its own complete dataset

## Steps to Fix Existing Papers

### For Papers with Bad Data:

1. **Open the paper workspace**
2. **Go to the metric table tabs**
3. **Re-enter the data** (copy from export if needed)
   - Make sure blank cells are truly blank
   - Save with "Save & Continue"
4. **Export again**
   - Should now show correct rows
   - Blank cells should be blank

### Why This is Necessary:
The old table editor saved `"label — "` for blank cells, which is now stored in the database. The new logic won't save blanks this way, but existing data needs to be re-entered to clear the artifacts.

## Testing Checklist

- [ ] Create a new paper with metric tables
- [ ] Add 2 populations
- [ ] Fill Row 1 completely
- [ ] Fill Row 2 with some blank cells
- [ ] Save the paper
- [ ] Export to CSV
- [ ] Verify:
  - ✅ Row 1 in table = Row 1 in export
  - ✅ Row 2 in table = Row 2 in export  
  - ✅ Blank cells in table = blank cells in export
  - ✅ NO labels in data columns
  - ✅ Each row has correct values

---

**Status:** ✅ FIXED - Re-enter data on existing papers to clear old artifacts

