import * as winston from 'winston';

/**
 * Logger utility for consistent logging across the application
 * Works in both development and production environments
 */
class Logger {
  private logger: winston.Logger;

  constructor() {
    const { combine, timestamp, printf, colorize } = winston.format;

    // Custom format for console output
    const consoleFormat = printf((info: winston.Logform.TransformableInfo) => {
      const { level, message, timestamp, ...meta } = info;
      const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
      return `${timestamp} [${level}]: ${message} ${metaString}`;
    });

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: combine(
        timestamp(),
        consoleFormat
      ),
      transports: [
        new winston.transports.Console({
          format: combine(
            process.env.NODE_ENV !== 'production' ? colorize() : winston.format.uncolorize(),
            consoleFormat
          ),
          // Force output to stderr for error and warn levels
          stderrLevels: ['error', 'warn']
        })
      ],
      // Ensure logs are properly flushed in Docker environments
      exitOnError: false
    });
  }

  info(message: string, meta: object = {}): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta: object = {}): void {
    this.logger.warn(message, meta);
  }

  error(message: string, errorObj?: any): void {
    if (errorObj instanceof Error) {
      this.logger.error(message, {
        error: {
          errorMessage: errorObj.message,
          stack: errorObj.stack,
          ...errorObj
        }
      });
    } else {
      this.logger.error(message, { error: errorObj });
    }
  }

  debug(message: string, meta: object = {}): void {
    this.logger.debug(message, meta);
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger; 