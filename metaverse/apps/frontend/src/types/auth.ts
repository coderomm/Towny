// src/types/auth.ts
import { z } from 'zod';

export const SignupSchema = z.object({
  username: z.string().email(),
  password: z.string(),
  type: z.enum(["user", "admin"]),
});

export const SigninSchema = z.object({
  username: z.string().email(),
  password: z.string(),
});

export interface User {
  username: string,
  role: 'user' | 'admin';
  avatarId?: string,
  imageUrl?: string
}

export interface SignInResponse {
  token: string,
  user: User
}

export type SignupInput = z.infer<typeof SignupSchema>;
export type SigninInput = z.infer<typeof SigninSchema>;
