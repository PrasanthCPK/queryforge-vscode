export {};

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

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  totalRows?: number;
  executionTimeMs: number;
}

interface ExplainNode {
  id: string;
  operation: string;
  details: Record<string, unknown>;
  children: ExplainNode[];
}

interface ResultTab {
  id: string;
  label: string;
  type: 'empty' | 'result' | 'explain' | 'error';
  resultData: QueryResult | null;
  explainData: ExplainNode | null;
  errorMsg: string;
  pinned: boolean;
  page: number;
  totalPages: number;
  sortCol: number;
  sortDir: 'asc' | 'desc';
  sql: string;
  connectionId: string;
}

const vscode = acquireVsCodeApi();
const PAGE_SIZE = 50;

let tabs: ResultTab[] = [];
let activeTabId: string | null = null;
let tabCounter = 0;

document.body.innerHTML = `
<style>
  :root {
    --bg: var(--vscode-editor-background, #1e1e1e);
    --fg: var(--vscode-editor-foreground, #d4d4d4);
    --border: var(--vscode-panel-border, #3c3c3c);
    --toolbar-bg: var(--vscode-tab-inactiveBackground, #2d2d2d);
    --header-bg: var(--vscode-editorGroupHeader-tabsBackground, #252526);
    --tab-bg: var(--vscode-tab-inactiveBackground, #2d2d2d);
    --hover-bg: var(--vscode-list-hoverBackground, #2a2d2e);
    --btn-bg: var(--vscode-button-background, #0e639c);
    --btn-fg: var(--vscode-button-foreground, #fff);
    --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
    --input-bg: var(--vscode-input-background, #3c3c3c);
    --input-fg: var(--vscode-input-foreground, #ccc);
    --input-border: var(--vscode-input-border, #555);
    --desc: var(--vscode-descriptionForeground, #888);
    --error: var(--vscode-errorForeground, #f48771);
    --warn-border: #ce9178;
    --font: var(--vscode-editor-font-family, Consolas, monospace);
    --font-size: var(--vscode-editor-font-size, 14px);
    --pin-active: #f0a800;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--fg);
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: var(--vscode-font-family, sans-serif);
    overflow: hidden;
  }
  /* ── Editor section ── */
  #editor-section {
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
    overflow: hidden;
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
  .btn-secondary {
    background: var(--tab-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    padding: 5px 14px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 13px;
    flex-shrink: 0;
  }
  .btn-secondary:hover { background: var(--hover-bg); }
  #status {
    font-size: 12px;
    color: var(--desc);
    margin-left: auto;
    white-space: nowrap;
  }
  #status.error { color: var(--error); }
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
    overflow: auto;
  }
  #hint {
    padding: 4px 12px 6px;
    font-size: 11px;
    color: var(--desc);
    background: var(--toolbar-bg);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
  }
  /* ── Splitter ── */
  #splitter {
    height: 5px;
    background: var(--border);
    cursor: row-resize;
    flex-shrink: 0;
    transition: background 0.1s;
  }
  #splitter:hover, #splitter.dragging { background: var(--btn-bg); }
  /* ── Results section ── */
  #results-section {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }
  #tabs-bar {
    display: flex;
    align-items: center;
    background: var(--header-bg);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
  }
  .result-tab {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px 6px 14px;
    background: var(--tab-bg);
    border: none;
    border-right: 1px solid var(--border);
    border-bottom: 2px solid transparent;
    color: var(--fg);
    cursor: pointer;
    font-size: 12px;
    white-space: nowrap;
    flex-shrink: 0;
    user-select: none;
  }
  .result-tab.active {
    background: var(--bg);
    border-bottom-color: var(--btn-bg);
  }
  .result-tab:hover:not(.active) { background: var(--hover-bg); }
  .tab-pin {
    background: none;
    border: none;
    color: var(--desc);
    cursor: pointer;
    font-size: 11px;
    padding: 0 2px;
    line-height: 1;
    opacity: 0.5;
    transition: opacity 0.1s, color 0.1s;
  }
  .tab-pin:hover { opacity: 1; }
  .tab-pin.pinned { color: var(--pin-active); opacity: 1; }
  .tab-close {
    background: none;
    border: none;
    color: var(--desc);
    cursor: pointer;
    font-size: 13px;
    padding: 0 2px;
    line-height: 1;
    opacity: 0.5;
    transition: opacity 0.1s, color 0.1s;
  }
  .tab-close:hover { opacity: 1; color: var(--error); }
  #results-content {
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
  }
  .placeholder {
    padding: 32px;
    color: var(--desc);
    font-style: italic;
    text-align: center;
  }
  /* ── Export bar ── */
  #export-bar {
    padding: 6px 12px;
    background: var(--header-bg);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  #export-bar .meta {
    font-size: 12px;
    color: var(--desc);
    margin-left: auto;
  }
  .export-btn {
    background: var(--btn-bg);
    color: var(--btn-fg);
    border: none;
    padding: 3px 12px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  }
  .export-btn:hover { background: var(--btn-hover); }
  /* ── Table ── */
  #table-wrap { flex: 1; overflow: auto; }
  table { border-collapse: collapse; width: 100%; }
  thead th {
    position: sticky;
    top: 0;
    background: var(--header-bg);
    padding: 6px 12px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
    font-weight: 600;
  }
  thead th:hover { background: var(--hover-bg); }
  thead th.asc::after { content: ' ▲'; font-size: 10px; }
  thead th.desc::after { content: ' ▼'; font-size: 10px; }
  tbody tr:hover { background: var(--hover-bg); }
  tbody td {
    padding: 4px 12px;
    border-bottom: 1px solid var(--border);
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font);
    font-size: 13px;
  }
  .null { color: var(--desc); font-style: italic; }
  /* ── Pagination ── */
  #pagination {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    background: var(--header-bg);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    font-size: 12px;
  }
  .page-btn {
    background: var(--tab-bg);
    color: var(--fg);
    border: 1px solid var(--border);
    padding: 2px 10px;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  }
  .page-btn:hover:not(:disabled) { background: var(--hover-bg); }
  .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  #page-info { color: var(--desc); }
  /* ── Error ── */
  .error-msg { padding: 24px; color: var(--error); }
  /* ── Explain tree ── */
  .tree-root { padding: 16px; }
  .tree-node { margin: 6px 0; }
  .node-header {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 6px 10px;
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    user-select: none;
    background: var(--tab-bg);
  }
  .node-header:hover { background: var(--hover-bg); }
  .node-header.warn { border-color: var(--warn-border); }
  .toggle { font-size: 10px; width: 10px; flex-shrink: 0; color: var(--desc); }
  .op { font-weight: 600; font-size: 13px; }
  .det { font-size: 11px; color: var(--desc); }
  .node-children { margin-left: 20px; border-left: 2px solid var(--border); padding-left: 10px; }
  .node-children.collapsed { display: none; }
  /* ── Loading overlay ── */
  .paging-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: var(--fg);
    pointer-events: none;
  }
</style>

<div id="editor-section" style="height: 40%">
  <div id="toolbar">
    <select id="connSelect">
      <option value="">— Select connection —</option>
    </select>
    <button class="btn" id="runBtn" title="Run query (Ctrl+Enter)">▶ Run</button>
    <button class="btn" id="explainBtn" title="Explain query (Ctrl+Shift+X)">⚡ Explain</button>
    <button class="btn-secondary" id="scriptBtn" title="Open and run a SQL script file">📂 Run Script</button>
    <span id="status"></span>
  </div>
  <textarea id="sqlEditor" spellcheck="false" placeholder="Enter SQL query here…&#10;&#10;Ctrl+Enter — Run query&#10;Ctrl+Shift+X — Explain query"></textarea>
  <div id="hint">Ctrl+Enter to run · Ctrl+Shift+X to explain · Tab for indentation</div>
</div>

<div id="splitter"></div>

<div id="results-section">
  <div id="tabs-bar"></div>
  <div id="results-content">
    <p class="placeholder">Run a query to see results.</p>
  </div>
</div>
`;

