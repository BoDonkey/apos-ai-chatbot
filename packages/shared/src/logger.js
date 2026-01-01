/**
 * @fileoverview Simple logger utility
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * Format timestamp for logs
 * @returns {string}
 */
function timestamp() {
  return new Date().toISOString();
}

/**
 * Logger class
 */
export class Logger {
  /**
   * @param {string} context - Logger context/namespace
   */
  constructor(context) {
    this.context = context;
  }

  /**
   * Log error message
   * @param {string} message - Log message
   * @param {Error|Object} [error] - Error object or additional data
   */
  error(message, error) {
    if (CURRENT_LEVEL >= LOG_LEVELS.ERROR) {
      console.error(`[${timestamp()}] [ERROR] [${this.context}] ${message}`, error || '');
    }
  }

  /**
   * Log warning message
   * @param {string} message - Log message
   * @param {Object} [data] - Additional data
   */
  warn(message, data) {
    if (CURRENT_LEVEL >= LOG_LEVELS.WARN) {
      console.warn(`[${timestamp()}] [WARN] [${this.context}] ${message}`, data || '');
    }
  }

  /**
   * Log info message
   * @param {string} message - Log message
   * @param {Object} [data] - Additional data
   */
  info(message, data) {
    if (CURRENT_LEVEL >= LOG_LEVELS.INFO) {
      console.log(`[${timestamp()}] [INFO] [${this.context}] ${message}`, data || '');
    }
  }

  /**
   * Log debug message
   * @param {string} message - Log message
   * @param {Object} [data] - Additional data
   */
  debug(message, data) {
    if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
      console.log(`[${timestamp()}] [DEBUG] [${this.context}] ${message}`, data || '');
    }
  }
}

/**
 * Create a logger instance
 * @param {string} context - Logger context
 * @returns {Logger}
 */
export function createLogger(context) {
  return new Logger(context);
}
