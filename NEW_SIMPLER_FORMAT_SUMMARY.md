# New Simpler Multi-Population Format

## ✅ Major Change: Line-Based Format (NO More "label — value" Everywhere)

### OLD Format (What We Had):
```
Gender: male
        female
        
Age: male — 20
     female — 22
     
Injuries: male — 150
          female — 120
```

### NEW Format (What We Have Now):
```
Gender: male
        female
        
Age: 20
     22
     
Injuries: 150
          120
```

**The line position links them!**
- Line 1 = male, 20 years, 150 injuries
- Line 2 = female, 22 years, 120 injuries

---

## How It Works

### Population-Defining Fields (Use Identifiers)
These fields define the populations. Enter **identifiers only**, one per line:

- **Sex**: `male\nfemale`
- **Age Category**: `U19\nU21`  
- **Level of Play**: `professional\namateur`

### All Other Fields (Values Only, NO Labels)
All other fields contain **values only**. The line number links them to the populations:

- **Mean Age**: `20.5\n22.1` (NOT ~~`male — 20.5\nfemale — 22.1`~~)
- **Sample Size**: `62\n60`
- **Match Exposure**: `250 h\n210 h`
- **Total Injuries**: `150\n120`
- **Incidence**: `3.2\n2.8`

---

## What Changed

### 1. ✅ AI Prompt Updated
**Before:** Told AI to format everything as "label — value"  
**After:** Only population-defining fields use identifiers, all other fields are values only

**Example AI Output:**
```json
{
  "sex": "male\nfemale",
  "sampleSizePlayers": "62\n60",
  "meanAge": "20.5\n22.1"
}
```

### 2. ✅ Field Descriptions Updated
All field descriptions now clearly state:
- Population-defining fields: "DEFINES POPULATIONS. Enter identifiers only."
- Other fields: "For multiple populations: enter VALUES ONLY, one per line."

### 3. ✅ UI Placeholders Updated
Hover info icons now show the new simpler format:
- `ageCategory`: "U19\nU21"
- `meanAge`: "16.8 ± 0.9\n20.1 ± 0.3"

### 4. ✅ Parsing Logic Updated
- Recognizes `ageCategory` and `sex` as population-defining fields
- All other fields parsed as pure values (no label extraction)
- Legacy "label — value" format still supported for backward compatibility

### 5. ✅ Table Editor Updated
- Saves population labels separately (not mixed with values)
- Values are stored without labels
- Labels preserved in first metric for persistence

### 6. ✅ Export Fix: No More "population af3"
- Population labels that are stored to preserve row structure NO LONGER appear as data values in exports
- Filter added: If value == population label, skip it (it's not real data)

---

## Export Behavior

### Workspace:
```
Table:
┌────────┬───────┬───────────┐
│ Pop    │ Count │ Incidence │
├────────┼───────┼───────────┤
│ male   │ 150   │ 3.2       │
│ female │ 120   │ 2.8       │
└────────┴───────┴───────────┘
```

### CSV Export:
```csv
Paper ID, Title, Status, ..., Muscle/tendon – Count, Muscle/tendon – Incidence, ...
STUDY001, "...", extracted, ..., 150, 3.2, ...
STUDY001, "...", extracted, ..., 120, 2.8, ...
```

✅ **NO "population af3" in data columns!**  
✅ **Population labels are for reference only, not exported as data!**  
✅ **Clean, professional exports!**

---

## Benefits of New Format

1. **Simpler for Users** - No need to repeat labels in every field
2. **Cleaner Data** - Values are just values, labels are just labels
3. **Easier to Understand** - Line position makes the link obvious
4. **Less Prone to Errors** - Can't accidentally mismatch labels across fields
5. **Professional Exports** - No label artifacts in data columns

---

## Migration Notes

- **Old data still works**: Legacy "label — value" format is still parsed correctly
- **New entries use new format**: AI and manual entry now use the simpler format
- **Mixed formats OK**: Can have some fields with old format, some with new

---

## Files Modified

1. `fifa-gbi-data-extraction/src/lib/extraction/prompt.ts` - AI instructions
2. `fifa-gbi-data-extraction/src/lib/extraction/schema.ts` - Field descriptions
3. `fifa-gbi-data-extraction/src/lib/extraction/populations.ts` - Parsing logic
4. `fifa-gbi-data-extraction/src/components/extraction-field-editor.tsx` - UI placeholders
5. `fifa-gbi-data-extraction/src/components/manual-group-table-editor.tsx` - Table editor logic
6. `fifa-gbi-data-extraction/src/lib/mock-db.ts` - Population sync with filter

---

**Status:** ✅ **ALL FIXES COMPLETE - READY TO COMMIT!**

