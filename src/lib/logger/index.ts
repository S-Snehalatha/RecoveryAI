import { env } from '@/lib/config/env';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[env.LOG_LEVEL];
  }

  private format(level: LogLevel, message: string, context?: Record<string, unknown>) {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...(context && { context }),
      mode: env.EXECUTION_MODE,
    });
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (this.shouldLog('debug')) console.debug(this.format('debug', message, context));
  }

  info(message: string, context?: Record<string, unknown>) {
    if (this.shouldLog('info')) console.info(this.format('info', message, context));
  }

  warn(message: string, context?: Record<string, unknown>) {
    if (this.shouldLog('warn')) console.warn(this.format('warn', message, context));
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    if (this.shouldLog('error')) {
      console.error(
        this.format('error', message, {
          ...context,
          error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
        })
      );
    }
  }
}

export const logger = new Logger();
