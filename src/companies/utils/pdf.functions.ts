import { PDFDocument } from 'pdf-lib';

/**
 * Copies only the specified pages from a PDF buffer into a new PDF.
 * This is the reliable way to remove unwanted pages created by PDFKit.
 */
export async function keepOnlyPages(
  pdfBuffer: Buffer,
  pageIndicesToKeep: number[],
): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const newDoc = await PDFDocument.create();

  const sorted = [...pageIndicesToKeep].sort((a, b) => a - b);
  const totalPages = srcDoc.getPageCount();

  // Filter out any indices that are out of range
  const valid = sorted.filter((i) => i >= 0 && i < totalPages);

  const copiedPages = await newDoc.copyPages(srcDoc, valid);
  for (const page of copiedPages) {
    newDoc.addPage(page);
  }

  const resultBytes = await newDoc.save();
  return Buffer.from(resultBytes);
}

/**
 * Adds page number pagination (e.g. "1/4") to all content pages.
 */
export function addPagination(
  doc: PDFKit.PDFDocument,
  pagesWithContent: Set<number>,
) {
  const totalPages = pagesWithContent.size;
  let pageNum = 0;
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    if (pagesWithContent.has(i)) {
      pageNum++;
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc
        .font('Regular')
        .fontSize(8)
        .fillColor('#999')
        .text(
          `${pageNum}/${totalPages}`,
          doc.page.width - 70,
          doc.page.height - 20,
          { width: 40, align: 'right', lineBreak: false },
        );
    }
  }
}

export function drawRoundedRect(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
) {
  doc
    .moveTo(x + radius, y)
    .lineTo(x + width - radius, y) // Top edge
    .quadraticCurveTo(x + width, y, x + width, y + radius) // Top-right corner
    .lineTo(x + width, y + height - radius) // Right edge
    .quadraticCurveTo(x + width, y + height, x + width - radius, y + height) // Bottom-right corner
    .lineTo(x + radius, y + height) // Bottom edge
    .quadraticCurveTo(x, y + height, x, y + height - radius) // Bottom-left corner
    .lineTo(x, y + radius) // Left edge
    .quadraticCurveTo(x, y, x + radius, y) // Top-left corner
    .fill(color)
    .stroke();
}

export function calculateTextHeight(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
) {
  const lineHeight = doc.heightOfString('Test', { width });
  const textHeight = doc.heightOfString(text, { width });
  return Math.ceil(textHeight / lineHeight) * lineHeight + 10; // Add padding
}
