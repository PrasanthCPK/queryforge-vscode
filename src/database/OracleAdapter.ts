import oracledb from 'oracledb';
import { randomUUID } from 'crypto';
import type { Connection } from '../types';
import type { QueryResult, ExplainNode } from '../types';
import type { IAdapter } from './IAdapter';

interface PlanRow {
  ID: number;
  PARENT_ID: number | null;
  OPERATION: string;
  OPTIONS: string | null;
  OBJECT_NAME: string | null;
  CARDINALITY: number | null;
  COST: number | null;
}

export class OracleAdapter implements IAdapter {
  private connection: oracledb.Connection | null = null;
  private connected = false;

  constructor(private readonly config: Connection) {}

  async connect(password: string): Promise<void> {
    oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
    this.connection = await oracledb.getConnection({
      user: this.config.username,
      password,
      connectString: `${this.config.host}:${this.config.port}/${this.config.database}`,
    });
    this.connected = true;
  }

  async query(sql: string): Promise<QueryResult> {
    if (!this.connection) throw new Error('Not connected');
    const start = Date.now();
    const result = await this.connection.execute(sql, [], {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    const executionTimeMs = Date.now() - start;

    if (result.rows) {
      const rows = result.rows as Record<string, unknown>[];
      const columns = result.metaData?.map((m: { name: string }) => m.name) ?? Object.keys(rows[0] ?? {});
      return { columns, rows, rowCount: rows.length, executionTimeMs };
    }

    return {
      columns: ['rowsAffected'],
      rows: [{ rowsAffected: result.rowsAffected ?? 0 }],
      rowCount: 1,
      executionTimeMs,
    };
  }

  async explain(sql: string): Promise<ExplainNode> {
    if (!this.connection) throw new Error('Not connected');
    const stmtId = `QF_${Date.now()}`;

    await this.connection.execute(
      `EXPLAIN PLAN SET STATEMENT_ID = '${stmtId}' FOR ${sql}`,
    );

    const result = await this.connection.execute<PlanRow>(
      `SELECT ID, PARENT_ID, OPERATION, OPTIONS, OBJECT_NAME, CARDINALITY, COST
       FROM PLAN_TABLE
       WHERE STATEMENT_ID = :stmtId
       ORDER BY ID`,
      { stmtId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT },
    );

    await this.connection.execute(
      `DELETE FROM PLAN_TABLE WHERE STATEMENT_ID = '${stmtId}'`,
    );

    const planRows = (result.rows ?? []) as PlanRow[];
    return this.buildTree(planRows);
  }

  private buildTree(rows: PlanRow[]): ExplainNode {
    const nodeMap = new Map<number, ExplainNode>();

    for (const row of rows) {
      const opName = row.OPTIONS ? `${row.OPERATION} ${row.OPTIONS}` : row.OPERATION;
      const label = row.OBJECT_NAME ? `${opName}: ${row.OBJECT_NAME}` : opName;
      nodeMap.set(row.ID, {
        id: randomUUID(),
        operation: label,
        details: { rows: row.CARDINALITY, cost: row.COST },
        children: [],
      });
    }

    let root: ExplainNode | undefined;
    for (const row of rows) {
      const node = nodeMap.get(row.ID)!;
      if (row.PARENT_ID === null || row.PARENT_ID === undefined) {
        root = node;
      } else {
        nodeMap.get(row.PARENT_ID)?.children.push(node);
      }
    }

    return root ?? { id: randomUUID(), operation: 'Empty Plan', details: {}, children: [] };
  }

  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
      this.connection = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
