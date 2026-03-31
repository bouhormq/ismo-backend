import { PrismaClient, Role } from '@prisma/client';
import * as argon from 'argon2';

const prisma = new PrismaClient();

async function createAdminUser() {
  // 🔒 Get credentials from environment variables
  const username = process.env.ADMIN_USERNAME || 'najib';
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Najib';

  if (!password) {
    console.error('❌ Error: ADMIN_PASSWORD environment variable is required!');
    console.log('\nUsage:');
    console.log('  ADMIN_PASSWORD="your-secure-password" pnpm create-admin');
    console.log('\nOptional environment variables:');
    console.log('  ADMIN_USERNAME (default: "najib")');
    console.log('  ADMIN_NAME (default: "Najib")');
    process.exit(1);
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    console.log(`⚠️  User with username "${username}" already exists.`);
    console.log('User ID:', existingUser.id);
    console.log('Role:', existingUser.role);
    return;
  }

  // Create admin user with hashed password
  const hashedPassword = await argon.hash(password);
  
  const adminUser = await prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      name,
      role: Role.ADMIN,
    },
  });

  console.log('✅ Admin user created successfully!');
  console.log('Username:', username);
  console.log('Name:', name);
  console.log('Role:', adminUser.role);
  console.log('User ID:', adminUser.id);
  console.log('\n🔒 Password is securely hashed in the database');
}

createAdminUser()
  .catch((e) => {
    console.error('Error creating admin user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
