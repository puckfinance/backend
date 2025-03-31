import { PrismaClient } from '@prisma/client';

// Initialize Prisma Client with logging options
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] 
    : ['error'],
});

// Connection management
export const connectPrisma = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Successfully connected to database');
  } catch (error) {
    console.error('❌ Failed to connect to database:', error);
    process.exit(1);
  }
};

// Disconnection handling
export const disconnectPrisma = async () => {
  try {
    await prisma.$disconnect();
    console.log('✅ Successfully disconnected from database');
  } catch (error) {
    console.error('❌ Failed to disconnect from database:', error);
    process.exit(1);
  }
};

export default prisma;
