import fs from 'fs';
import logger from '../utils/Logger';

export interface CSVData {
  headers: string[];
  rows: string[][];
  rowCount: number;
}

export interface CSVValidationResult {
  isValid: boolean;
  errors: string[];
  data?: CSVData;
}

/**
 * CSV Processing Service
 * Handles CSV file parsing, validation, and analysis
 */
export class CSVProcessorService {
  
  /**
   * Parse CSV file and return structured data
   */
  public static async parseCSV(filePath: string): Promise<CSVData> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const lines = fileContent.split('\n').filter(line => line.trim() !== '');
      
      if (lines.length === 0) {
        throw new Error('CSV file is empty');
      }

      // Parse headers (first line)
      const headers = this.parseCSVLine(lines[0]);
      
      // Parse data rows
      const rows: string[][] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = this.parseCSVLine(lines[i]);
        if (row.length > 0) {
          rows.push(row);
        }
      }

      return {
        headers,
        rows,
        rowCount: rows.length
      };

    } catch (error) {
      logger.error('CSV parsing error:', error);
      throw new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Validate CSV file for strategy data
   */
  public static async validateStrategyCSV(filePath: string): Promise<CSVValidationResult> {
    try {
      const csvData = await this.parseCSV(filePath);
      const errors: string[] = [];

      // Basic validation
      if (csvData.headers.length === 0) {
        errors.push('CSV file must have headers');
      }

      if (csvData.rowCount === 0) {
        errors.push('CSV file must contain data rows');
      }

      // Check for minimum required columns (this can be customized based on strategy requirements)
      const requiredColumns = ['date', 'signal', 'price']; // Example required columns
      const missingColumns = requiredColumns.filter(col => 
        !csvData.headers.some(header => header.toLowerCase().includes(col.toLowerCase()))
      );

      if (missingColumns.length > 0) {
        logger.warn(`CSV missing recommended columns: ${missingColumns.join(', ')}`);
        // Note: We're not adding this as an error since strategy formats can vary
      }

      // Check for reasonable data size
      if (csvData.rowCount > 10000) {
        errors.push('CSV file contains too many rows (max 10,000)');
      }

      // Validate data consistency
      for (let i = 0; i < Math.min(csvData.rows.length, 10); i++) {
        const row = csvData.rows[i];
        if (row.length !== csvData.headers.length) {
          errors.push(`Row ${i + 2} has ${row.length} columns but expected ${csvData.headers.length}`);
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        data: errors.length === 0 ? csvData : undefined
      };

         } catch (error) {
       return {
         isValid: false,
         errors: [error instanceof Error ? error.message : 'Unknown validation error']
       };
     }
  }

  /**
   * Get CSV file statistics for display
   */
  public static async getCSVStats(filePath: string): Promise<{
    rowCount: number;
    columnCount: number;
    headers: string[];
    fileSize: number;
    sampleData: string[][];
  }> {
    try {
      const csvData = await this.parseCSV(filePath);
      const stats = fs.statSync(filePath);
      
      return {
        rowCount: csvData.rowCount,
        columnCount: csvData.headers.length,
        headers: csvData.headers,
        fileSize: stats.size,
        sampleData: csvData.rows.slice(0, 5) // First 5 rows as sample
      };

    } catch (error) {
      logger.error('CSV stats error:', error);
      throw error instanceof Error ? error : new Error('Unknown error occurred');
    }
  }

  /**
   * Parse a single CSV line, handling quoted values
   */
  private static parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add the last field
    result.push(current.trim());
    
    return result.map(field => field.replace(/^"|"$/g, '')); // Remove surrounding quotes
  }

  /**
   * Clean up temporary CSV file
   */
  public static async cleanupFile(filePath: string): Promise<void> {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        logger.info(`Cleaned up CSV file: ${filePath}`);
      }
    } catch (error) {
      logger.error(`Failed to cleanup CSV file ${filePath}:`, error);
    }
  }
} 