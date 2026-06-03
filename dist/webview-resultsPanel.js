/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it uses a non-standard name for the exports (exports).
(() => {
var exports = __webpack_exports__;

Object.defineProperty(exports, "__esModule", ({ value: true }));
const vscode = acquireVsCodeApi();
const PAGE_SIZE = 50;
let currentResult = null;
let currentPage = 0;
let totalPages = 1;
let sortCol = -1;
let sortDir = 'asc';
document.body.innerHTML = `
<style>
  :root {
    --bg: var(--vscode-editor-background, #1e1e1e);
    --fg: var(--vscode-editor-foreground, #d4d4d4);
    --border: var(--vscode-panel-border, #3c3c3c);
    --header-bg: var(--vscode-editorGroupHeader-tabsBackground, #252526);
    --tab-bg: var(--vscode-tab-inactiveBackground, #2d2d2d);
    --hover-bg: var(--vscode-list-hoverBackground, #2a2d2e);
    --btn-bg: var(--vscode-button-background, #0e639c);
    --btn-fg: var(--vscode-button-foreground, #fff);
    --btn-hover: var(--vscode-button-hoverBackground, #1177bb);
    --desc: var(--vscode-descriptionForeground, #888);
    --error: var(--vscode-errorForeground, #f48771);
    --warn-border: #ce9178;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--fg);
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: var(--vscode-font-family, sans-serif);
    font-size: 13px;
    overflow: hidden;
  }
  #toolbar {
    display: flex;
    align-items: center;
    background: var(--header-bg);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    padding: 0 8px;
    height: 35px;
  }
  #meta {
    margin-left: auto;
    font-size: 12px;
    color: var(--desc);
    padding: 0 8px;
    white-space: nowrap;
  }
  #clearBtn {
    margin-left: auto;
    background: none;
    border: none;
    color: var(--desc);
    cursor: pointer;
    font-size: 13px;
    padding: 4px 8px;
    border-radius: 3px;
    transition: color 0.1s, background 0.1s;
    flex-shrink: 0;
  }
  #clearBtn:hover { color: var(--error); background: var(--hover-bg); }
  #results-panel { flex: 1; overflow: auto; display: flex; flex-direction: column; }
  .placeholder {
    padding: 32px;
    color: var(--desc);
    font-style: italic;
    text-align: center;
  }
  #export-bar {
    padding: 6px 12px;
    background: var(--header-bg);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  #export-bar .meta { font-size: 12px; color: var(--desc); margin-left: auto; }
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
  #table-wrap { flex: 1; overflow: auto; }
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
    font-family: var(--vscode-editor-font-family, monospace);
  }
  .null { color: var(--desc); font-style: italic; }
  .error-msg { padding: 24px; color: var(--error); }
  /* Explain tree */
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
</style>
<div id="toolbar">
  <span id="meta"></span>
  <button id="clearBtn" title="Clear results">✕ Clear</button>
</div>
<div id="results-panel">
  <p class="placeholder">Run a query to see results.</p>
</div>
`;
const metaEl = document.getElementById('meta');
const resultsPanel = document.getElementById('results-panel');
const clearBtn = document.getElementById('clearBtn');
clearBtn.addEventListener('click', () => {
    currentResult = null;
    currentPage = 0;
    totalPages = 1;
    sortCol = -1;
    sortDir = 'asc';
    metaEl.textContent = '';
    resultsPanel.innerHTML = '<p class="placeholder">Run a query to see results.</p>';
});
window.addEventListener('message', (e) => {
    const msg = e.data;
    switch (msg.type) {
        case 'result': {
            const result = msg.data;
            const total = result.totalRows ?? result.rowCount;
            totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
            if (msg.page !== undefined) {
                currentPage = msg.page;
                currentResult = result;
                sortCol = -1;
                sortDir = 'asc';
            }
            else {
                currentResult = result;
                currentPage = 0;
                sortCol = -1;
                sortDir = 'asc';
            }
            renderTable();
            break;
        }
        case 'error': {
            metaEl.textContent = '';
            resultsPanel.innerHTML = `<p class="error-msg">Error: ${esc(msg.message ?? 'Unknown error')}</p>`;
            break;
        }
    }
});
function renderTable() {
    const result = currentResult;
    if (!result)
        return;
    const totalRowCount = result.totalRows ?? result.rowCount;
    metaEl.textContent = `${totalRowCount} row${totalRowCount !== 1 ? 's' : ''} · ${result.executionTimeMs}ms`;
    if (result.rows.length === 0 && currentPage === 0) {
        resultsPanel.innerHTML = '<p class="placeholder">Query returned no rows.</p>';
        return;
    }
    const pageRows = sortRows(result);
    const startRow = currentPage * PAGE_SIZE + 1;
    const endRow = currentPage * PAGE_SIZE + pageRows.length;
    const headers = result.columns.map((col, i) => {
        const cls = i === sortCol ? ` class="${sortDir}"` : '';
        return `<th${cls} data-i="${i}">${esc(col)}</th>`;
    }).join('');
    const body = pageRows.map(row => `<tr>${result.columns.map(col => {
        const v = row[col];
        if (v === null || v === undefined)
            return `<td class="null">NULL</td>`;
        return `<td title="${esc(String(v))}">${esc(String(v))}</td>`;
    }).join('')}</tr>`).join('');
    const paginationHtml = totalPages > 1 ? `
    <div id="pagination">
      <button class="page-btn" id="prevBtn" ${currentPage === 0 ? 'disabled' : ''}>◀ Prev</button>
      <span id="page-info">Rows ${startRow}–${endRow} of ${totalRowCount} · Page ${currentPage + 1} of ${totalPages}</span>
      <button class="page-btn" id="nextBtn" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>Next ▶</button>
    </div>` : `
    <div id="pagination">
      <span id="page-info">Rows 1–${pageRows.length} of ${totalRowCount}</span>
    </div>`;
    resultsPanel.innerHTML = `
    <div id="export-bar">
      <button class="export-btn" id="csvBtn">⬇ Export CSV</button>
      <span class="meta">${totalRowCount} row${totalRowCount !== 1 ? 's' : ''} · ${result.executionTimeMs}ms</span>
    </div>
    <div id="table-wrap">
      <table>
        <thead><tr>${headers}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    ${paginationHtml}
  `;
    resultsPanel.querySelectorAll('thead th').forEach(th => {
        th.addEventListener('click', () => {
            const i = parseInt(th.dataset['i']);
            sortDir = sortCol === i && sortDir === 'asc' ? 'desc' : 'asc';
            sortCol = i;
            renderTable();
        });
    });
    document.getElementById('csvBtn').addEventListener('click', () => exportCsv(result));
    document.getElementById('prevBtn')?.addEventListener('click', () => {
        vscode.postMessage({ type: 'page', page: currentPage - 1 });
    });
    document.getElementById('nextBtn')?.addEventListener('click', () => {
        vscode.postMessage({ type: 'page', page: currentPage + 1 });
    });
}
function sortRows(result) {
    const rows = [...result.rows];
    if (sortCol < 0)
        return rows;
    const col = result.columns[sortCol];
    return rows.sort((a, b) => {
        const av = String(a[col] ?? '');
        const bv = String(b[col] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
}
function exportCsv(result) {
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
function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function csvEsc(v) {
    return v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"`
        : v;
}
vscode.postMessage({ type: 'ready' });

})();

/******/ })()
;
//# sourceMappingURL=webview-resultsPanel.js.map