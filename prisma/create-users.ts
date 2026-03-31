import { PrismaClient, Role } from '@prisma/client';
import * as argon from 'argon2';

const prisma = new PrismaClient();

async function createUsers() {
  const users = [
    {
      username: process.env.USER1_USERNAME || 'najib',
      password: process.env.USER1_PASSWORD,
      name: process.env.USER1_NAME || 'Najib',
      role: (process.env.USER1_ROLE as Role) || Role.ADMIN,
      signatureImageUrl: process.env.USER1_SIGNATURE_IMAGE_URL || null,
      profileImageUrl: process.env.USER1_PROFILE_IMAGE_URL || null,
    },
    {
      username: process.env.USER2_USERNAME || 'dina',
      password: process.env.USER2_PASSWORD,
      name: process.env.USER2_NAME || 'Dina',
      role: (process.env.USER2_ROLE as Role) || Role.ADMIN,
      signatureImageUrl: process.env.USER2_SIGNATURE_IMAGE_URL || null,
      profileImageUrl: process.env.USER2_PROFILE_IMAGE_URL || null,
    },
  ];

  // Only create users if passwords are provided
  const usersToCreate = users.filter((user) => user.password);

  if (usersToCreate.length === 0) {
    console.log('⏭️  No user passwords provided, skipping user creation');
    return;
  }

  for (const userData of usersToCreate) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { username: userData.username },
      });

      if (existingUser) {
        console.log(`⏭️  User "${userData.username}" already exists, skipping`);
        continue;
      }

      // Create user with hashed password
      const hashedPassword = await argon.hash(userData.password!);

      const newUser = await prisma.user.create({
        data: {
          username: userData.username,
          password: hashedPassword,
          name: userData.name,
          role: userData.role,
          signatureImageUrl: userData.signatureImageUrl,
          profileImageUrl: userData.profileImageUrl,
        },
      });

      console.log(`✅ User "${userData.username}" created with role: ${newUser.role}`);
    } catch (error) {
      console.error(`❌ Error creating user "${userData.username}":`, error);
    }
  }
}

createUsers()
  .catch((e) => {
    console.error('Error in user creation script:', e);
    // Don't exit with error code to prevent build failure
    // process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
