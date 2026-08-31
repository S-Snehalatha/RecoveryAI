export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'POLICY_VIOLATION'
  | 'UNAUTHORIZED_EXECUTION'
  | 'ADAPTER_ERROR'
  | 'TRANSACTION_NOT_FOUND'
  | 'HUMAN_REVIEW_REQUIRED'
  | 'INTERNAL_ERROR';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, code: ErrorCode, statusCode = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
