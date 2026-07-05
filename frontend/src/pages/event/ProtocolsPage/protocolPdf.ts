// PDF export for a protocol Document, built with pdfmake straight from the same
// backend Document the on-screen preview renders — no browser print dialog.
//
// pdfmake wiring (v0.3.x): the default Roboto vfs ships Cyrillic glyphs, so Russian
// names render out of the box. `vfs_fonts` is registered via addVirtualFileSystem
// (the documented 0.3.x API — the older `pdfMake.vfs = ...` field is not in the types).
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { ProtocolDocument } from '../../../api/types.ts';
import i18n from '../../../i18n';
import { columnLabel, cellText, columnAlign, columnFlex, type FormatContext } from './format.ts';

pdfMake.addVirtualFileSystem(pdfFonts);

export interface PdfHeader {
  title: string;      // "Results protocol" / "Start protocol"
  eventName: string;
  eventDate: string;
}

/** Build a pdfmake docDefinition from the Document and trigger a download. */
export function downloadProtocolPdf(
  doc: ProtocolDocument,
  header: PdfHeader,
  ctx: FormatContext,
  fileName: string,
): void {
  const columns = doc.columns;
  const widths = columns.map((k) => (columnFlex(k) ? '*' : 'auto'));

  const content: Content[] = [];
  content.push({ text: header.title, style: 'docTitle' });
  const sub = [header.eventName, header.eventDate].filter(Boolean).join('   •   ');
  if (sub) content.push({ text: sub, style: 'docSub' });

  doc.sections.forEach((section, idx) => {
    content.push({
      text: section.title,
      style: 'sectionTitle',
      pageBreak: doc.options.pageBreakPerSection && idx > 0 ? 'before' : undefined,
    });
    if (section.subtitle) content.push({ text: section.subtitle, style: 'sectionSub' });

    const headerRow: TableCell[] = columns.map((k) => ({
      text: columnLabel(k, i18n.t),
      style: 'th',
      alignment: columnAlign(k),
    }));
    const bodyRows: TableCell[][] = section.rows.map((row) =>
      columns.map((k) => ({
        text: cellText(row, k, ctx),
        alignment: columnAlign(k),
        // Non-finishers (DSQ/DNF/DNS/NC) in a results table render greyed out.
        color: doc.type === 'results' && !row.isFinisher ? '#888888' : undefined,
      })),
    );

    content.push({
      table: { headerRows: 1, widths, body: [headerRow, ...bodyRows] },
      layout: 'lightHorizontalLines',
      margin: [0, 0, 0, 6],
    });
  });

  const dd: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [28, 32, 28, 36],
    defaultStyle: { font: 'Roboto', fontSize: 8 },
    footer: (current, total) => ({
      text: `${current} / ${total}`,
      alignment: 'center',
      fontSize: 7,
      color: '#999999',
      margin: [0, 8, 0, 0],
    }),
    styles: {
      docTitle: { fontSize: 15, bold: true, margin: [0, 0, 0, 2] },
      docSub: { fontSize: 9, color: '#555555', margin: [0, 0, 0, 10] },
      sectionTitle: { fontSize: 11, bold: true, margin: [0, 10, 0, 4] },
      sectionSub: { fontSize: 8, color: '#555555', margin: [0, 0, 0, 4] },
      th: { bold: true, fillColor: '#f0f0f0' },
    },
    content,
  };

  pdfMake.createPdf(dd).download(fileName);
}
