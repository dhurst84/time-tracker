import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

const JWT_SECRET = process.env.JWT_SECRET || 'harvest-tracker-secret-key-2024'

export interface AuthRequest extends Request {
  userId?: string
  userRole?: string
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token provided' })

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; role: string }
    req.userId = decoded.userId
    req.userRole = decoded.role
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' })
  }
  next()
}

export const JWT_SECRET_KEY = JWT_SECRET
