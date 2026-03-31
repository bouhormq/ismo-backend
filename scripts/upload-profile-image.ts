import { S3 } from 'aws-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const s3 = new S3({
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  region: process.env.S3_REGION || 'eu-west-3',
});

const BUCKET = process.env.S3_BUCKET || 'ismo-media';
const BASE_URL = process.env.S3_BASE_URL || 'https://ismo-media.s3.eu-west-3.amazonaws.com';

async function uploadProfileImage() {
  const imagePath = path.join(__dirname, '../src/assets/profiles/najib-zekri.jpeg');

  if (!fs.existsSync(imagePath)) {
    console.error('❌ Profile image not found at', imagePath);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(imagePath);
  const s3Key = 'profiles/najib-zekri.jpeg';

  // Upload to S3
  await s3
    .putObject({
      Bucket: BUCKET,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    })
    .promise();

  console.log(`✅ Uploaded profile image to S3: ${s3Key}`);

  // Update user in database
  const profileImageUrl = `${BASE_URL}/${s3Key}`;
  const updated = await prisma.user.updateMany({
    where: { username: 'najib' },
    data: { profileImageUrl },
  });

  if (updated.count > 0) {
    console.log(`✅ Updated Najib's profileImageUrl: ${profileImageUrl}`);
  } else {
    console.log('⚠️  User "najib" not found in database');
  }
}

uploadProfileImage()
  .catch((e) => console.error('❌ Error:', e))
  .finally(() => prisma.$disconnect());
