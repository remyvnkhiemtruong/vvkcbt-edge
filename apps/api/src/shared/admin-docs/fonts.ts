import pdfMake from 'pdfmake/build/pdfmake';
import { vfsTimes } from './vfs_times';

let ready = false;

export const PDF_FONT_FAMILY = 'TimesNewRoman';

const TIMES_FONT_CONTAINER = {
  vfs: vfsTimes,
  fonts: {
    TimesNewRoman: {
      normal: 'TimesNewRoman-Regular.ttf',
      bold: 'TimesNewRoman-Bold.ttf',
      italics: 'TimesNewRoman-Italic.ttf',
      bolditalics: 'TimesNewRoman-BoldItalic.ttf',
    },
  },
};

export function ensurePdfFonts(): typeof pdfMake {
  if (!ready) {
    pdfMake.addFontContainer(TIMES_FONT_CONTAINER);
    ready = true;
  }
  return pdfMake;
}
