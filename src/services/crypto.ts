import * as crypto from 'crypto';

/**
 * A simplified encryption service for API keys
 * Uses Node.js crypto module for encryption and decryption
 */
export class CryptoService {
  /**
   * Encrypts a string using Node.js crypto
   */
  public static encrypt(text: string): string {
    try {
      // Generate a random initialization vector
      const iv = crypto.randomBytes(16);
      
      // Use createHash to get a 32-byte key from the secret
      const key = crypto.createHash('sha256')
        .update(process.env.JWT_SECRET || 'defaultKey')
        .digest();
      
      // Create cipher using aes-256-cbc algorithm
      // @ts-ignore - Ignore TypeScript errors with crypto API
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      // Encrypt the data
      let encrypted = '';
      encrypted += cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Return IV and encrypted text concatenated with a colon
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypts an encrypted string
   */
  public static decrypt(encryptedText: string): string {
    try {
      // Split the IV and encrypted data
      const [ivHex, encrypted] = encryptedText.split(':');
      
      if (!ivHex || !encrypted) {
        throw new Error('Invalid encrypted format');
      }
      
      // Convert hex IV back to Buffer
      const iv = Buffer.from(ivHex, 'hex');
      
      // Use the same key derivation as in encrypt
      const key = crypto.createHash('sha256')
        .update(process.env.JWT_SECRET || 'defaultKey')
        .digest();
      
      // Create decipher
      // @ts-ignore - Ignore TypeScript errors with crypto API
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      // Decrypt the data
      let decrypted = '';
      decrypted += decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }
} 