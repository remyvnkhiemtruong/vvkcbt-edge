import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import { ensurePdfFonts } from './fonts';

export async function renderPdfBuffer(docDef: TDocumentDefinitions): Promise<Buffer> {
  const pdfMake = ensurePdfFonts();
  const buffer = await pdfMake.createPdf(docDef).getBuffer();
  return Buffer.from(buffer);
}
