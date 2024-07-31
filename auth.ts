import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import type { User } from '@/app/lib/definitions';
import bcrypt from 'bcrypt';
 
async function getUser(email: string): Promise<User | undefined> {
  try {
    const result = await sql<User>`SELECT * FROM userz WHERE email = ${email}`;
    const user = result.rows[0];
    
    // Debug: Check if user and password_hash are correctly fetched
    console.log('Fetched User:', user);

    if (!user) {
      console.error('User not found.');
      return undefined;
    }

    return user;
  } catch (error) {
    console.error('Failed to fetch user:', error);
    throw new Error('Failed to fetch user.');
  }
}
 
export const { auth, signIn, signOut } = NextAuth({
    ...authConfig,
    providers: [
      Credentials({
        async authorize(credentials) {
          const parsedCredentials = z
            .object({ email: z.string().email(), password: z.string().min(6) })
            .safeParse(credentials);
  
          if (!parsedCredentials.success) {
            console.error('Invalid credentials format:', parsedCredentials.error);
            return null;
          }
  
          const { email, password } = parsedCredentials.data;
          const user = await getUser(email);
  
          if (!user || !user.password_hash) {
            console.error('Invalid user or missing password hash.');
            return null;
          }
  
          const passwordsMatch = await bcrypt.compare(password, user.password_hash);
  
          if (passwordsMatch) {
            return { id: user.id, name: user.name, email: user.email };
          }
  
          console.log('Invalid credentials');
          return null;
        },
      }),
    ],
  });