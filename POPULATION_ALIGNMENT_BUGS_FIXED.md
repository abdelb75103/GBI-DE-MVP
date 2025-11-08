# Population Alignment Bugs Fixed

## Overview

Three critical bugs were discovered and fixed that broke the position-based alignment of multi-population data. These bugs prevented the correct mapping of values across different fields when blank rows were intentionally used as position markers.

---

## Bug #1: splitEntries() Filters Out Blank Lines

### Problem
The `splitEntries()` helper function filtered out empty segments:

```typescript
const splitEntries = (raw: string): string[] => {
  return raw
    .split(/\r?\n/)
    .flatMap((line) => line.split(/;/))
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);  // ❌ REMOVES BLANKS
};
```

This was used to parse multi-line field data, which broke row alignment:

**Example:**
```
Gender: "male\n\nfemale" → splitEntries returns ["male", "female"]
                          → Indices: [0, 1] (blank removed!)
Age: "20\n25\n30"        → splitEntries returns ["20", "25", "30"]
                          → Indices: [0, 1, 2]

Result: male=20, female=25 (should be 30), 30=orphaned ❌
```

### Fix
Changed line 152 to split directly without filtering:

```typescript
// Split on newlines WITHOUT filtering out blanks to preserve row alignment
const segments = field.value.split(/\r?\n/).map((line) => line.trim());
```

**Result:**
```
Gender: "male\n\nfemale" → segments = ["male", "", "female"]
                          → Indices: [0, 1, 2] ✅
Age: "20\n25\n30"        → segments = ["20", "25", "30"]
                          → Indices: [0, 1, 2] ✅

Result: male=20, (no gender)=25, female=30 ✅
```

---

## Bug #2: Skipping Blank Segments Breaks Position Mapping

### Problem
After fixing Bug #1, the code skipped processing blank segments entirely:

```typescript
segments.forEach((segment, index) => {
  if (segment === '') {
    return;  // ❌ SKIP - group never created at this position!
  }
  const group = resolveGroupForEntry(groups, labelLookup, entry, index);
  // ... store value
});
```

This caused misalignment because groups were not created at blank positions:

**Example:**
```
Field A: ["value1", "", "value3"]
  - Processes index 0 → creates Group 0
  - SKIPS index 1 → NO Group 1 created
  - Processes index 2 → creates Group 2

Field B: ["valueA", "valueB", "valueC"]
  - Processes index 0 → finds Group 0
  - Processes index 1 → creates NEW Group 1 (should have existed!)
  - Processes index 2 → finds Group 2

Result: Field A and Field B have different populations at index 1! ❌
```

### Fix
Changed logic to **always** create groups (even for blank segments), but only store values for non-blank segments:

```typescript
segments.forEach((segment, index) => {
  // Parse the entry (even if blank) to maintain position alignment
  const entry = parseEntry(field.fieldId, segment);
  
  // Always resolve the group to ensure it exists at this position
  const group = resolveGroupForEntry(groups, labelLookup, entry, index);
  
  // Only store a value if the segment is not blank
  if (segment !== '') {
    // ... store label and value
    group.values[field.fieldId] = entry.value ?? null;
  }
  // If segment is blank, group is created but no value is stored
});
```

**Result:**
```
Field A: ["value1", "", "value3"]
  - Index 0 → Group 0 created, stores "value1" ✅
  - Index 1 → Group 1 created, stores nothing ✅
  - Index 2 → Group 2 created, stores "value3" ✅

Field B: ["valueA", "valueB", "valueC"]
  - Index 0 → finds Group 0, stores "valueA" ✅
  - Index 1 → finds Group 1, stores "valueB" ✅
  - Index 2 → finds Group 2, stores "valueC" ✅

All fields aligned at the same group positions! ✅
```

---

## Bug #3: ageCategory Still Using splitEntries()

### Problem
The `ageCategory` field (processed separately as the population-defining field) was still using `splitEntries()`:

```typescript
if (ageField?.value) {
  splitEntries(ageField.value).forEach((segment, index) => {  // ❌ FILTERS BLANKS
    // ... create group
  });
}
```

