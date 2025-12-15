import { StorageError } from './storageError';

export enum DatabaseErrorCode {
  CONNECTION_FAILED = 'DATABASE_CONNECTION_FAILED',
  DISCONNECTION_FAILED = 'DATABASE_DISCONNECTION_FAILED',
  CLIENT_ACQUISITION_FAILED = 'CLIENT_ACQUISITION_FAILED',
  QUERY_EXECUTION_FAILED = 'QUERY_EXECUTION_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  CONSTRAINT_VIOLATION = 'CONSTRAINT_VIOLATION',
  DEADLOCK = 'DEADLOCK',
  TIMEOUT = 'DATABASE_TIMEOUT',
  POOL_EXHAUSTED = 'POOL_EXHAUSTED',
}

export class DatabaseError extends StorageError {
  public readonly query: string | undefined;
  public readonly params: any[] | undefined;
  public readonly sqlState: string | undefined;

  constructor(
    code: DatabaseErrorCode,
    message: string,
    context?: Record<string, any>,
    query?: string,
    params?: any[],
    sqlState?: string
  ) {
    super(code as any, message, context, false);
    this.name = 'DatabaseError';
    this.query = query;
    this.params = params;
    this.sqlState = sqlState;
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      query: this.query,
      params: this.params,
      sqlState: this.sqlState,
    };
  }
}