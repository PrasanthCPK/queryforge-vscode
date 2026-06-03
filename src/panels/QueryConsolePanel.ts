import * as vscode from 'vscode';
import * as fs from 'fs';
import type { ConnectionManager } from '../database/ConnectionManager';

const PAGE_SIZE = 50;

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

interface WebviewMsg {
  type: string;
  sql?: string;
  connectionId?: string;
  page?: number;
  tabId?: string;
}

export class QueryConsolePanel {
  private static instance: QueryConsolePanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly manager: ConnectionManager,
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => {
      QueryConsolePanel.instance = undefined;
    });
    this.panel.webview.html = this.buildHtml();
    this.panel.webview.onDidReceiveMessage((msg: WebviewMsg) => {
      void this.handleMessage(msg);
    });
    this.pushConnections();
  }

  private async handleMessage(msg: WebviewMsg): Promise<void> {
    if (msg.type === 'openScript') {
      const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        filters: { 'SQL Files': ['sql'], 'All Files': ['*'] },
        title: 'Open SQL Script',
      });
      if (uris && uris[0]) {
        const sql = fs.readFileSync(uris[0].fsPath, 'utf8');
        void this.panel.webview.postMessage({ type: 'loadScript', sql });
      }
      return;
    }

    if (msg.type === 'run' || msg.type === 'explain') {
      if (!msg.sql || !msg.connectionId) return;
      const sql = msg.sql.trim().replace(/;+$/, '');
      const { connectionId } = msg;
      let adapter;
      try {
        adapter = await this.manager.connect(connectionId);
      } catch (err) {
        void this.panel.webview.postMessage({ type: 'error', message: (err as Error).message });
        return;
      }
      try {
        if (msg.type === 'run') {
          const result = await adapter.queryPage(sql, msg.page ?? 0, PAGE_SIZE);
          void this.panel.webview.postMessage({ type: 'result', data: result });
        } else {
          const node = await adapter.explain(sql);
          void this.panel.webview.postMessage({ type: 'explainResult', data: node });
        }
      } catch (err) {
        void this.panel.webview.postMessage({ type: 'error', message: (err as Error).message });
      }
      return;
    }

    if (msg.type === 'page') {
      if (!msg.sql || !msg.connectionId || msg.page === undefined) return;
      const sql = msg.sql.trim().replace(/;+$/, '');
      let adapter;
      try {
        adapter = await this.manager.connect(msg.connectionId);
      } catch (err) {
        void this.panel.webview.postMessage({ type: 'error', message: (err as Error).message });
        return;
      }
      try {
        const result = await adapter.queryPage(sql, msg.page, PAGE_SIZE);
        void this.panel.webview.postMessage({
          type: 'pageResult',
          data: result,
          page: msg.page,
          tabId: msg.tabId,
        });
      } catch (err) {
        void this.panel.webview.postMessage({ type: 'error', message: (err as Error).message });
      }
    }
  }

  static show(
    extensionUri: vscode.Uri,
    manager: ConnectionManager,
    connectionId?: string,
  ): QueryConsolePanel {
    if (QueryConsolePanel.instance) {
      QueryConsolePanel.instance.panel.reveal(vscode.ViewColumn.One);
      QueryConsolePanel.instance.pushConnections();
      if (connectionId) {
        void QueryConsolePanel.instance.panel.webview.postMessage({
          type: 'selectConnection',
          connectionId,
        });
      }
      return QueryConsolePanel.instance;
    }

    const panel = vscode.window.createWebviewPanel(
      'queryforgeConsole',
      'Query Console',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true },
    );
    QueryConsolePanel.instance = new QueryConsolePanel(panel, extensionUri, manager);
    if (connectionId) {
      void QueryConsolePanel.instance.panel.webview.postMessage({
        type: 'selectConnection',
        connectionId,
      });
    }
    return QueryConsolePanel.instance;
  }

  pushConnections(): void {
    void this.panel.webview.postMessage({
      type: 'connections',
      list: this.manager.getAll(),
    });
  }

  private buildHtml(): string {
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview-queryConsole.js'),
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Query Console</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
