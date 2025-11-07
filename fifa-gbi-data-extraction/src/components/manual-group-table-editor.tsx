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
  fields: ExtractionFieldDefinition[];
  results: Map<string, ExtractionFieldResult>;
};

type PopulationRow = {
  id: string; // Unique ID for each row
  label: string;
  values: Record<ExtractionFieldMetric, string>;
};

export function ManualGroupTableEditor({
  paperId,
  tab,
  groupLabel,
  fields,
  results,
}: ManualGroupTableEditorProps) {
  const { updateField, getFieldValue } = useContext(WorkspaceSaveContext);
  const [rows, setRows] = useState<PopulationRow[]>([]);

  const fieldsByMetric = useMemo(
    () => new Map(fields.map((field) => [field.metric!, field])),
    [fields]
  );

  // Parse multi-line data into rows
  useEffect(() => {
    const parsedRows: PopulationRow[] = [];
    const maxLines = new Map<ExtractionFieldMetric, number>();

    // Find the maximum number of lines across all metrics (keep blank lines!)
    extractionMetrics.forEach(({ metric }) => {
      const field = fieldsByMetric.get(metric);
      if (!field) return;

      const localValue = getFieldValue(tab, field.id);
      const currentValue = localValue !== undefined ? localValue : (results.get(field.id)?.value ?? '');
      const lines = currentValue ? currentValue.split('\n') : []; // DON'T filter blank lines
      maxLines.set(metric, lines.length);
    });

    const numRows = Math.max(1, ...Array.from(maxLines.values()));

    // Create rows, preserving blank rows
    for (let i = 0; i < numRows; i++) {
      const row: PopulationRow = {
        id: `${groupLabel}-row-${i}`,
        label: '',
        values: {} as Record<ExtractionFieldMetric, string>,
      };

      extractionMetrics.forEach(({ metric }) => {
        const field = fieldsByMetric.get(metric);
        if (!field) return;

        const localValue = getFieldValue(tab, field.id);
        const currentValue = localValue !== undefined ? localValue : (results.get(field.id)?.value ?? '');
        const lines = currentValue ? currentValue.split('\n') : []; // DON'T filter blank lines
        const lineValue = lines[i] ?? '';

        // NEW SIMPLER FORMAT: Labels and values are separate
        // Check if this is the first metric (prevalence/count) which stores labels
        if (metric === 'prevalence' && lineValue.trim() && !lineValue.includes('-')) {
          // This is a standalone label (new format)
          if (!row.label) row.label = lineValue.trim();
          row.values[metric] = '';
        } else if (lineValue.includes('-')) {
          // Legacy format: "label - value"
          const match = lineValue.match(/^(.+?)\s*[:\-–-]\s*(.+)$/);
          if (match) {
            if (!row.label) row.label = match[1].trim();
            row.values[metric] = match[2].trim();
          } else {
            row.values[metric] = lineValue.trim();
          }
        } else if (lineValue.trim()) {
          // Just a value (new format)
          row.values[metric] = lineValue.trim();
        } else {
          // Blank cell
          row.values[metric] = '';
        }
      });

      parsedRows.push(row);
    }

    setRows(parsedRows);
  }, [results, getFieldValue, tab, groupLabel, fieldsByMetric]);

  const handleCellChange = (rowId: string, metric: ExtractionFieldMetric, value: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.id === rowId ? { ...row, values: { ...row.values, [metric]: value } } : row,
      ),
    );

    // Convert rows back to multi-line format for each metric
    const field = fieldsByMetric.get(metric);
    if (!field) return;

    const updatedRows = rows.map((row) =>
      row.id === rowId ? { ...row, values: { ...row.values, [metric]: value } } : row,
    );

    const lines = updatedRows.map((row) => {
      const cellValue = row.values[metric] ?? '';
      const hasValue = cellValue && cellValue.trim();
      const hasLabel = row.label && row.label.trim();
      
      // If both label and value exist, format as "label - value"
      if (hasLabel && hasValue) {
        return `${row.label} - ${cellValue}`;
      }
      // If only value exists, return just the value
      if (hasValue) {
        return cellValue;
      }
      // NEW FORMAT: Labels and values are separate
      // If this row has a label but no value for THIS cell
      // For the FIRST metric (prevalence/count), save just the label to preserve it (without "-")
      // For other metrics, save empty string
      if (hasLabel) {
        if (metric === 'prevalence') {
          return row.label;  // Save label alone (NEW: no "- value" format)
        }
        return '';  // Empty line to preserve row index
      }
      // Completely empty row
      return '';
    });
    
    const multiLineValue = lines.join('\n');
    
    // Only trim trailing newlines if there's actual content somewhere
    const hasAnyContent = lines.some((line) => line.trim().length > 0);
    const finalValue = hasAnyContent 
      ? multiLineValue.replace(/\n+$/, '')  // Trim trailing empties only if we have content
      : (updatedRows.some((row) => row.label && row.label.trim()) 
          ? multiLineValue  // Keep structure if we have labels
          : null);  // Completely empty - save as null

    updateField({
      paperId,
      tab,
      fieldId: field.id,
      value: finalValue,
      metric: field.metric,
    });
  };

  const handleLabelChange = (rowId: string, label: string) => {
    setRows((prev) => prev.map((row) => (row.id === rowId ? { ...row, label } : row)));

    // Update all metrics with the new label
    const updatedRows = rows.map((row) => (row.id === rowId ? { ...row, label } : row));

    extractionMetrics.forEach(({ metric }) => {
      const field = fieldsByMetric.get(metric);
      if (!field) return;

      const lines = updatedRows.map((row) => {
        const cellValue = row.values[metric] ?? '';
        const hasValue = cellValue && cellValue.trim();
        const hasLabel = row.label && row.label.trim();
        
        // If both label and value exist, format as "label - value"
        if (hasLabel && hasValue) {
          return `${row.label} - ${cellValue}`;
        }
        // If only value exists, return just the value
        if (hasValue) {
          return cellValue;
        }
        // If this row has a label but no value for THIS cell
        // For the FIRST metric (prevalence/count), save just the label to preserve it
        // For other metrics, save empty string
        if (hasLabel) {
          if (metric === 'prevalence') {
            return row.label;  // Save label in first metric to preserve it
          }
          return '';  // Empty line to preserve row index
        }
        // Completely empty row
        return '';
      });
      
      const multiLineValue = lines.join('\n');
      
      // Only trim trailing newlines if there's actual content somewhere
      const hasAnyContent = lines.some((line) => line.trim().length > 0);
      const finalValue = hasAnyContent 
        ? multiLineValue.replace(/\n+$/, '')  // Trim trailing empties only if we have content
        : (updatedRows.some((row) => row.label && row.label.trim()) 
            ? multiLineValue  // Keep structure if we have labels
            : null);  // Completely empty - save as null

      updateField({
        paperId,
        tab,
        fieldId: field.id,
        value: finalValue,
        metric: field.metric,
      });
    });
  };

  const addRow = () => {
    const newRow: PopulationRow = {
      id: `${groupLabel}-row-${Date.now()}`,
      label: '',
      values: {} as Record<ExtractionFieldMetric, string>,
    };
    extractionMetrics.forEach(({ metric }) => {
      newRow.values[metric] = '';
    });
    setRows((prev) => [...prev, newRow]);
  };

  const removeRow = (rowId: string) => {
    const updatedRows = rows.filter((row) => row.id !== rowId);
    setRows(updatedRows);

    // Update all fields
    extractionMetrics.forEach(({ metric }) => {
      const field = fieldsByMetric.get(metric);
      if (!field) return;

      const lines = updatedRows.map((row) => {
        const cellValue = row.values[metric] ?? '';
        const hasValue = cellValue && cellValue.trim();
        const hasLabel = row.label && row.label.trim();
        
        // If both label and value exist, format as "label - value"
        if (hasLabel && hasValue) {
          return `${row.label} - ${cellValue}`;
        }
        // If only value exists, return just the value
        if (hasValue) {
          return cellValue;
        }
        // If this row has a label but no value for THIS cell
        // For the FIRST metric (prevalence/count), save just the label to preserve it
        // For other metrics, save empty string
        if (hasLabel) {
          if (metric === 'prevalence') {
            return row.label;  // Save label in first metric to preserve it
          }
          return '';  // Empty line to preserve row index
        }
        // Completely empty row
        return '';
      });
      
      const multiLineValue = lines.join('\n');
      
      // Only trim trailing newlines if there's actual content somewhere
      const hasAnyContent = lines.some((line) => line.trim().length > 0);
      const finalValue = hasAnyContent 
        ? multiLineValue.replace(/\n+$/, '')  // Trim trailing empties only if we have content
        : (updatedRows.some((row) => row.label && row.label.trim()) 
            ? multiLineValue  // Keep structure if we have labels
            : null);  // Completely empty - save as null

      updateField({
        paperId,
        tab,
        fieldId: field.id,
        value: finalValue,
        metric: field.metric,
      });
    });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <h4 className="text-sm font-semibold text-slate-700">{groupLabel}</h4>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                Population
              </th>
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
            {rows.map((row, idx) => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => handleLabelChange(row.id, e.target.value)}
                    placeholder={`Population ${idx + 1}`}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                </td>
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
          Add Population
        </button>
      </div>
    </div>
  );
}

