import * as vscode from 'vscode';
import type { QueryResult, ExplainNode } from '../types';

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export class ResultsPanel {
  private static instance: ResultsPanel | undefined;
  private readonly panel: vscode.WebviewPanel;

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => {
      ResultsPanel.instance = undefined;
    });
    this.panel.webview.html = this.buildHtml();
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

  showResult(result: QueryResult): void {
    this.panel.reveal(vscode.ViewColumn.Two, true);
    void this.panel.webview.postMessage({ type: 'result', data: result });
  }

  showExplain(node: ExplainNode): void {
    this.panel.reveal(vscode.ViewColumn.Two, true);
    void this.panel.webview.postMessage({ type: 'explainResult', data: node });
  }

  showError(message: string): void {
    this.panel.reveal(vscode.ViewColumn.Two, true);
    void this.panel.webview.postMessage({ type: 'error', message });
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
