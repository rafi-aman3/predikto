import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load .env.local (Next.js convention) first, then .env as fallback.
config({ path: '.env.local' });
config();

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
