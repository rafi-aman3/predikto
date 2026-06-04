import { sql } from 'drizzle-orm';
import { db } from './index';

/** Truncates all data tables (CASCADE) so the seed can load a clean slate. */
async function main() {
  await db.execute(sql`
    TRUNCATE TABLE
      match_predictions, bracket_predictions, award_predictions,
      matches, players, teams, venues, app_settings
    RESTART IDENTITY CASCADE
  `);
  console.log('Reset: truncated all data tables.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
