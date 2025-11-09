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
  id: string; // Stable identifier for each row
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

  // Parse multi-line data into rows without relying on population labels
  useEffect(() => {
    const hydratedRows: PopulationRow[] = [];

    const rowCount = extractionMetrics.reduce((max, { metric }) => {
      const field = fieldsByMetric.get(metric);
      if (!field) {
        return max;
      }
      const localValue = getFieldValue(tab, field.id);
      const currentValue = localValue !== undefined ? localValue : (results.get(field.id)?.value ?? '');
      if (!currentValue) {
        return max;
      }
      const lines = currentValue.split('\n');
      return Math.max(max, lines.length);
    }, 1);

    for (let index = 0; index < rowCount; index++) {
      const values: Record<ExtractionFieldMetric, string> = {} as Record<ExtractionFieldMetric, string>;
      extractionMetrics.forEach(({ metric }) => {
        const field = fieldsByMetric.get(metric);
        if (!field) {
          return;
        }
        const localValue = getFieldValue(tab, field.id);
        const currentValue = localValue !== undefined ? localValue : (results.get(field.id)?.value ?? '');
        const lines = currentValue ? currentValue.split('\n') : [];
        values[metric] = lines[index]?.trim() ?? '';
      });
      hydratedRows.push({ id: `${groupLabel}-row-${index}`, values });
    }

    setRows(hydratedRows);
  }, [results, getFieldValue, tab, groupLabel, fieldsByMetric]);

  const serializeRows = (rowState: PopulationRow[], metric: ExtractionFieldMetric): string | null => {
    const field = fieldsByMetric.get(metric);
    if (!field) {
      return null;
    }
    const lines = rowState.map((row) => row.values[metric]?.trim() ?? '');
    const hasContent = lines.some((line) => line.length > 0);
    if (!hasContent) {
      return null;
    }
    return lines.join('\n');
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

  const handleCellChange = (rowId: string, metric: ExtractionFieldMetric, value: string) => {
    const next = rows.map((row) =>
      row.id === rowId ? { ...row, values: { ...row.values, [metric]: value } } : row,
    );
    setRows(next);
    commitMetric(next, metric);
  };

  const addRow = () => {
    const newRow: PopulationRow = {
      id: `${groupLabel}-row-${Date.now()}`,
      values: extractionMetrics.reduce((acc, { metric }) => {
        acc[metric] = '';
        return acc;
      }, {} as Record<ExtractionFieldMetric, string>),
    };
    const next = [...rows, newRow];
    setRows(next);
    extractionMetrics.forEach(({ metric }) => commitMetric(next, metric));
  };

  const removeRow = (rowId: string) => {
    if (rows.length <= 1) {
      return;
    }
    const next = rows.filter((row) => row.id !== rowId);
    setRows(next);
    extractionMetrics.forEach(({ metric }) => commitMetric(next, metric));
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
