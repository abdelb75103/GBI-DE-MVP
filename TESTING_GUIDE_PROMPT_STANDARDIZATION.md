# Testing Guide: Prompt Standardization Changes

## Overview
This guide helps verify that the AI extraction prompts now return standardized, clean values without unwanted units or labels in numerical fields.

## What Was Changed

### 1. **Extraction Instructions Page**
- Added tabbed interface with "Extraction Workflow" and "Codebook" tabs
- New Codebook tab contains consensus definitions for reference during extraction

### 2. **AI Extraction Prompts** (`src/lib/extraction/prompt.ts`)
- Added comprehensive standardization rules for:
  - Categorical fields (studyDesign, fifaDiscipline, levelOfPlay, etc.)
  - Numerical fields without units (exposure, age, counts)
  - Fields that retain units (duration, time-loss, percentages)
  - Confidence intervals (as reported by authors)

### 3. **Field Descriptions** (`src/lib/extraction/schema.ts`)
- Updated 20+ field descriptions to specify expected formats
- Clear guidance on what values to extract and what to exclude

## Testing Checklist

### A. Visual Testing - Codebook Tab

1. Navigate to `/extraction-instructions` in the application
2. Verify you see two tabs: "Extraction Workflow" and "Codebook"
3. Click the "Codebook" tab
4. Verify all sections are present:
   - Core Concepts (Health Problem, Injury, Illness, Medical-Attention vs Time-Loss)
   - Severity Classification (7 severity bands with days)
   - Recurrence Types (Early, Late, Delayed)
   - Exposure Types (Match, Training, Prematch, Postmatch)
   - Mechanism Categories (Mode of Onset, Contact Types, Football-Specific)
   - References
5. Verify styling is consistent with the rest of the application

### B. Functional Testing - AI Extraction

To properly test the AI extraction, you'll need to:

1. **Select a test paper** with clear examples of:
   - Study design (prospective/retrospective/etc.)
   - Injury definition (medical attention/time-loss)
   - Numerical data with units (e.g., "250 hours", "20.5 years", "3.2 per 1000 hours")
   - Multiple populations (male/female or different age groups)

2. **Test Categorical Field Standardization**

   **Study Design Field:**
   - Paper states: "This was a prospective cohort study..."
   - Expected AI output: `"prospective cohort"` (exactly)
   - NOT: "This was a prospective cohort study" or "Prospective Cohort"

   **Injury Definition Field:**
   - Paper states: "Injuries were defined as any physical complaint requiring medical attention..."
   - Expected AI output: `"medical attention"` (exactly)
   - NOT: "any physical complaint requiring medical attention"

   **FIFA Discipline Field:**
   - Paper about futsal
   - Expected AI output: `"futsal"` (exactly)
   - NOT: "Futsal" or "FIFA Futsal"

3. **Test Numerical Fields WITHOUT Units**

   **Match Exposure:**
   - Paper states: "Total match exposure was 250 hours"
   - Expected AI output: `"250"` (number only)
   - NOT: "250 hours" or "250 h"

   **Mean Age:**
   - Paper states: "Mean age was 20.5 ± 2.1 years"
   - Expected AI output: `"20.5 ± 2.1"` (no "years")
   - NOT: "20.5 ± 2.1 years"

   **Sample Size:**
   - Paper states: "62 male players and 60 female players"
   - Expected AI output for sampleSizePlayers: `"62\n60"` (values only, separate lines)
   - NOT: "male - 62\nfemale - 60" or "62 male\n60 female"

4. **Test Fields WITH Units/Symbols Retained**

   **Injury Recurrence Rate:**
   - Paper states: "Recurrence rate was 15.2%"
   - Expected AI output: `"15.2%"` (WITH % symbol)
   - NOT: "15.2"

   **Duration Fields:**
   - Paper states: "Mean injury duration was 7.2 days"
   - Expected AI output: `"7.2 days"` (WITH unit for clarity)
   - Can also accept: `"7.2"` if clear from context

5. **Test Multi-Population Consistency**

   **Scenario:** Paper reports data for U19 and U21 age groups
   
   - Age Category (identifier field): `"U19\nU21"` ✓
   - Sample Size: `"45\n38"` ✓ (NOT "U19 - 45\nU21 - 38")
   - Mean Age: `"18.2 ± 1.1\n20.5 ± 1.3"` ✓ (values only)
   - Injury Count: `"25\n18"` ✓ (NOT "U19 - 25\nU21 - 18")

   All value fields should align by line number without population labels.

### C. Testing Procedure

1. **Open a paper workspace** in the application
2. **Navigate to an AI-assisted tab** (Study Details, Participant Characteristics, Definitions, or Exposure)
3. **Select fields to extract**
4. **Run AI extraction**
5. **Review the extracted values** against the expected formats above
6. **Check for:**
   - Categorical fields return exact standardized values
   - Numerical fields have no units (except where specified)
   - Multi-population data has values only (no labels) in non-identifier fields
   - Percentage fields retain the % symbol
   - No extraneous text or formatting

### D. Common Issues to Watch For

❌ **WRONG:**
- `studyDesign: "This was a prospective cohort study conducted..."`
- `matchExposure: "250 hours"`
- `injuryDefinition: "Injury was defined as any physical complaint..."`
- `sampleSizePlayers: "male - 62\nfemale - 60"`
- `injuryRecurrenceRate: "15.2"` (missing %)

✅ **CORRECT:**
- `studyDesign: "prospective cohort"`
- `matchExposure: "250"`
- `injuryDefinition: "medical attention"`
- `sampleSizePlayers: "62\n60"`
- `injuryRecurrenceRate: "15.2%"`

## Expected Benefits

After successful implementation, you should see:

1. **Cleaner data exports** - No manual cleaning of units from numerical fields
2. **Consistent categorical values** - Easier filtering and grouping in analysis
3. **Proper multi-population alignment** - Clear row-by-row matching across fields
4. **Reduced post-processing** - Data ready for statistical analysis
5. **Better user guidance** - Codebook provides reference for standardized definitions

## Rollback Instructions

If the changes cause issues:

1. **Revert prompt.ts:**
   ```bash
   git checkout HEAD~1 -- fifa-gbi-data-extraction/src/lib/extraction/prompt.ts
   ```

2. **Revert schema.ts:**
   ```bash
   git checkout HEAD~1 -- fifa-gbi-data-extraction/src/lib/extraction/schema.ts
   ```

3. **Revert page.tsx:**
   ```bash
   git checkout HEAD~1 -- fifa-gbi-data-extraction/src/app/extraction-instructions/page.tsx
   ```

## Notes

- The AI model (Gemini) may still occasionally deviate from instructions
- Human review is still required for all AI-extracted values
- Field descriptions are now more prescriptive to guide both AI and human extractors
- The Codebook tab serves as quick reference during extraction

## Contact

If you encounter issues or unexpected behavior, document:
- Which field(s) showed incorrect formatting
- What the AI returned vs. what was expected
- The source text from the paper
- Screenshots if helpful

This will help refine the prompts further if needed.

