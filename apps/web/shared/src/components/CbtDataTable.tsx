import type { ReactNode } from 'react';

export interface CbtColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'center' | 'right';
  dangerRow?: (row: T) => boolean;
}

interface CbtDataTableProps<T> {
  columns: CbtColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}

export function CbtDataTable<T>({ columns, rows, rowKey }: CbtDataTableProps<T>) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="cbt-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const danger = columns.some((c) => c.dangerRow?.(row));
            return (
              <tr key={rowKey(row)} className={danger ? 'cbt-row-danger' : undefined}>
                {columns.map((c) => (
                  <td key={c.key} style={{ textAlign: c.align ?? 'left' }}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
