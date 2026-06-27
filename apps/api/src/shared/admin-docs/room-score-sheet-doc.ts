import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { ND30_DEFAULT_STYLE, nd30TableLayout } from './nd30Layout';
import { PDF_FONT_FAMILY } from './fonts';

export interface RoomScoreSheetRow {
  stt: number;
  sbd: string;
  fullName: string;
  className: string;
  part1: string | number;
  part2: string | number;
  part3: string | number;
  total: string | number;
  note?: string;
}

export function buildRoomScoreListPdfDefinition(rows: RoomScoreSheetRow[]): TDocumentDefinitions {
  const tableBody = [
    [
      { text: 'STT', bold: true, alignment: 'center' as const, fontSize: 11 },
      { text: 'SBD', bold: true, alignment: 'center' as const, fontSize: 11 },
      { text: 'Họ và tên', bold: true, alignment: 'center' as const, fontSize: 11 },
      { text: 'Lớp', bold: true, alignment: 'center' as const, fontSize: 11 },
      { text: 'P.I', bold: true, alignment: 'center' as const, fontSize: 11 },
      { text: 'P.II', bold: true, alignment: 'center' as const, fontSize: 11 },
      { text: 'P.III', bold: true, alignment: 'center' as const, fontSize: 11 },
      { text: 'Tổng', bold: true, alignment: 'center' as const, fontSize: 11 },
    ],
    ...rows.map((r) => [
      { text: String(r.stt), alignment: 'center' as const, fontSize: 11 },
      { text: r.sbd, alignment: 'center' as const, fontSize: 11 },
      { text: r.fullName, fontSize: 11 },
      { text: r.className, alignment: 'center' as const, fontSize: 11 },
      { text: String(r.part1), alignment: 'center' as const, fontSize: 11 },
      { text: String(r.part2), alignment: 'center' as const, fontSize: 11 },
      { text: String(r.part3), alignment: 'center' as const, fontSize: 11 },
      { text: String(r.total), bold: true, alignment: 'center' as const, fontSize: 11 },
    ]),
  ];

  const content: Content[] = [
    {
      table: {
        headerRows: 1,
        widths: [28, 52, '*', 48, 38, 38, 38, 42],
        body: tableBody,
      },
      layout: nd30TableLayout(),
    },
  ];

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [36, 36, 36, 36],
    defaultStyle: { ...ND30_DEFAULT_STYLE, fontSize: 11, font: PDF_FONT_FAMILY },
    content,
  };
}

/** Flatten doc definition content for unit test assertions. */
export function flattenPdfContentForTest(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(flattenPdfContentForTest).join(' ');
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof obj.text === 'string') parts.push(obj.text);
    if (Array.isArray(obj.text)) {
      for (const t of obj.text) {
        if (typeof t === 'string') parts.push(t);
        else if (t && typeof t === 'object' && 'text' in t) {
          parts.push(String((t as { text: unknown }).text));
        }
      }
    }
    for (const key of ['content', 'stack', 'columns', 'body']) {
      if (key in obj) parts.push(flattenPdfContentForTest(obj[key]));
    }
    if ('table' in obj && obj.table && typeof obj.table === 'object') {
      parts.push(flattenPdfContentForTest((obj.table as { body?: unknown }).body));
    }
    return parts.join(' ');
  }
  return '';
}