// ── DOM refs ──────────────────────────────────────────────────────────────────
const connSelect = document.getElementById('connSelect') as HTMLSelectElement;
const runBtn = document.getElementById('runBtn') as HTMLButtonElement;
const explainBtn = document.getElementById('explainBtn') as HTMLButtonElement;
const scriptBtn = document.getElementById('scriptBtn') as HTMLButtonElement;
const statusEl = document.getElementById('status') as HTMLSpanElement;
const editor = document.getElementById('sqlEditor') as HTMLTextAreaElement;
const editorSection = document.getElementById('editor-section') as HTMLDivElement;
const splitter = document.getElementById('splitter') as HTMLDivElement;
const resultsSection = document.getElementById('results-section') as HTMLDivElement;
const tabsBar = document.getElementById('tabs-bar') as HTMLDivElement;
const resultsContent = document.getElementById('results-content') as HTMLDivElement;

// ── Splitter drag ─────────────────────────────────────────────────────────────
let isDragging = false;
splitter.addEventListener('mousedown', () => {
  isDragging = true;
  splitter.classList.add('dragging');
  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'row-resize';
});
document.addEventListener('mousemove', (e: MouseEvent) => {
  if (!isDragging) return;
  const bodyH = document.body.clientHeight;
  const minPx = 80;
  const maxPx = bodyH - 120;
  const newH = Math.min(maxPx, Math.max(minPx, e.clientY));
  editorSection.style.height = `${newH}px`;
});
document.addEventListener('mouseup', () => {
  if (!isDragging) return;
  isDragging = false;
  splitter.classList.remove('dragging');
  document.body.style.userSelect = '';
  document.body.style.cursor = '';
});

