import { exec } from 'child_process';
import * as dotenv from 'dotenv';
import * as util from 'util';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const execPromise = util.promisify(exec);

/**
 * Setup the database with Prisma migrations
 */
async function setupDatabase() {
  try {
    console.log('Setting up database...');
    
    // Check if DATABASE_URL is defined
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not defined');
    }

    // Run migrations
    console.log('Running migrations...');
    await execPromise('npx prisma migrate deploy');
    console.log('Migrations completed successfully');

    // Generate Prisma client (if needed)
    console.log('Generating Prisma client...');
    await execPromise('npx prisma generate');
    console.log('Prisma client generated successfully');

    console.log('Database setup completed successfully');
  } catch (error) {
    console.error('Database setup failed:', error);
    process.exit(1);
  }
}

// Run the setup if this script is executed directly
if (require.main === module) {
  setupDatabase();
}

export default setupDatabase; 