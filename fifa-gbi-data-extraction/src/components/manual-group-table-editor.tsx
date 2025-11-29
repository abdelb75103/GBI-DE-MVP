'use client';

import { useContext, useEffect, useMemo, useState } from 'react';

import { extractionMetrics } from '@/lib/extraction/schema';
import type { ExtractionFieldDefinition } from '@/lib/extraction/schema';
import { WorkspaceSaveContext } from '@/components/workspace-save-manager';
import type {
  ExtractionFieldMetric,
  ExtractionFieldResult,
  ExtractionTab,
} from '@/lib/types';

type ManualGroupTableEditorProps = {
  paperId: string;
  tab: ExtractionTab;
  groupLabel: string;
  groupDescription?: string;
  fields: ExtractionFieldDefinition[];
  results: Map<string, ExtractionFieldResult>;
};

type PopulationRow = {
  id: string; // Stable identifier for each row
  diagnosis: string;
  values: Record<ExtractionFieldMetric, string>;
};

export function ManualGroupTableEditor({
  paperId,
  tab,
  groupLabel,
  groupDescription,
  fields,
  results,
}: ManualGroupTableEditorProps) {
  const { updateField, getFieldValue } = useContext(WorkspaceSaveContext);
  const [rows, setRows] = useState<PopulationRow[]>([]);

  const fieldsByMetric = useMemo(
    () =>
      new Map(
        fields
          .filter((field): field is ExtractionFieldDefinition & { metric: ExtractionFieldMetric } => Boolean(field.metric))
          .map((field) => [field.metric, field]),
      ),
    [fields],
  );
  const diagnosisField = useMemo(
    () => fields.find((field) => field.id.endsWith('_diagnosis')),
    [fields],
  );

  // Parse multi-line data into rows with strict 1:1 row mapping
  // Row 1 in storage = Row 1 in table, Row 2 = Row 2, etc.
  // Blank cells remain blank - no autocomplete or extension
  useEffect(() => {
    const hydratedRows: PopulationRow[] = [];

    // Find the maximum row count across ALL metrics for this tab
    // This ensures we show the same number of rows for all metrics
    // Each tab is independent - we only look at fields for this specific tab
    const getLinesForField = (fieldId: string) => {
      const localValue = getFieldValue(tab, fieldId);
      const currentValue = localValue !== undefined ? localValue : (results.get(fieldId)?.value ?? '');
      return currentValue ? currentValue.split('\n') : [];
    };

    const metricRowCount = extractionMetrics.reduce((max, { metric }) => {
      const field = fieldsByMetric.get(metric);
      if (!field) {
        return max;
      }
      // Only use data from current tab - no cross-tab autocomplete
      const lines = getLinesForField(field.id);
      return lines.length ? Math.max(max, lines.length) : max;
    }, 1);
    const diagnosisLines = diagnosisField ? getLinesForField(diagnosisField.id) : [];
    const rowCount = Math.max(metricRowCount, diagnosisLines.length || 0, 1);

    // Create rows based on strict position mapping (index 0 = Row 1, index 1 = Row 2, etc.)
    for (let index = 0; index < rowCount; index++) {
      const values: Record<ExtractionFieldMetric, string> = {} as Record<ExtractionFieldMetric, string>;
      extractionMetrics.forEach(({ metric }) => {
        const field = fieldsByMetric.get(metric);
        if (!field) {
          return;
        }
        // Only use data from current tab
        const lines = getLinesForField(field.id);
        // Get value at exact index position - if missing, use empty string (blank cell)
        // This ensures strict 1:1 mapping: Row 1 = lines[0], Row 2 = lines[1], etc.
        values[metric] = lines[index] ?? '';
      });
      // Use index-based ID to maintain position mapping
      hydratedRows.push({
        id: `${groupLabel}-row-${index}`,
        diagnosis: diagnosisLines[index] ?? '',
        values,
      });
    }

    setRows(hydratedRows);
  }, [results, getFieldValue, tab, groupLabel, fieldsByMetric, diagnosisField]);

  const serializeRows = (rowState: PopulationRow[], metric: ExtractionFieldMetric): string | null => {
    const field = fieldsByMetric.get(metric);
    if (!field) {
      return null;
    }
    
    // Map ALL rows - preserve empty strings for blank cells
    // This ensures strict 1:1 row mapping (Row 1 = Row 1, Row 2 = Row 2, etc.)
    const lines = rowState.map((row) => {
      const value = row.values[metric] ?? '';
      return value; // Explicitly return empty string if blank - preserves row position
    });
    
    // Check if ANY row has content
    const hasContent = lines.some((line) => line.trim().length > 0);
    if (!hasContent) {
      return null; // Return null only if ALL rows are blank
    }
    
    // Join with newlines - empty strings will create empty lines
    // This ensures all metrics have the same number of lines (same row count)
    return lines.join('\n');
  };

  const serializeDiagnosis = (rowState: PopulationRow[]): string | null => {
    if (!diagnosisField) {
      return null;
    }
    const lines = rowState.map((row) => row.diagnosis ?? '');
    const hasContent = lines.some((line) => line.trim().length > 0);
    return hasContent ? lines.join('\n') : null;
  };

  const commitMetric = (rowState: PopulationRow[], metric: ExtractionFieldMetric) => {
    const field = fieldsByMetric.get(metric);
    if (!field) {
      return;
    }
    const value = serializeRows(rowState, metric);
    updateField({
      paperId,
      tab,
      fieldId: field.id,
      value,
      metric: field.metric,
    });
  };

  const commitDiagnosis = (rowState: PopulationRow[]) => {
    if (!diagnosisField) {
      return;
    }
    const value = serializeDiagnosis(rowState);
    updateField({
      paperId,
      tab,
      fieldId: diagnosisField.id,
      value,
      metric: diagnosisField.metric,
    });
  };

  const handleCellChange = (rowId: string, key: ExtractionFieldMetric | 'diagnosis', value: string) => {
    const next = rows.map((row) =>
      row.id === rowId
        ? key === 'diagnosis'
          ? { ...row, diagnosis: value }
          : { ...row, values: { ...row.values, [key]: value } }
        : row,
    );
    setRows(next);
    if (key === 'diagnosis') {
      commitDiagnosis(next);
    } else {
      commitMetric(next, key);
    }
  };

  const commitAllColumns = (rowState: PopulationRow[]) => {
    if (diagnosisField) {
      commitDiagnosis(rowState);
    }
    extractionMetrics.forEach(({ metric }) => commitMetric(rowState, metric));
  };

  const addRow = () => {
    // Add a new blank row at the end
    // Use index-based ID to maintain strict position mapping
    const newRow: PopulationRow = {
      id: `${groupLabel}-row-${rows.length}`, // Use current length as index for new row
      diagnosis: '',
      values: extractionMetrics.reduce((acc, { metric }) => {
        acc[metric] = ''; // All cells start blank - no autocomplete
        return acc;
      }, {} as Record<ExtractionFieldMetric, string>),
    };
    const next = [...rows, newRow];
    setRows(next);
    commitAllColumns(next);
  };

  const removeRow = (rowId: string) => {
    if (rows.length <= 1) {
      return;
    }
    // Remove the row and renumber remaining rows to maintain strict position mapping
    // After removal, Row 3 becomes Row 2, Row 4 becomes Row 3, etc.
    // This is normal table behavior - we maintain sequential positions
    const next = rows.filter((row) => row.id !== rowId);
    setRows(next);
    commitAllColumns(next);
  };

  const diagnosisColumnLabel = 'Injury diagnosis';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="space-y-0.5">
          <h4 className="text-base font-semibold text-slate-900">{groupLabel}</h4>
          {groupDescription ? <p className="text-sm font-medium text-slate-500">{groupDescription}</p> : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {diagnosisField ? (
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                  {diagnosisColumnLabel}
                </th>
              ) : null}
              {extractionMetrics.map(({ metric, label }) => (
                <th
                  key={metric}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600"
                >
                  {label}
                </th>
              ))}
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                {diagnosisField ? (
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={row.diagnosis}
                      onChange={(e) => handleCellChange(row.id, 'diagnosis', e.target.value)}
                      placeholder=""
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-300 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </td>
                ) : null}
                {extractionMetrics.map(({ metric }) => (
                  <td key={metric} className="px-4 py-3">
                    <input
                      type="text"
                      value={row.values[metric] ?? ''}
                      onChange={(e) => handleCellChange(row.id, metric, e.target.value)}
                      placeholder=""
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-300 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </td>
                ))}
                <td className="px-4 py-3">
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="text-slate-400 hover:text-red-600 transition"
                      title="Remove row"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-5 w-5"
                      >
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900 transition"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          Add Row
        </button>
      </div>
    </div>
  );
}