// ── Editor actions ────────────────────────────────────────────────────────────
function setLoading(loading: boolean): void {
  runBtn.disabled = loading;
  explainBtn.disabled = loading;
  scriptBtn.disabled = loading;
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
  const raw = editor.value.trim();
  if (!raw) { setStatus('No SQL entered.'); return; }
  const sql = raw.replace(/;+$/, '');
  const connectionId = connSelect.value;
  if (!connectionId) { setStatus('Select a connection first.'); return; }
  setLoading(true);
  vscode.postMessage({ type, sql, connectionId, page: 0 });
}

runBtn.addEventListener('click', () => send('run'));
explainBtn.addEventListener('click', () => send('explain'));
scriptBtn.addEventListener('click', () => {
  vscode.postMessage({ type: 'openScript' });
});

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

// ── Tab management ────────────────────────────────────────────────────────────
function newTab(label: string): ResultTab {
  return {
    id: `tab-${++tabCounter}`,
    label,
    type: 'empty',
    resultData: null,
    explainData: null,
    errorMsg: '',
    pinned: false,
    page: 0,
    totalPages: 1,
    sortCol: -1,
    sortDir: 'asc',
    sql: '',
    connectionId: '',
  };
}

function getOrCreateTargetTab(label: string): ResultTab {
  const unpinned = tabs.find(t => !t.pinned);
  if (unpinned) {
    unpinned.label = label;
    unpinned.page = 0;
    unpinned.totalPages = 1;
    unpinned.sortCol = -1;
    unpinned.sortDir = 'asc';
    return unpinned;
  }
  const tab = newTab(label);
  tabs.push(tab);
  return tab;
}

function closeTab(tabId: string): void {
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx < 0) return;
  tabs.splice(idx, 1);
  if (activeTabId === tabId) {
    activeTabId = tabs.length > 0 ? tabs[Math.max(0, idx - 1)].id : null;
  }
  renderTabsBar();
  renderActiveTab();
}

function renderTabsBar(): void {
  tabsBar.innerHTML = '';
  if (tabs.length === 0) return;
  for (const tab of tabs) {
    const btn = document.createElement('div');
    btn.className = `result-tab${tab.id === activeTabId ? ' active' : ''}`;
    btn.dataset['id'] = tab.id;

    const labelSpan = document.createElement('span');
    labelSpan.textContent = tab.label;
    btn.appendChild(labelSpan);

    const pinBtn = document.createElement('button');
    pinBtn.className = `tab-pin${tab.pinned ? ' pinned' : ''}`;
    pinBtn.title = tab.pinned ? 'Unpin tab' : 'Pin tab';
    pinBtn.textContent = '📌';
    pinBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      tab.pinned = !tab.pinned;
      renderTabsBar();
    });
    btn.appendChild(pinBtn);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.title = 'Close tab';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    btn.appendChild(closeBtn);

    btn.addEventListener('click', () => {
      activeTabId = tab.id;
      renderTabsBar();
      renderActiveTab();
    });

    tabsBar.appendChild(btn);
  }
}

function renderActiveTab(): void {
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) {
    resultsContent.innerHTML = '<p class="placeholder">Run a query to see results.</p>';
    return;
  }
  switch (tab.type) {
    case 'result':
      renderTable(tab);
      break;
    case 'explain':
      renderExplain(tab);
      break;
    case 'error':
      resultsContent.innerHTML = `<p class="error-msg">Error: ${esc(tab.errorMsg)}</p>`;
      break;
    default:
      resultsContent.innerHTML = '<p class="placeholder">Run a query to see results.</p>';
  }
}

