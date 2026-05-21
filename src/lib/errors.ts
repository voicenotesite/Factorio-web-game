export type AppErrorCode =
  | 'STORAGE_FULL'
  | 'SAVE_CORRUPTED'
  | 'AUTH_EXPIRED'
  | 'AUTH_INVALID'
  | 'NETWORK_ERROR'
  | 'RATE_LIMITED'
  | 'CONFIG_MISSING'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNKNOWN'

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly cause?: unknown

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message)
    this.code = code
    this.cause = cause
    this.name = 'AppError'
  }

  static storage(message = 'Storage operation failed'): AppError {
    return new AppError('STORAGE_FULL', message)
  }

  static auth(message = 'Authentication required'): AppError {
    return new AppError('AUTH_EXPIRED', message)
  }

  static network(message = 'Network request failed', cause?: unknown): AppError {
    return new AppError('NETWORK_ERROR', message, cause)
  }

  static validation(message: string): AppError {
    return new AppError('VALIDATION_ERROR', message)
  }

  static rateLimited(retryAfter = 2): AppError {
    return new AppError('RATE_LIMITED', `Rate limited. Retry after ${retryAfter}s`)
  }

  static config(key: string): AppError {
    return new AppError('CONFIG_MISSING', `Missing configuration: ${key}`)
  }
}
