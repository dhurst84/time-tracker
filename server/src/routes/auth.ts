import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { authenticate, AuthRequest, JWT_SECRET_KEY } from '../middleware/auth'

export const authRouter = Router()

authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET_KEY, { expiresIn: '7d' })
    const { password: _, ...userWithoutPassword } = user
    res.json({ token, user: userWithoutPassword })
  } catch (err) { next(err) }
})

authRouter.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, role = 'member' } = req.body
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) return res.status(400).json({ error: 'Email already in use' })

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, password: hashed, role },
    })
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET_KEY, { expiresIn: '7d' })
    const { password: _, ...userWithoutPassword } = user
    res.status(201).json({ token, user: userWithoutPassword })
  } catch (err) { next(err) }
})

authRouter.get('/me', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, name: true, email: true, role: true, avatarColor: true, defaultTask: true, createdAt: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })
    res.json(user)
  } catch (err) { next(err) }
})
