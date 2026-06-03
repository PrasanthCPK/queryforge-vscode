import mysql from 'mysql2/promise';
import { randomUUID } from 'crypto';
import type { Connection } from '../types';
import type { QueryResult, ExplainNode } from '../types';
import type { IAdapter } from './IAdapter';

export class MySQLAdapter implements IAdapter {
  private pool: mysql.Pool | null = null;
  private connected = false;

  constructor(private readonly config: Connection) {}

  async connect(password: string): Promise<void> {
    this.pool = mysql.createPool({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.username,
      password,
      connectionLimit: 5,
      waitForConnections: true,
    });
    const conn = await this.pool.getConnection();
    conn.release();
    this.connected = true;
  }

  async query(sql: string): Promise<QueryResult> {
    if (!this.pool) throw new Error('Not connected');
    const start = Date.now();
    const [rows, fields] = await this.pool.query(sql);
    const executionTimeMs = Date.now() - start;

    if (Array.isArray(rows)) {
      const resultRows = rows as Record<string, unknown>[];
      const fieldPackets = fields as mysql.FieldPacket[] | undefined;
      const columns = fieldPackets?.map(f => f.name) ?? Object.keys(resultRows[0] ?? {});
      return { columns, rows: resultRows, rowCount: resultRows.length, executionTimeMs };
    }

    // DML: ResultSetHeader
    const header = rows as mysql.ResultSetHeader;
    return {
      columns: ['affectedRows', 'insertId'],
      rows: [{ affectedRows: header.affectedRows, insertId: header.insertId }],
      rowCount: 1,
      executionTimeMs,
    };
  }

  async queryPage(sql: string, page: number, pageSize: number): Promise<QueryResult> {
    if (!/^\s*SELECT\s/i.test(sql)) {
      return this.query(sql);
    }
    if (!this.pool) throw new Error('Not connected');
    const offset = page * pageSize;
    const start = Date.now();
    const [countRows] = await this.pool.query(
      `SELECT COUNT(*) AS __total FROM (${sql}) AS __qf_count`,
    );
    const totalRows = Number((countRows as Record<string, unknown>[])[0]['__total'] ?? 0);
    const [rows, fields] = await this.pool.query(
      `SELECT * FROM (${sql}) AS __qf_data LIMIT ${pageSize} OFFSET ${offset}`,
    );
    const executionTimeMs = Date.now() - start;
    const resultRows = rows as Record<string, unknown>[];
    const fieldPackets = fields as mysql.FieldPacket[] | undefined;
    const columns = fieldPackets?.map(f => f.name) ?? Object.keys(resultRows[0] ?? {});
    return { columns, rows: resultRows, rowCount: resultRows.length, totalRows, executionTimeMs };
  }

  async explain(sql: string): Promise<ExplainNode> {
    if (!this.pool) throw new Error('Not connected');
    const [rows] = await this.pool.query(`EXPLAIN FORMAT=JSON ${sql}`);
    const resultRows = rows as Record<string, unknown>[];
    const firstValue = Object.values(resultRows[0])[0] as string;
    const parsed = JSON.parse(firstValue) as { query_block: Record<string, unknown> };
    return this.parseQueryBlock(parsed.query_block);
  }

  private parseQueryBlock(block: Record<string, unknown>): ExplainNode {
    const children: ExplainNode[] = [];
    const details: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(block)) {
      if (key === 'nested_loop' && Array.isArray(value)) {
        for (const item of value as Record<string, unknown>[]) {
          if (item['table']) children.push(this.parseTable(item['table'] as Record<string, unknown>));
        }
      } else if (key === 'table') {
        children.push(this.parseTable(value as Record<string, unknown>));
      } else if (['ordering_operation', 'grouping_operation', 'duplicates_removal'].includes(key)) {
        children.push(this.parseQueryBlock(value as Record<string, unknown>));
      } else if (key !== 'cost_info') {
        details[key] = value;
      }
    }

    return { id: randomUUID(), operation: 'Query Block', details, children };
  }

  private parseTable(table: Record<string, unknown>): ExplainNode {
    const { table_name, access_type, key, rows_examined_per_scan, cost_info, ...rest } = table;
    return {
      id: randomUUID(),
      operation: `${String(access_type ?? 'UNKNOWN')}: ${String(table_name ?? 'unknown')}`,
      details: {
        table: table_name,
        access_type,
        key: key ?? null,
        rows: rows_examined_per_scan,
        cost: (cost_info as Record<string, unknown> | undefined)?.query_cost ?? null,
        ...rest,
      },
      children: [],
    };
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
