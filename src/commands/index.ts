import * as vscode from 'vscode';
import * as fs from 'fs';
import type { Connection, DbType } from '../types';
import type { ConnectionManager } from '../database/ConnectionManager';
import type { ConnectionTreeProvider } from '../providers/ConnectionTreeProvider';
import { ConnectionItem } from '../providers/ConnectionTreeProvider';
import { QueryConsolePanel } from '../panels/QueryConsolePanel';
import { ResultsPanel } from '../panels/ResultsPanel';

export function registerCommands(
  context: vscode.ExtensionContext,
  manager: ConnectionManager,
  treeProvider: ConnectionTreeProvider,
): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reg = (id: string, fn: (...args: any[]) => any) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  reg('queryforge.openConsole', (item?: ConnectionItem) => {
    QueryConsolePanel.show(context.extensionUri, manager, item?.connection.id);
  });

  reg('queryforge.addConnection', async () => {
    const result = await promptConnectionWizard(undefined);
    if (!result) return;
    const saved = await manager.add(result.connection, result.password);
    treeProvider.refresh();
    vscode.window.showInformationMessage(`Connection "${saved.name}" added.`);
  });

  reg('queryforge.editConnection', async (item?: ConnectionItem) => {
    if (!item) {
      vscode.window.showErrorMessage('Select a connection from the sidebar to edit.');
      return;
    }
    const result = await promptConnectionWizard(item.connection);
    if (!result) return;
    await manager.update({ ...result.connection, id: item.connection.id }, result.password || undefined);
    treeProvider.refresh();
    vscode.window.showInformationMessage(`Connection "${result.connection.name}" updated.`);
  });

  reg('queryforge.deleteConnection', async (item?: ConnectionItem) => {
    if (!item) return;
    const confirm = await vscode.window.showWarningMessage(
      `Delete connection "${item.connection.name}"?`,
      { modal: true },
      'Delete',
    );
    if (confirm !== 'Delete') return;
    await manager.remove(item.connection.id);
    treeProvider.refresh();
  });

  reg('queryforge.testConnection', async (item?: ConnectionItem) => {
    if (!item) return;
    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Testing "${item.connection.name}"…` },
        () => manager.connect(item.connection.id),
      );
      treeProvider.refresh();
      vscode.window.showInformationMessage(`Connected to "${item.connection.name}" successfully.`);
    } catch (err) {
      vscode.window.showErrorMessage(`Connection failed: ${(err as Error).message}`);
    }
  });

  reg('queryforge.connectProfile', async (item?: ConnectionItem) => {
    if (!item) return;
    try {
      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Connecting to "${item.connection.name}"…` },
        () => manager.connect(item.connection.id),
      );
      treeProvider.refresh();
      vscode.window.showInformationMessage(`Connected to "${item.connection.name}".`);
    } catch (err) {
      vscode.window.showErrorMessage(`Failed: ${(err as Error).message}`);
    }
  });

  reg('queryforge.disconnectProfile', async (item?: ConnectionItem) => {
    if (!item) return;
    await manager.disconnect(item.connection.id);
    treeProvider.refresh();
  });

  reg('queryforge.refreshConnections', () => {
    treeProvider.refresh();
  });

  reg('queryforge.runQuery', async (sqlArg?: string) => {
    await runOrExplain('run', sqlArg, manager, context.extensionUri, treeProvider);
  });

  reg('queryforge.explainQuery', async (sqlArg?: string) => {
    await runOrExplain('explain', sqlArg, manager, context.extensionUri, treeProvider);
  });

  reg('queryforge.runSqlScript', async () => {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { 'SQL Files': ['sql'], 'All Files': ['*'] },
      title: 'Open SQL Script',
    });
    if (!uris || !uris[0]) return;
    const sql = fs.readFileSync(uris[0].fsPath, 'utf8').trim().replace(/;+$/, '');
    if (!sql) { vscode.window.showErrorMessage('SQL file is empty.'); return; }
    await runOrExplain('run', sql, manager, context.extensionUri, treeProvider);
  });
}

