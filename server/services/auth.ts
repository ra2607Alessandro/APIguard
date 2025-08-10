import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../db';
import { users, type InsertUser, type User } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET!;
const TOKEN_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY!;
if (!JWT_SECRET || !TOKEN_ENCRYPTION_KEY) {
  throw new Error('Missing JWT_SECRET or TOKEN_ENCRYPTION_KEY');
}
export async function signup(data: { email: string; password: string }) {
  const hashed = await bcrypt.hash(data.password, 10);
  const [user] = await db.insert(users).values({ username: data.email, password: hashed }).returning();
  return generateToken(user);
}

export async function login(data: { email: string; password: string }) {
  const [user] = await db.select().from(users).where(eq(users.username, data.email));
  if (!user || !await bcrypt.compare(data.password, user.password)) {
    throw new Error('Invalid credentials');
  }
  return generateToken(user);
}

function generateToken(user: User) {
  return jwt.sign(
    { 
      userId: user.id, 
      username: user.username,
      iat: Math.floor(Date.now() / 1000)
    }, 
    JWT_SECRET, 
    { expiresIn: '7d' }
  );
}

export function authMiddleware(req: any, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log('Auth middleware: No token provided');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; username: string; iat: number };
    req.user = {
      id: decoded.userId,
      userId: decoded.userId,
      username: decoded.username
    };
    console.log('Auth middleware: Token valid for user:', decoded.userId);
    next();
  } catch (error) { 
    console.log('Auth middleware: Invalid token:', error);
    res.status(401).json({ error: 'Invalid token' }); 
  }
}

export function encryptToken(token: string): string {
  const cipher = crypto.createCipher('aes-256-cbc', TOKEN_ENCRYPTION_KEY);
  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

export function decryptToken(encryptedToken: string): string {
  const decipher = crypto.createDecipher('aes-256-cbc', TOKEN_ENCRYPTION_KEY);
  let decrypted = decipher.update(encryptedToken, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
