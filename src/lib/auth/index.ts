import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db';
import * as schema from '@/lib/db/schema';

const SESSION_EXPIRY_DAYS = Number(process.env.SESSION_EXPIRY_DAYS ?? 7);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'employee',
        input: false, // role tidak boleh di-set dari form register
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * SESSION_EXPIRY_DAYS,
    updateAge: 60 * 60 * 24, // sliding window: refresh setiap 1 hari aktivitas
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
});

export type Session = typeof auth.$Infer.Session;
export type SessionUser = Session['user'];
