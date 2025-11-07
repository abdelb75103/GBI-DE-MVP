# Export Fix Summary

## Issues Fixed

### 1. ✅ Removed "Population Label" from CSV Export
**Problem:** The export was including a "Population Label" column.
**Solution:** Removed it from `baseHeaders` and from the row construction in `exporters.ts`.

### 2. ✅ Changed "Prevalence" to "Count"
**Problem:** The metric was labeled as "Prevalence" but should be "Count".
**Solution:** Updated all references in `schema.ts`:
- `extractionMetrics` array
- `metricDescriptions` array
- All tab descriptions

### 3. ✅ Fixed Metric Fields Not Creating Separate Rows
**Problem:** Metric-based table data wasn't creating proper population groups with metric info.
**Solution:** Updated `syncPopulationSlices` in `mock-db.ts` to:
- Build a map of `fieldId -> metric` from the original extraction fields
- Store the metric information in `population_values` when creating rows
- This ensures each population's metric data is properly linked

## How It Works Now

### Data Flow:
1. **User enters data in table** (e.g., "Muscle/tendon" group):
   ```
   Population | Count | Incidence | Burden | ...
   U19        | 50    | 3.2       | 45     | ...
   U21        | 40    | 2.8       | 38     | ...
   ```

2. **Table editor saves as multi-line format**:
   ```
   field_id: "injuryTissueType_muscle_tendon_prevalence"
   value: "U19 — 50\nU21 — 40"
   metric: "prevalence"
   ```

3. **syncPopulationSlices parses and creates**:
   - 2 population_groups (U19, U21)
   - Multiple population_values per group:
     - group: U19, field: "...prevalence", value: "50", metric: "prevalence"
     - group: U19, field: "...incidence", value: "3.2", metric: "incidence"
     - group: U21, field: "...prevalence", value: "40", metric: "prevalence"
     - group: U21, field: "...incidence", value: "2.8", metric: "incidence"

4. **Export creates**:
   ```csv
   Paper ID, Paper Title, Status, ...all fields..., Muscle/tendon – Count, Muscle/tendon – Incidence, ...
   STUDY001, "Example", extracted, ..., 50, 3.2, ...
   STUDY001, "Example", extracted, ..., 40, 2.8, ...
   ```

## Testing Checklist

- [ ] Open a metric tab (Injury Tissue & Type)
- [ ] Add 2+ populations with different values
- [ ] Save the paper
- [ ] Export the paper
- [ ] Verify CSV has:
  - ✅ Multiple rows (one per population)
  - ✅ NO "Population Label" column
  - ✅ "Count" instead of "Prevalence" in headers
  - ✅ Each row has correct values for its population

## Files Modified

1. `fifa-gbi-data-extraction/src/lib/exporters.ts`
   - Removed "Population Label" from baseHeaders
   - Removed population label cell from row construction

2. `fifa-gbi-data-extraction/src/lib/extraction/schema.ts`
   - Changed "Prevalence" → "Count" in extractionMetrics
   - Changed "Prevalence" → "Count" in metricDescriptions
   - Updated tab descriptions

3. `fifa-gbi-data-extraction/src/lib/mock-db.ts`
   - Added fieldMetricMap to preserve metric info
   - Store metric in population_values when syncing

---

**Status:** ✅ READY TO TEST

