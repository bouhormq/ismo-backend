/**
 * One-time migration script: Apply watermarks to all existing article images
 * and update corresponding WordPress/WooCommerce products.
 *
 * Usage:
 *   npx ts-node scripts/watermark-existing-images.ts
 *
 * Required env vars: DATABASE_URL, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY,
 *   S3_REGION, S3_BUCKET, S3_BASE_URL, WP_API_URL, WP_API_USERNAME, WP_API_PASSWORD
 */

import { PrismaClient } from '@prisma/client';
import { S3 } from 'aws-sdk';
import axios from 'axios';
import { applyWatermark } from '../src/utils/functions/watermark';

const prisma = new PrismaClient();

const s3 = new S3({
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  region: process.env.S3_REGION || 'eu-west-3',
});

const S3_BUCKET = process.env.S3_BUCKET || 'ismo-media';
const S3_BASE_URL =
  process.env.S3_BASE_URL || 'https://ismo-media.s3.eu-west-3.amazonaws.com';

const WP_BASE_URL = (() => {
  const url = process.env.WP_API_URL || '';
  const match = url.match(/(https?:\/\/[^\/]+)/);
  return match ? match[1] : '';
})();

const WP_AUTH = `Basic ${Buffer.from(
  `${process.env.WP_API_USERNAME}:${process.env.WP_API_PASSWORD}`,
).toString('base64')}`;

// ---------------------------------------------------------------------------
// S3 helpers
// ---------------------------------------------------------------------------

async function s3KeyExists(key: string): Promise<boolean> {
  try {
    await s3.headObject({ Bucket: S3_BUCKET, Key: key }).promise();
    return true;
  } catch {
    return false;
  }
}

async function downloadFromS3(key: string): Promise<Buffer> {
  const res = await s3.getObject({ Bucket: S3_BUCKET, Key: key }).promise();
  return res.Body as Buffer;
}

async function uploadToS3(key: string, buffer: Buffer): Promise<void> {
  await s3
    .putObject({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: 'image/jpeg',
    })
    .promise();
}

// ---------------------------------------------------------------------------
// WordPress helper
// ---------------------------------------------------------------------------

async function updateWpProductImages(
  sku: string,
  imageUrls: { src: string }[],
): Promise<void> {
  if (!WP_BASE_URL) {
    console.log('  WP_BASE_URL not set, skipping WordPress update');
    return;
  }

  const wcApi = `${WP_BASE_URL}/wp-json/wc/v3/products`;

  try {
    const { data: products } = await axios.get(wcApi, {
      headers: { Authorization: WP_AUTH },
      params: { sku },
    });

    if (products?.length > 0) {
      await axios.put(
        `${wcApi}/${products[0].id}`,
        { images: imageUrls },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: WP_AUTH,
          },
        },
      );
      console.log(`  Updated WP product ${sku} with watermarked images`);
    } else {
      console.log(`  No WP product found for SKU ${sku}, skipping`);
    }
  } catch (err: any) {
    console.error(`  Failed to update WP product ${sku}:`, err.message);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Watermark Migration Script ===\n');

  const articles = await prisma.article.findMany({
    where: {
      photos: { some: {} },
    },
    include: {
      photos: { select: { id: true, url: true } },
    },
  });

  console.log(`Found ${articles.length} articles with photos to process\n`);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const article of articles) {
    const sku = article.reference || `PROD-${article.id}`;
    console.log(
      `Processing article ${article.id} (${sku}) - ${article.photos.length} photo(s)`,
    );

    const watermarkedUrls: { src: string }[] = [];

    for (const photo of article.photos) {
      const originalKey = `documents/${photo.url}`;
      const filename =
        photo.url.split('/').pop() || `article-${article.id}.jpg`;
      const watermarkedKey = `watermarked/${filename}`;

      try {
        // Skip if already watermarked
        if (await s3KeyExists(watermarkedKey)) {
          console.log(`  Skipping ${filename} - already watermarked`);
          watermarkedUrls.push({ src: `${S3_BASE_URL}/${watermarkedKey}` });
          skipped++;
          continue;
        }

        // Download original
        const original = await downloadFromS3(originalKey);

        // Apply watermark
        const watermarked = await applyWatermark(original);

        // Upload watermarked version
        await uploadToS3(watermarkedKey, watermarked);

        watermarkedUrls.push({ src: `${S3_BASE_URL}/${watermarkedKey}` });
        console.log(`  Watermarked ${filename}`);
        processed++;
      } catch (err: any) {
        console.error(`  Failed to watermark ${filename}:`, err.message);
        // Fallback: keep original image URL
        watermarkedUrls.push({ src: `${S3_BASE_URL}/${originalKey}` });
        failed++;
      }
    }

    // Update WordPress product with watermarked images
    if (watermarkedUrls.length > 0) {
      await updateWpProductImages(sku, watermarkedUrls);
    }

    // Small delay to avoid S3/WP rate limiting
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(
    `\n=== Done! Processed: ${processed}, Skipped: ${skipped}, Failed: ${failed} ===`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
