
const isDevelopment = import.meta.env.DEV;

interface LogLevel {
  ERROR: 'error';
  WARN: 'warn';
  INFO: 'info';
  DEBUG: 'debug';
}

const LOG_LEVELS: LogLevel = {
  ERROR: 'error',
  WARN: 'warn', 
  INFO: 'info',
  DEBUG: 'debug'
};

class Logger {
  private shouldLog(level: keyof LogLevel): boolean {
    // En producción, solo mostrar errores y warnings críticos
    if (!isDevelopment) {
      return level === 'ERROR';
    }
    // En desarrollo, mostrar todos los logs
    return true;
  }

  error(message: string, data?: any): void {
    if (this.shouldLog('ERROR')) {
      console.error(`[Sewdle Error] ${message}`, data || '');
    }
  }

  warn(message: string, data?: any): void {
    if (this.shouldLog('WARN')) {
      console.warn(`[Sewdle Warning] ${message}`, data || '');
    }
  }

  info(message: string, data?: any): void {
    if (this.shouldLog('INFO')) {
      console.info(`[Sewdle Info] ${message}`, data || '');
    }
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog('DEBUG')) {
      console.log(`[Sewdle Debug] ${message}`, data || '');
    }
  }
}

export const logger = new Logger();
