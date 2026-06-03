export type DbType = 'mysql' | 'oracle';

export interface Connection {
  id: string;
  name: string;
  dbType: DbType;
  host: string;
  port: number;
  database: string;
  username: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
}

export interface ExplainNode {
  id: string;
  operation: string;
  details: Record<string, unknown>;
  children: ExplainNode[];
}
