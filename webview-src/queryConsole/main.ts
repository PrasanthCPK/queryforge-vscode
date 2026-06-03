declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(s: unknown): void;
};

interface Connection {
  id: string;
  name: string;
  dbType: string;
  host: string;
  port: number;
  database: string;
  username: string;
}

const vscode = acquireVsCodeApi();

document.body.innerHTML = `
<style>
  :root {
    --bg: var(--vscode-editor-background, #1e1e1e);
    --fg: var(--vscode-editor-foreground, #d4d4d4);
    --border: var(--vscode-panel-border, #3c3c3c);
    --toolbar-bg: var(--vscode-tab-inactiveBackground, #2d2d2d);
    --btn-bg: var(--vscode-button-background, #0e639c);
    --btn-fg: var(--vscode-button-foreground, #fff);
    --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
    --input-bg: var(--vscode-input-background, #3c3c3c);
    --input-fg: var(--vscode-input-foreground, #ccc);
    --input-border: var(--vscode-input-border, #555);
    --font: var(--vscode-editor-font-family, Consolas, monospace);
    --font-size: var(--vscode-editor-font-size, 14px);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--fg);
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: var(--vscode-font-family, sans-serif);
  }
  #toolbar {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--toolbar-bg);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  #connSelect {
    background: var(--input-bg);
    color: var(--input-fg);
    border: 1px solid var(--input-border);
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 13px;
    min-width: 200px;
    flex-shrink: 0;
  }
  .btn {
    background: var(--btn-bg);
    color: var(--btn-fg);
    border: none;
    padding: 5px 14px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 13px;
    flex-shrink: 0;
  }
  .btn:hover:not(:disabled) { background: var(--btn-hover); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  #status {
    font-size: 12px;
    color: var(--vscode-descriptionForeground, #888);
    margin-left: auto;
    white-space: nowrap;
  }
  #status.error { color: var(--vscode-errorForeground, #f48771); }
  #sqlEditor {
    flex: 1;
    width: 100%;
    background: var(--bg);
    color: var(--fg);
    border: none;
    outline: none;
    padding: 16px;
    font-family: var(--font);
    font-size: var(--font-size);
    line-height: 1.6;
    resize: none;
    tab-size: 2;
    caret-color: var(--fg);
  }
  #hint {
    padding: 4px 12px 6px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground, #888);
    background: var(--toolbar-bg);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
</style>
<div id="toolbar">
  <select id="connSelect">
    <option value="">— Select connection —</option>
  </select>
  <button class="btn" id="runBtn" title="Run query (Ctrl+Enter)">▶ Run</button>
  <button class="btn" id="explainBtn" title="Explain query (Ctrl+Shift+X)">⚡ Explain</button>
  <span id="status"></span>
</div>
<textarea id="sqlEditor" spellcheck="false" placeholder="Enter SQL query here…&#10;&#10;Ctrl+Enter — Run query&#10;Ctrl+Shift+X — Explain query"></textarea>
<div id="hint">Ctrl+Enter to run · Ctrl+Shift+X to explain · Tab for indentation</div>
`;

const connSelect = document.getElementById('connSelect') as HTMLSelectElement;
const runBtn = document.getElementById('runBtn') as HTMLButtonElement;
const explainBtn = document.getElementById('explainBtn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;
const editor = document.getElementById('sqlEditor') as HTMLTextAreaElement;

function setLoading(loading: boolean): void {
  runBtn.disabled = loading;
  explainBtn.disabled = loading;
  if (loading) {
    statusEl.className = '';
    statusEl.textContent = 'Running…';
  }
}

function setStatus(text: string, isError = false): void {
  statusEl.className = isError ? 'error' : '';
  statusEl.textContent = text;
}

function send(type: 'run' | 'explain'): void {
  const sql = editor.value.trim();
  if (!sql) { setStatus('No SQL entered.'); return; }
  const connectionId = connSelect.value;
  if (!connectionId) { setStatus('Select a connection first.'); return; }
  setLoading(true);
  vscode.postMessage({ type, sql, connectionId });
}

runBtn.addEventListener('click', () => send('run'));
explainBtn.addEventListener('click', () => send('explain'));

editor.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    send('run');
    return;
  }
  if (e.key === 'x' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
    e.preventDefault();
    send('explain');
    return;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = `${editor.value.slice(0, start)}  ${editor.value.slice(end)}`;
    editor.selectionStart = editor.selectionEnd = start + 2;
  }
});

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as {
    type: string;
    list?: Connection[];
    executionTimeMs?: number;
    message?: string;
    connectionId?: string;
  };

  switch (msg.type) {
    case 'connections':
      populateConnections(msg.list ?? []);
      break;
    case 'queryEnd':
      setLoading(false);
      setStatus(
        msg.executionTimeMs !== undefined && msg.executionTimeMs > 0
          ? `Done in ${msg.executionTimeMs}ms`
          : 'Done',
      );
      break;
    case 'error':
      setLoading(false);
      setStatus(msg.message ?? 'An error occurred.', true);
      break;
    case 'selectConnection':
      if (msg.connectionId) connSelect.value = msg.connectionId;
      break;
  }
});

function populateConnections(list: Connection[]): void {
  const current = connSelect.value;
  connSelect.innerHTML = '<option value="">— Select connection —</option>';
  for (const c of list) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = `${c.name}  (${c.dbType.toUpperCase()})`;
    connSelect.appendChild(opt);
  }
  if (current) connSelect.value = current;
}