// ── Table rendering with server-side pagination ───────────────────────────────
function sortedRows(tab: ResultTab): Record<string, unknown>[] {
  const result = tab.resultData!;
  const rows = [...result.rows];
  if (tab.sortCol < 0) return rows;
  const col = result.columns[tab.sortCol];
  return rows.sort((a, b) => {
    const av = String(a[col] ?? '');
    const bv = String(b[col] ?? '');
    return tab.sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });
}

function renderTable(tab: ResultTab): void {
  const result = tab.resultData!;
  resultsContent.innerHTML = '';

  const totalRows = result.totalRows ?? result.rowCount;

  if (result.rows.length === 0 && tab.page === 0) {
    resultsContent.innerHTML = `
      <div id="export-bar">
        <button class="export-btn" id="csvBtn">⬇ Export CSV</button>
        <span class="meta">${totalRows} row${totalRows !== 1 ? 's' : ''} · ${result.executionTimeMs}ms</span>
      </div>
      <p class="placeholder">Query returned no rows.</p>`;
    document.getElementById('csvBtn')!.addEventListener('click', () => exportCsv(result));
    return;
  }

  const pageRows = sortedRows(tab);
  const startRow = tab.page * PAGE_SIZE + 1;
  const endRow = tab.page * PAGE_SIZE + pageRows.length;
  const totalPages = tab.totalPages;

  const headers = result.columns.map((col, i) => {
    const cls = i === tab.sortCol ? ` class="${tab.sortDir}"` : '';
    return `<th${cls} data-i="${i}">${esc(col)}</th>`;
  }).join('');

  const body = pageRows.map(row =>
    `<tr>${result.columns.map(col => {
      const v = row[col];
      if (v === null || v === undefined) return `<td class="null">NULL</td>`;
      return `<td title="${esc(String(v))}">${esc(String(v))}</td>`;
    }).join('')}</tr>`,
  ).join('');

  const exportBar = document.createElement('div');
  exportBar.id = 'export-bar';
  exportBar.innerHTML = `
    <button class="export-btn" id="csvBtn">⬇ Export CSV</button>
    <span class="meta">${totalRows} row${totalRows !== 1 ? 's' : ''} · ${result.executionTimeMs}ms</span>
  `;
  resultsContent.appendChild(exportBar);

  const tableWrap = document.createElement('div');
  tableWrap.id = 'table-wrap';
  tableWrap.innerHTML = `
    <table>
      <thead><tr>${headers}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  `;
  resultsContent.appendChild(tableWrap);

  const pagination = document.createElement('div');
  pagination.id = 'pagination';
  pagination.innerHTML = `
    <button class="page-btn" id="prevBtn" ${tab.page === 0 ? 'disabled' : ''}>◀ Prev</button>
    <span id="page-info">Rows ${startRow}–${endRow} of ${totalRows}${totalPages > 1 ? ` · Page ${tab.page + 1} of ${totalPages}` : ''}</span>
    <button class="page-btn" id="nextBtn" ${tab.page >= totalPages - 1 ? 'disabled' : ''}>Next ▶</button>
  `;
  resultsContent.appendChild(pagination);

  document.getElementById('csvBtn')!.addEventListener('click', () => exportCsv(result));

  document.getElementById('prevBtn')?.addEventListener('click', () => {
    requestPage(tab, tab.page - 1);
  });
  document.getElementById('nextBtn')?.addEventListener('click', () => {
    requestPage(tab, tab.page + 1);
  });

  resultsContent.querySelectorAll<HTMLTableCellElement>('thead th').forEach(th => {
    th.addEventListener('click', () => {
      const i = parseInt(th.dataset['i']!);
      tab.sortDir = tab.sortCol === i && tab.sortDir === 'asc' ? 'desc' : 'asc';
      tab.sortCol = i;
      renderTable(tab);
    });
  });
}

function requestPage(tab: ResultTab, page: number): void {
  if (!tab.sql || !tab.connectionId) return;
  setStatus('Loading…');
  vscode.postMessage({ type: 'page', sql: tab.sql, connectionId: tab.connectionId, page, tabId: tab.id });
}

