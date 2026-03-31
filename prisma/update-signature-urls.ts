import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BASE = 'https://ismo-media.s3.eu-west-3.amazonaws.com';

const userData = [
  {
    username: 'najib',
    signatureImageUrl: `${BASE}/signatures/Najib%20Signature.png`,
    profileImageUrl: `${BASE}/profiles/najib.jpeg`,
  },
  {
    username: 'dina',
    signatureImageUrl: `${BASE}/signatures/Dina%20Signature.png`,
    profileImageUrl: null,
  },
];

async function run() {
  for (const { username, signatureImageUrl, profileImageUrl } of userData) {
    const data: Record<string, string | null> = { signatureImageUrl };
    if (profileImageUrl) {
      data.profileImageUrl = profileImageUrl;
    }
    const updated = await prisma.user.updateMany({
      where: { username },
      data,
    });
    if (updated.count > 0) {
      console.log(`✅ Updated URLs for "${username}"`);
    } else {
      console.log(`⚠️  User "${username}" not found`);
    }
  }
}

run()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