While all other fields were fixed to preserve blanks, `ageCategory` still filtered them out. This broke alignment when ageCategory had blank rows:

**Example:**
```
ageCategory: "U19\n\nU21" → splitEntries returns ["U19", "U21"]
                           → Creates Groups at positions [0, 1]

Age: "20\n25\n30"         → split preserves blanks
                           → Processes positions [0, 1, 2]
                           → But only Groups 0 and 1 exist!

Result: Position 2 has no group to attach to! ❌
```

### Fix
Changed ageCategory processing to match other fields:

```typescript
if (ageField?.value) {
  // Split on newlines WITHOUT filtering out blanks to preserve row alignment
  ageField.value.split(/\r?\n/).map((line) => line.trim()).forEach((segment, index) => {
    const entry = parseEntry('ageCategory', segment);
    const label = entry.label ?? entry.value ?? `Population ${index + 1}`;
    const group = ensureGroup(groups, labelLookup, index, label);
    
    // Only store value and label if segment is not blank
    if (segment !== '') {
      group.values.ageCategory = entry.value;
      if (!group.label) {
        group.label = label;
        labelLookup.set(normalizeLabel(label), group);
      }
    }
    // If segment is blank, group is still created to preserve position
  });
}
```

**Result:**
```
ageCategory: "U19\n\nU21" → segments = ["U19", "", "U21"]
                           → Creates Groups at positions [0, 1, 2] ✅

Age: "20\n25\n30"         → segments = ["20", "25", "30"]
                           → Attaches to Groups [0, 1, 2] ✅

Perfect alignment! ✅
```

---

## Key Principle

**Blank lines in multi-line fields are intentional position markers, not data to be filtered.**

The line number (index) is what links values across different fields:
- Line 0 of Gender → Line 0 of Age → Line 0 of Injuries → **Population 0**
- Line 1 of Gender → Line 1 of Age → Line 1 of Injuries → **Population 1**
- Line 2 of Gender → Line 2 of Age → Line 2 of Injuries → **Population 2**

Even if a field has no data at a particular line (blank), the group must exist at that position to maintain alignment.

---

## Files Modified

1. **`fifa-gbi-data-extraction/src/lib/extraction/populations.ts`**
   - Line 128: Changed ageCategory processing from `splitEntries()` to `.split(/\r?\n/)`
   - Line 137-144: Added blank segment handling for ageCategory
   - Line 152: Changed field processing from `splitEntries()` to `.split(/\r?\n/)`
   - Line 159-186: Updated to always create groups (even for blanks), but only store values for non-blanks

---

## Testing Scenarios

### Scenario 1: Blank in Middle
```
Input:
  ageCategory: "U19\n\nU21"
  meanAge: "18.5\n20.5\n22.5"
  injuries: "50\n\n40"

Output (3 rows):
  Row 0: U19, 18.5, 50
  Row 1: (blank), 20.5, (blank)
  Row 2: U21, 22.5, 40
```

### Scenario 2: Blank at Start
```
Input:
  ageCategory: "\nU19\nU21"
  meanAge: "16.5\n18.5\n20.5"

Output (3 rows):
  Row 0: (blank), 16.5
  Row 1: U19, 18.5
  Row 2: U21, 20.5
```

### Scenario 3: Multiple Blanks
```
Input:
  ageCategory: "U17\n\n\nU21"
  meanAge: "16.5\n17.5\n18.5\n20.5"

Output (4 rows):
  Row 0: U17, 16.5
  Row 1: (blank), 17.5
  Row 2: (blank), 18.5
  Row 3: U21, 20.5
```

---

## Impact

✅ **Fixed:** Multi-population data with intentional blank rows now exports correctly  
✅ **Fixed:** Position-based alignment works consistently across all fields  
✅ **Fixed:** ageCategory processing matches other fields  
✅ **Fixed:** Table editor blank row preservation is fully supported  
✅ **Maintained:** Backward compatibility with data that has no blank rows

---

**Status:** ✅ **ALL THREE BUGS FIXED - NO LINTER ERRORS - READY TO COMMIT!**

