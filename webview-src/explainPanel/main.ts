export {};

declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(s: unknown): void;
};

interface ExplainNode {
  id: string;
  operation: string;
  details: Record<string, unknown>;
  children: ExplainNode[];
}

const vscode = acquireVsCodeApi();

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
  #title {
    font-weight: 600;
    font-size: 13px;
    padding: 0 8px;
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
  }
  #clearBtn:hover { color: var(--error); background: var(--hover-bg); }
  #content { flex: 1; overflow: auto; }
  .placeholder {
    padding: 32px;
    color: var(--desc);
    font-style: italic;
    text-align: center;
  }
  .error-msg { padding: 24px; color: var(--error); }
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
  <span id="title">Explain Plan</span>
  <button id="clearBtn" title="Clear">✕ Clear</button>
</div>
<div id="content">
  <p class="placeholder">Run Explain to see the execution plan.</p>
</div>
`;

const contentEl = document.getElementById('content') as HTMLDivElement;
const clearBtn = document.getElementById('clearBtn') as HTMLButtonElement;

clearBtn.addEventListener('click', () => {
  contentEl.innerHTML = '<p class="placeholder">Run Explain to see the execution plan.</p>';
});

window.addEventListener('message', (e: MessageEvent) => {
  const msg = e.data as { type: string; data?: ExplainNode; message?: string };
  switch (msg.type) {
    case 'explainResult':
      renderExplain(msg.data as ExplainNode);
      break;
    case 'error':
      contentEl.innerHTML = `<p class="error-msg">Error: ${esc(msg.message ?? 'Unknown error')}</p>`;
      break;
  }
});

function renderExplain(node: ExplainNode): void {
  contentEl.innerHTML = `<div class="tree-root">${nodeHtml(node)}</div>`;
  contentEl.querySelectorAll<HTMLElement>('.node-header').forEach(hdr => {
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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

vscode.postMessage({ type: 'ready' });