async function runOrExplain(
  mode: 'run' | 'explain',
  sqlArg: string | undefined,
  manager: ConnectionManager,
  extensionUri: vscode.Uri,
  treeProvider: ConnectionTreeProvider,
): Promise<void> {
  let sql = sqlArg;
  if (!sql) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active SQL editor.');
      return;
    }
    sql = editor.selection.isEmpty
      ? editor.document.getText()
      : editor.document.getText(editor.selection);
    sql = sql.trim().replace(/;+$/, '');
  }
  if (!sql) {
    vscode.window.showErrorMessage('No SQL to execute.');
    return;
  }

  const connections = manager.getAll();
  if (connections.length === 0) {
    const add = await vscode.window.showErrorMessage('No connections configured.', 'Add Connection');
    if (add) vscode.commands.executeCommand('queryforge.addConnection');
    return;
  }

  const active = connections.filter(c => manager.isConnected(c.id));
  let connectionId: string;

  if (active.length === 1) {
    connectionId = active[0].id;
  } else {
    const picks = connections.map(c => ({
      label: c.name,
      description: `${c.dbType} · ${c.host}:${c.port}/${c.database}`,
      id: c.id,
    }));
    const picked = await vscode.window.showQuickPick(picks, { placeHolder: 'Select a connection' });
    if (!picked) return;
    connectionId = picked.id;
  }

  try {
    await manager.connect(connectionId);
    treeProvider.refresh();
  } catch (err) {
    vscode.window.showErrorMessage(`Connection failed: ${(err as Error).message}`);
    return;
  }

  const adapter = manager.getAdapter(connectionId)!;
  const resultsPanel = ResultsPanel.show(extensionUri);
  const label = mode === 'run' ? 'Executing query…' : 'Explaining query…';
  const PAGE_SIZE = 50;

  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: label },
      async () => {
        if (mode === 'run') {
          const result = await adapter.queryPage(sql!, 0, PAGE_SIZE);
          resultsPanel.showResult(result, sql!, adapter);
        } else {
          const node = await adapter.explain(sql!);
          resultsPanel.showExplain(node);
        }
      },
    );
  } catch (err) {
    const message = (err as Error).message;
    resultsPanel.showError(message);
    vscode.window.showErrorMessage(`Query failed: ${message}`);
  }
}

async function promptConnectionWizard(
  existing: Connection | undefined,
): Promise<{ connection: Omit<Connection, 'id'>; password: string } | undefined> {
  const name = await vscode.window.showInputBox({
    prompt: 'Connection name',
    value: existing?.name ?? '',
    validateInput: v => (v.trim() ? undefined : 'Name is required'),
  });
  if (name === undefined) return undefined;

  const dbTypePick = await vscode.window.showQuickPick(
    [
      { label: 'MySQL / MariaDB', value: 'mysql' as DbType },
      { label: 'Oracle', value: 'oracle' as DbType },
    ],
    { placeHolder: 'Database type' },
  );
  if (!dbTypePick) return undefined;
  const dbType = dbTypePick.value;

  const defaultPort = dbType === 'mysql' ? '3306' : '1521';
  const host = await vscode.window.showInputBox({
    prompt: 'Host',
    value: existing?.host ?? 'localhost',
    validateInput: v => (v.trim() ? undefined : 'Host is required'),
  });
  if (host === undefined) return undefined;

  const portStr = await vscode.window.showInputBox({
    prompt: 'Port',
    value: String(existing?.port ?? defaultPort),
    validateInput: v => (isNaN(Number(v)) || !v.trim() ? 'Must be a valid port number' : undefined),
  });
  if (portStr === undefined) return undefined;

  const database = await vscode.window.showInputBox({
    prompt: dbType === 'oracle' ? 'Service name (e.g. ORCL or XE)' : 'Database name',
    value: existing?.database ?? '',
    validateInput: v => (v.trim() ? undefined : 'Required'),
  });
  if (database === undefined) return undefined;

  const username = await vscode.window.showInputBox({
    prompt: 'Username',
    value: existing?.username ?? '',
    validateInput: v => (v.trim() ? undefined : 'Required'),
  });
  if (username === undefined) return undefined;

  const password = await vscode.window.showInputBox({
    prompt: 'Password',
    password: true,
    value: '',
  });
  if (password === undefined) return undefined;

  return {
    connection: {
      name: name.trim(),
      dbType,
      host: host.trim(),
      port: Number(portStr),
      database: database.trim(),
      username: username.trim(),
    },
    password,
  };
}
