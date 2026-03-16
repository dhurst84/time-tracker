import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Clear existing data
  await prisma.budgetReset.deleteMany()
  await prisma.timeEntry.deleteMany()
  await prisma.task.deleteMany()
  await prisma.project.deleteMany()
  await prisma.client.deleteMany()
  await prisma.clientGroup.deleteMany()
  await prisma.user.deleteMany()

  // Users
  const hashedPassword = await bcrypt.hash('password123', 10)

  await prisma.user.create({
    data: {
      name: 'Daniel Hurst',
      email: 'daniel@trimarkdigital.com',
      password: hashedPassword,
      role: 'admin',
      avatarColor: '#0d9488',
    },
  })

  // Client Groups
  const wwGroup = await prisma.clientGroup.create({
    data: {
      name: 'WW - BTR',
      color: '#0ea5e9',
      description: 'Jim Roland Group',
    },
  })

  // Clients
  await prisma.client.createMany({
    data: [
      { name: 'Window World of Baton Rouge', color: '#0ea5e9', groupId: wwGroup.id },
      { name: 'Window World of Houston', color: '#0ea5e9', groupId: wwGroup.id },
      { name: 'Window World of Tampa', color: '#0ea5e9', groupId: wwGroup.id },
      { name: 'Window World of DFW', color: '#0ea5e9', groupId: wwGroup.id },
      { name: 'Window World of New Orleans', color: '#0ea5e9', groupId: wwGroup.id },
      { name: 'TransmetriQ', color: '#0d9488' },
    ],
  })

  console.log('✅ Seed complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
