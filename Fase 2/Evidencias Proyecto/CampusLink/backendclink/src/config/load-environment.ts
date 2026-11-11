import dotenv from 'dotenv';
dotenv.config({ quiet: true });
// Local runtime credentials are separate from the operator .env used for backups/migrations/QA cleanup.
if (process.env.NODE_ENV !== 'production') dotenv.config({ path: '.env.runtime.local', override: true, quiet: true });