function exportCsv(result: QueryResult): void {
  const lines = [
    result.columns.map(csvEsc).join(','),
    ...result.rows.map(row => result.columns.map(c => csvEsc(String(row[c] ?? ''))).join(',')),
  ].join('\n');
  const blob = new Blob([lines], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'results.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ── Explain rendering ─────────────────────────────────────────────────────────
function renderExplain(tab: ResultTab): void {
  resultsContent.innerHTML = `<div class="tree-root">${nodeHtml(tab.explainData!)}</div>`;
  resultsContent.querySelectorAll<HTMLElement>('.node-header').forEach(hdr => {
    hdr.addEventListener('click', () => {
      const children = hdr.nextElementSibling as HTMLElement | null;
      if (!children) return;
      children.classList.toggle('collapsed');
      hdr.querySelector('.toggle')!.textContent = children.classList.contains('collapsed') ? '▶' : '▼';
    });
  });
}

function nodeHtml(node: ExplainNode): string {
  const hasKids = node.children.length > 0;
  const isWarn = /full|all/i.test(node.operation);
  const det = Object.entries(node.details)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
  return `<div class="tree-node">
    <div class="node-header${isWarn ? ' warn' : ''}">
      <span class="toggle">${hasKids ? '▼' : ' '}</span>
      <span class="op">${esc(node.operation)}</span>
      ${det ? `<span class="det">${esc(det)}</span>` : ''}
    </div>
    ${hasKids ? `<div class="node-children">${node.children.map(nodeHtml).join('')}</div>` : ''}
  </div>`;
}

// ── Message handling ──────────────────────────────────────────────────────────
window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data as {
    type: string;
    list?: Connection[];
    data?: QueryResult | ExplainNode;
    message?: string;
    connectionId?: string;
    page?: number;
    tabId?: string;
    sql?: string;
  };

  switch (msg.type) {
    case 'connections':
      populateConnections(msg.list ?? []);
      break;

    case 'result': {
      const result = msg.data as QueryResult;
      const totalRows = result.totalRows ?? result.rowCount;
      const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
      const label = `Query ${tabCounter + 1}`;
      const tab = getOrCreateTargetTab(label);
      tab.type = 'result';
      tab.resultData = result;
      tab.explainData = null;
      tab.errorMsg = '';
      tab.page = 0;
      tab.totalPages = totalPages;
      tab.sortCol = -1;
      tab.sortDir = 'asc';
      tab.sql = editor.value.trim().replace(/;+$/, '');
      tab.connectionId = connSelect.value;
      if (!tabs.includes(tab)) tabs.push(tab);
      activeTabId = tab.id;
      setLoading(false);
      setStatus(`Done in ${result.executionTimeMs}ms · ${totalRows} row${totalRows !== 1 ? 's' : ''}`);
      renderTabsBar();
      renderActiveTab();
      break;
    }

    case 'pageResult': {
      const result = msg.data as QueryResult;
      const tab = tabs.find(t => t.id === msg.tabId) ?? tabs.find(t => t.id === activeTabId);
      if (!tab) break;
      const totalRows = result.totalRows ?? result.rowCount;
      const totalPages = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
      tab.resultData = result;
      tab.page = msg.page ?? tab.page;
      tab.totalPages = totalPages;
      tab.sortCol = -1;
      tab.sortDir = 'asc';
      setStatus(`Page ${tab.page + 1} of ${totalPages}`);
      if (tab.id === activeTabId) renderTable(tab);
      break;
    }

    case 'explainResult': {
      const node = msg.data as ExplainNode;
      const label = `Explain ${tabCounter + 1}`;
      const tab = getOrCreateTargetTab(label);
      tab.type = 'explain';
      tab.resultData = null;
      tab.explainData = node;
      tab.errorMsg = '';
      if (!tabs.includes(tab)) tabs.push(tab);
      activeTabId = tab.id;
      setLoading(false);
      setStatus('Explain done');
      renderTabsBar();
      renderActiveTab();
      break;
    }

    case 'error': {
      const errMsg = msg.message ?? 'Unknown error';
      const label = `Error ${tabCounter + 1}`;
      const tab = getOrCreateTargetTab(label);
      tab.type = 'error';
      tab.resultData = null;
      tab.explainData = null;
      tab.errorMsg = errMsg;
      if (!tabs.includes(tab)) tabs.push(tab);
      activeTabId = tab.id;
      setLoading(false);
      setStatus(errMsg, true);
      renderTabsBar();
      renderActiveTab();
      break;
    }

    case 'queryEnd':
      setLoading(false);
      break;

    case 'selectConnection':
      if (msg.connectionId) connSelect.value = msg.connectionId;
      break;

    case 'loadScript':
      if (msg.sql !== undefined) {
        editor.value = msg.sql;
        editor.focus();
        send('run');
      }
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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function csvEsc(v: string): string {
  return v.includes(',') || v.includes('"') || v.includes('\n')
    ? `"${v.replace(/"/g, '""')}"`
    : v;
}
