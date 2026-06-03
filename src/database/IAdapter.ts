import type { QueryResult, ExplainNode } from '../types';

export interface IAdapter {
  connect(password: string): Promise<void>;
  query(sql: string): Promise<QueryResult>;
  queryPage(sql: string, page: number, pageSize: number): Promise<QueryResult>;
  explain(sql: string): Promise<ExplainNode>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}
