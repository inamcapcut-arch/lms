import { PrismaClient } from './prisma/generated-client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data...');

  const passwordHash = await bcrypt.hash('admin123', 10);
  const studentPasswordHash = await bcrypt.hash('student123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@alextech.com' },
    update: {},
    create: {
      email: 'admin@alextech.com',
      passwordHash: passwordHash,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: {},
    create: {
      email: 'student@example.com',
      passwordHash: studentPasswordHash,
      name: 'Student Scholar',
      role: 'STUDENT',
      student: {
        create: {
          registrationNumber: 'STU-2026-001',
          batch: 'B.Tech 2026',
          department: 'Computer Science',
        },
      },
    },
  });

  console.log('Admin user:', admin.email);
  console.log('Student user:', studentUser.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
