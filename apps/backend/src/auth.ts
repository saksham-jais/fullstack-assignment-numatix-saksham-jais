import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { RegisterPayload, LoginPayload, AuthResponse } from '@shared/types';

export const prisma = new PrismaClient();

export const register = async (req: any, res: any) => {
  try {
    const { email, password, binanceApiKey, binanceSecretKey }: RegisterPayload = req.body;
    if (!email || !password || !binanceApiKey || !binanceSecretKey) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 12);
    const encryptedApiKey = Buffer.from(binanceApiKey).toString('base64');
    const encryptedSecretKey = Buffer.from(binanceSecretKey).toString('base64');
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        binanceApiKey: encryptedApiKey,
        binanceSecretKey: encryptedSecretKey,
      },
    });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '24h' });
    const response: AuthResponse = { token, user: { id: user.id, email: user.email } };
    res.status(201).json(response);
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const login = async (req: any, res: any) => {
  try {
    const { email, password }: LoginPayload = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '24h' });
    const response: AuthResponse = { token, user: { id: user.id, email: user.email } };
    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};