import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';

// Load .env.local first (Next injects env in the app; standalone tsx scripts need this).
config({ path: '.env.local' });
config();

import postgres from 'postgres';
import * as schema from './schema';

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
export const db = drizzle(client, { schema });
