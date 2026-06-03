import * as vscode from 'vscode';
import { randomUUID } from 'crypto';
import type { Connection, DbType } from '../types';
import type { IAdapter } from './IAdapter';

const CONNECTIONS_KEY = 'queryforge.connections';

export class ConnectionManager {
  private readonly activeSessions = new Map<string, IAdapter>();

  constructor(private readonly context: vscode.ExtensionContext) {}

  getAll(): Connection[] {
    return this.context.globalState.get<Connection[]>(CONNECTIONS_KEY) ?? [];
  }

  async add(conn: Omit<Connection, 'id'>, password: string): Promise<Connection> {
    const id = randomUUID();
    const newConn: Connection = { ...conn, id };
    const all = this.getAll();
    all.push(newConn);
    await this.context.globalState.update(CONNECTIONS_KEY, all);
    await this.context.secrets.store(`queryforge.password.${id}`, password);
    return newConn;
  }

  async update(conn: Connection, password?: string): Promise<void> {
    const all = this.getAll();
    const idx = all.findIndex(c => c.id === conn.id);
    if (idx === -1) throw new Error('Connection not found');
    all[idx] = conn;
    await this.context.globalState.update(CONNECTIONS_KEY, all);
    if (password !== undefined) {
      await this.context.secrets.store(`queryforge.password.${conn.id}`, password);
    }
  }

  async remove(id: string): Promise<void> {
    await this.disconnect(id);
    const all = this.getAll().filter(c => c.id !== id);
    await this.context.globalState.update(CONNECTIONS_KEY, all);
    await this.context.secrets.delete(`queryforge.password.${id}`);
  }

  async connect(id: string): Promise<IAdapter> {
    const existing = this.activeSessions.get(id);
    if (existing?.isConnected()) return existing;

    const conn = this.getAll().find(c => c.id === id);
    if (!conn) throw new Error('Connection not found');

    const password = await this.context.secrets.get(`queryforge.password.${id}`);
    if (password === undefined) throw new Error('No password stored for this connection');

    const adapter = this.createAdapter(conn);
    await adapter.connect(password);
    this.activeSessions.set(id, adapter);
    return adapter;
  }

  async disconnect(id: string): Promise<void> {
    const adapter = this.activeSessions.get(id);
    if (adapter) {
      await adapter.disconnect();
      this.activeSessions.delete(id);
    }
  }

  getAdapter(id: string): IAdapter | undefined {
    return this.activeSessions.get(id);
  }

  isConnected(id: string): boolean {
    return this.activeSessions.get(id)?.isConnected() ?? false;
  }

  async disconnectAll(): Promise<void> {
    for (const [id] of this.activeSessions) {
      await this.disconnect(id);
    }
  }

  private createAdapter(conn: Connection): IAdapter {
    const type: DbType = conn.dbType;
    if (type === 'mysql') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { MySQLAdapter } = require('./MySQLAdapter') as typeof import('./MySQLAdapter');
      return new MySQLAdapter(conn);
    }
    if (type === 'oracle') {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { OracleAdapter } = require('./OracleAdapter') as typeof import('./OracleAdapter');
      return new OracleAdapter(conn);
    }
    throw new Error(`Unsupported database type: ${type}`);
  }
}
