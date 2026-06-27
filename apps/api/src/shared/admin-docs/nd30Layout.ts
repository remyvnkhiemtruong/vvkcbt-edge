import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { AdminDocContext } from './types';
import { formatVnDate } from './adminDocFormat';
import { PDF_FONT_FAMILY } from './fonts';

export const FONT = PDF_FONT_FAMILY;

/** Phụ lục I, Nghị định 30/2020/NĐ-CP — cỡ chữ VBHC (pt). */
export const ND30_SIZE = {
  quocHieu: 13,
  tieuNgu: 13,
  orgName: 13,
  dateLine: 13,
  docTitle: 14,
  body: 13,
  pageNo: 13,
  note: 13,
  signature: 13,
} as const;

export function mm(n: number): number {
  return n * 2.834645669;
}

export const ND30_PAGE: Pick<TDocumentDefinitions, 'pageSize' | 'pageOrientation' | 'pageMargins'> = {
  pageSize: 'A4',
  pageOrientation: 'landscape',
  pageMargins: [mm(32), mm(22), mm(17), mm(22)],
};

export const ND30_DEFAULT_STYLE = {
  font: FONT,
  fontSize: ND30_SIZE.body,
  lineHeight: 1.15,
  color: '#000000',
} as const;

export function nd30PageHeaderFooter(): Pick<TDocumentDefinitions, 'header' | 'footer'> {
  return {
    header: (currentPage) => {
      if (currentPage <= 1) return null;
      return {
        text: String(currentPage),
        alignment: 'center',
        fontSize: ND30_SIZE.pageNo,
        margin: [0, mm(6), 0, 0],
      };
    },
    footer: () => null,
  };
}

export function nd30HeaderBlock(ctx: AdminDocContext, printedAt?: string): Content {
  const place = ctx.placeName?.trim() || '..............';
  const dateLine = printedAt ?? formatVnDate(new Date());

  const underline = (w = 120): Content => ({
    canvas: [{ type: 'line', x1: 0, y1: 0, x2: w, y2: 0, lineWidth: 0.75 }],
    alignment: 'center',
    margin: [0, 2, 0, 0],
  });

  return {
    columns: [
      {
        width: '*',
        stack: [
          {
            text: ctx.schoolName.toUpperCase(),
            bold: true,
            fontSize: ND30_SIZE.orgName,
            alignment: 'center',
          },
          underline(140),
        ],
      },
      {
        width: '*',
        stack: [
          {
            text: 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',
            bold: true,
            fontSize: ND30_SIZE.quocHieu,
            alignment: 'center',
          },
          {
            text: 'Độc lập - Tự do - Hạnh phúc',
            bold: true,
            fontSize: ND30_SIZE.tieuNgu,
            alignment: 'center',
            margin: [0, 2, 0, 0],
          },
          underline(120),
          {
            text: `${place}, ${dateLine}`,
            italics: true,
            fontSize: ND30_SIZE.dateLine,
            alignment: 'center',
            margin: [0, 6, 0, 0],
          },
        ],
      },
    ],
    columnGap: 12,
    margin: [0, 0, 0, 10],
  };
}

export function nd30TitleBlock(line1: string, line2?: string): Content {
  const stack: Content[] = [
    {
      text: line1.toUpperCase(),
      bold: true,
      fontSize: ND30_SIZE.docTitle,
      alignment: 'center',
    },
  ];
  if (line2) {
    stack.push({
      text: line2.toUpperCase(),
      bold: true,
      fontSize: ND30_SIZE.docTitle,
      alignment: 'center',
      margin: [0, 2, 0, 8],
    });
  } else {
    stack[0] = { ...(stack[0] as object), margin: [0, 0, 0, 8] } as Content;
  }
  return { stack };
}

export function nd30TableLayout() {
  return {
    hLineWidth: () => 0.75,
    vLineWidth: () => 0.75,
    hLineColor: () => '#000000',
    vLineColor: () => '#000000',
    paddingLeft: () => 4,
    paddingRight: () => 4,
    paddingTop: () => 3,
    paddingBottom: () => 3,
  };
}

export function nd30Note(text: string): Content {
  return {
    text,
    fontSize: ND30_SIZE.note,
    alignment: 'justify',
    margin: [0, 8, 0, 0],
  };
}
