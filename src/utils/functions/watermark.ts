import * as _sharp from 'sharp';
const sharp = (_sharp as any).default || _sharp;

/**
 * Applies a tiled "ISOMAT" watermark at 45° across the image.
 * The text is repeated in rows and columns with semi-transparency.
 */
export async function applyWatermark(imageBuffer: Buffer): Promise<Buffer> {
  // Normalize EXIF orientation first so width/height reflect the visual dimensions
  const normalizedBuffer = await sharp(imageBuffer).rotate().toBuffer();
  const image = sharp(normalizedBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 600;

  // Watermark text settings
  const text = 'ISMO';
  const fontSize = Math.max(24, Math.round(Math.min(width, height) / 12));
  const spacingX = fontSize * 5;
  const spacingY = fontSize * 3;

  // Build SVG with repeated rotated text
  // We need to cover the entire image even after rotation, so extend the grid
  const diagonal = Math.sqrt(width * width + height * height);
  const offsetX = (diagonal - width) / 2;
  const offsetY = (diagonal - height) / 2;

  let textElements = '';
  for (let y = -offsetY; y < height + offsetY; y += spacingY) {
    for (let x = -offsetX; x < width + offsetX; x += spacingX) {
      textElements += `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="Arial, sans-serif" font-weight="bold" fill="white" fill-opacity="0.3" transform="rotate(-45, ${x}, ${y})">${text}</text>`;
    }
  }

  const svgOverlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  ${textElements}
</svg>`;

  return image
    .composite([{ input: Buffer.from(svgOverlay), top: 0, left: 0 }])
    .jpeg()
    .toBuffer();
}
