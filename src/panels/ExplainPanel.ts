import * as vscode from 'vscode';
import type { ExplainNode } from '../types';

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: 32 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export class ExplainPanel {
  private static instance: ExplainPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private ready = false;
  private pendingMessages: unknown[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
  ) {
    this.panel = panel;
    this.panel.onDidDispose(() => {
      ExplainPanel.instance = undefined;
    });
    this.panel.webview.html = this.buildHtml();
    this.panel.webview.onDidReceiveMessage((msg: { type: string }) => {
      if (msg.type === 'ready') {
        this.ready = true;
        for (const m of this.pendingMessages) {
          void this.panel.webview.postMessage(m);
        }
        this.pendingMessages = [];
      }
    });
  }

  private post(msg: unknown): void {
    if (this.ready) {
      void this.panel.webview.postMessage(msg);
    } else {
      this.pendingMessages.push(msg);
    }
  }

  static show(extensionUri: vscode.Uri): ExplainPanel {
    if (ExplainPanel.instance) {
      ExplainPanel.instance.panel.reveal(vscode.ViewColumn.Two, true);
      return ExplainPanel.instance;
    }
    const panel = vscode.window.createWebviewPanel(
      'queryforgeExplain',
      'Explain Plan',
      { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true },
    );
    ExplainPanel.instance = new ExplainPanel(panel, extensionUri);
    return ExplainPanel.instance;
  }

  showExplain(node: ExplainNode): void {
    this.panel.reveal(vscode.ViewColumn.Two, true);
    this.post({ type: 'explainResult', data: node });
  }

  showError(message: string): void {
    this.panel.reveal(vscode.ViewColumn.Two, true);
    this.post({ type: 'error', message });
  }

  private buildHtml(): string {
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview-explainPanel.js'),
    );
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Explain Plan</title>
</head>
<body>
  <div id="app"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}
