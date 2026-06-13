import { PrismaClient } from './generated-client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Admin
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@alex.tech' },
    update: {},
    create: {
      email: 'admin@alex.tech',
      passwordHash: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
    },
  });
  console.log('Admin user created:', admin.email);

  // Create Trainer
  const trainerPassword = await bcrypt.hash('trainer123', 10);
  const trainer = await prisma.user.upsert({
    where: { email: 'trainer@alex.tech' },
    update: {},
    create: {
      email: 'trainer@alex.tech',
      passwordHash: trainerPassword,
      name: 'Expert Trainer',
      role: 'TRAINER',
    },
  });
  console.log('Trainer user created:', trainer.email);

  // Create Student
  const studentPassword = await bcrypt.hash('student123', 10);
  const studentUser = await prisma.user.upsert({
    where: { email: 'john@student.tech' },
    update: {},
    create: {
      email: 'john@student.tech',
      passwordHash: studentPassword,
      name: 'John Doe',
      role: 'STUDENT',
      student: {
        create: {
          registrationNumber: 'REG001',
          batch: '2026',
          department: 'CSE',
        },
      },
    },
  });
  console.log('Student user created:', studentUser.email);

  // Create Coding Question
  const codingQuestion = await prisma.question.create({
    data: {
      type: 'CODING',
      marks: 50,
      difficulty: 'Medium',
      tags: ['Arrays', 'Logic'],
      codingQuestion: {
        create: {
          problemStatement: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
          constraints: '2 <= nums.length <= 10^4',
          sampleInput: '2 7 11 15\n9',
          sampleOutput: '0 1',
          testCases: {
            create: [
              { input: '2 7 11 15\n9', expectedOutput: '0 1', isHidden: false },
              { input: '3 2 4\n6', expectedOutput: '1 2', isHidden: true },
            ],
          },
        },
      },
    },
  });
  console.log('Coding question created:', codingQuestion.id);

  // Create MCQ Question
  const mcqQuestion = await prisma.question.create({
    data: {
      type: 'MCQ',
      text: 'Which of the following is not a primitive data type in Python?',
      marks: 10,
      difficulty: 'Easy',
      tags: ['Python', 'Basics'],
      mcqOptions: {
        create: [
          { optionText: 'Integer', isCorrect: false },
          { optionText: 'String', isCorrect: false },
          { optionText: 'Array', isCorrect: true },
          { optionText: 'Boolean', isCorrect: false },
        ],
      },
    },
  });
  console.log('MCQ question created:', mcqQuestion.id);

  // Create Exam
  const exam = await prisma.exam.create({
    data: {
      title: 'Advanced Programming Assessment',
      description: 'A comprehensive test for software engineering fundamentals.',
      startTime: new Date(Date.now() - 3600000), // 1 hour ago (Available now)
      endTime: new Date(Date.now() + 86400000 * 2), // 2 days from now
      durationMinutes: 120,
      status: 'PUBLISHED',
      createdBy: admin.id,
      questions: {
        create: [
          { question: { connect: { id: codingQuestion.id } }, order: 1 },
          { question: { connect: { id: mcqQuestion.id } }, order: 2 },
        ],
      },
    },
  });
  console.log('Exam created:', exam.title);

  // Assign Exam to Student
  const studentRecord = await prisma.student.findUnique({ where: { userId: studentUser.id } });
  if (studentRecord) {
    await prisma.examAssignment.create({
      data: {
        examId: exam.id,
        studentId: studentRecord.id,
        status: 'PENDING',
      },
    });
    console.log(`Exam assigned to student: ${studentRecord.registrationNumber}`);
  }

  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
