import * as vscode from 'vscode';
import type { QueryResult } from '../types';
import type { IAdapter } from '../database/IAdapter';

const PAGE_SIZE = 50;

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export class ResultsPanel {
  private static instance: ResultsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private currentSql: string | undefined;
  private currentAdapter: IAdapter | undefined;
  private ready = false;
  private pendingMessages: unknown[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => {
      ResultsPanel.instance = undefined;
    });
    this.panel.webview.html = this.buildHtml();
    this.panel.webview.onDidReceiveMessage((msg: { type: string; page?: number }) => {
      void this.handleMessage(msg);
    });
  }

  private async handleMessage(msg: { type: string; page?: number }): Promise<void> {
    if (msg.type === 'ready') {
      this.ready = true;
      for (const m of this.pendingMessages) {
        void this.panel.webview.postMessage(m);
      }
      this.pendingMessages = [];
      return;
    }
    if (msg.type === 'page' && msg.page !== undefined && this.currentSql && this.currentAdapter) {
      try {
        const result = await this.currentAdapter.queryPage(this.currentSql, msg.page, PAGE_SIZE);
        void this.panel.webview.postMessage({ type: 'result', data: result, page: msg.page });
      } catch (err) {
        void this.panel.webview.postMessage({ type: 'error', message: (err as Error).message });
      }
    }
  }

  private post(msg: unknown): void {
    if (this.ready) {
      void this.panel.webview.postMessage(msg);
    } else {
      this.pendingMessages.push(msg);
    }
  }

  static show(extensionUri: vscode.Uri): ResultsPanel {
    if (ResultsPanel.instance) {
      ResultsPanel.instance.panel.reveal(vscode.ViewColumn.Two, true);
      return ResultsPanel.instance;
    }
    const panel = vscode.window.createWebviewPanel(
      'queryforgeResults',
      'Query Results',
      { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    ResultsPanel.instance = new ResultsPanel(panel, extensionUri);
    return ResultsPanel.instance;
  }

  showResult(result: QueryResult, sql?: string, adapter?: IAdapter): void {
    this.currentSql = sql;
    this.currentAdapter = adapter;
    this.panel.reveal(vscode.ViewColumn.Two, true);
    this.post({ type: 'result', data: result });
  }

  showError(message: string): void {
    this.panel.reveal(vscode.ViewColumn.Two, true);
    this.post({ type: 'error', message });
  }

  private buildHtml(): string {
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview-resultsPanel.js'),
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Query Results</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
