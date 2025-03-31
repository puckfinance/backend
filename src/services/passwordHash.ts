import crypto from 'crypto';

/**
 * Password hashing service using Node.js's built-in crypto module.
 * Uses PBKDF2 with SHA-512 for secure password hashing.
 */
export class PasswordHashService {
  // Number of iterations for PBKDF2
  private static readonly ITERATIONS = 310000;
  // Length of the derived key in bytes
  private static readonly KEY_LENGTH = 64;
  // Digest algorithm
  private static readonly DIGEST = 'sha512';
  // Salt length in bytes
  private static readonly SALT_SIZE = 32;

  /**
   * Hashes a password using PBKDF2
   * @param password The plain text password to hash
   * @returns A string in the format 'iterations:salt:hash'
   */
  public static async hash(password: string): Promise<string> {
    // Generate a random salt
    const salt = crypto.randomBytes(this.SALT_SIZE).toString('hex');
    
    // Hash the password using PBKDF2
    const hash = await this.pbkdf2(password, salt, this.ITERATIONS);
    
    // Return the hash string in the format 'iterations:salt:hash'
    return `${this.ITERATIONS}:${salt}:${hash}`;
  }

  /**
   * Verifies a password against a hash
   * @param password The plain text password to verify
   * @param hashedPassword The hashed password to verify against
   * @returns True if the password matches, false otherwise
   */
  public static async verify(password: string, hashedPassword: string): Promise<boolean> {
    try {
      // Split the hash string into its components
      const [iterations, salt, storedHash] = hashedPassword.split(':');
      
      // Convert iterations to a number
      const iterCount = parseInt(iterations, 10);
      
      // Hash the provided password with the same parameters
      const hash = await this.pbkdf2(password, salt, iterCount);
      
      // Compare the generated hash with the stored hash
      return storedHash === hash;
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }

  /**
   * Helper method to generate a hash using PBKDF2
   */
  private static pbkdf2(password: string, salt: string, iterations: number): Promise<string> {
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(
        password, 
        salt, 
        iterations, 
        this.KEY_LENGTH, 
        this.DIGEST, 
        (err, derivedKey) => {
          if (err) {
            reject(err);
          } else {
            resolve(derivedKey.toString('hex'));
          }
        }
      );
    });
  }
} 