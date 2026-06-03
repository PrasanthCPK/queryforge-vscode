# Query Forge

A VS Code extension for executing SQL queries and visualizing execution plans for **MySQL/MariaDB** and **Oracle** databases — directly inside VS Code.

## Features

- **Multi-database support**: MySQL/MariaDB and Oracle (Thin mode — no Oracle Instant Client installation required)
- **Saved Connections**: Named profiles stored securely (passwords in VS Code Secret Storage)
- **Query Console**: A dedicated split panel with a SQL editor, connection picker, Run/Explain/Run Script buttons
- **Run from .sql files**: `▶ Run` and `⚡ Explain` CodeLens links appear above every SQL statement; keyboard shortcuts work too
- **Run SQL Script**: Open and execute any `.sql` file directly from the Query Console toolbar or via the command palette
- **Results Table**: Sortable, scrollable data grid with row count, execution time, and CSV export
- **Server-side pagination**: Only 50 rows are fetched per page — large result sets never load all rows into memory at once
- **Closeable result tabs**: Each result tab in the Query Console can be closed with the × button; tabs can also be pinned to prevent reuse
- **Explain Plan Tree**: Visual collapsible tree of the query execution plan with cost/row estimates; full-table-scan nodes highlighted in amber
- **Clear Results**: The Results panel (used when running from .sql files) includes a "✕ Clear" button to reset the view

## Installation

### Option A — Install as a .vsix package (recommended for regular use)

A pre-built `.vsix` file is included in the repository root (`queryforge-vscode-0.1.0.vsix`).

```bash
# Install directly into VS Code
code --install-extension queryforge-vscode-0.1.0.vsix
```

To build a fresh `.vsix` yourself:

**Prerequisites:** [Node.js 18+](https://nodejs.org) and [Git](https://git-scm.com)

```bash
# 1. Clone the repository
git clone https://github.com/PrasanthCPK/queryforge-vscode.git
cd queryforge-vscode

# 2. Install dependencies
npm install

# 3. Install the VS Code extension packager
npm install -g @vscode/vsce

# 4. Package the extension into a .vsix file
vsce package --no-dependencies

# 5. Install the generated .vsix into VS Code
code --install-extension queryforge-vscode-0.1.0.vsix
```

Restart VS Code after step 5. The **Query Forge** icon will appear in the Activity Bar.

> **Note:** `--no-dependencies` tells `vsce` to skip the marketplace dependency check.
> The runtime dependencies (`mysql2`, `oracledb`) are loaded from `node_modules/`
> which is included in the package.

---

### Option B — Run in Extension Development Host (for development / testing)

No packaging required — VS Code launches a sandboxed instance with the extension loaded.

**Prerequisites:** [Node.js 18+](https://nodejs.org), [Git](https://git-scm.com), and [VS Code](https://code.visualstudio.com)

```bash
# 1. Clone the repository
git clone https://github.com/PrasanthCPK/queryforge-vscode.git
cd queryforge-vscode

# 2. Install dependencies
npm install

# 3. Open the folder in VS Code
code .
```

Then press **F5** (or go to **Run → Start Debugging**). A new VS Code window opens with the extension active.

---

## Requirements

- VS Code 1.85 or later
- Network access to your target database
- **MySQL/MariaDB**: No additional software needed — uses the `mysql2` driver
- **Oracle**: No Oracle Instant Client needed — uses `oracledb` v6 Thin mode (requires Oracle Database 12.1+ or Oracle Autonomous Database)

## Getting Started

1. Click the **Query Forge** icon (database icon) in the Activity Bar on the left
2. Click the **+** button to add a connection — fill in host, port, database/service name, username, and password
3. Right-click a connection → **Connect**
4. Right-click a connection → **Open Query Console**
5. Type a SQL query and press **Ctrl+Enter** (or click **▶ Run**)
6. The results appear in the bottom panel of the Query Console

## Running Queries from .sql Files

Open any `.sql` file — `▶ Run` and `⚡ Explain` CodeLens links appear above each statement. Click them, or use:

| Action | Shortcut |
|--------|----------|
| Run query | `Ctrl+Shift+E` |
| Explain query | `Ctrl+Shift+X` |
| Run in Query Console | `Ctrl+Enter` |

These commands use the active connection (or prompt you to pick one if multiple connections exist).

## Running a SQL Script File

In the Query Console toolbar, click **📂 Run Script** to browse for a `.sql` file. The file's contents are loaded into the editor and executed immediately.

Alternatively, use the command palette:
- **Query Forge: Run SQL Script** — opens a file picker, then runs the selected `.sql` file

## Result Tabs (Query Console)

Each query execution opens a result tab at the bottom of the Query Console:

- **Close tab**: Click the **×** on any tab to remove it
- **Pin tab**: Click **📌** to pin a tab; pinned tabs are never reused by subsequent queries
- Multiple tabs allow you to compare results from different queries side by side

## Pagination

Results are fetched **50 rows at a time** from the database. Clicking **Next ▶** or **◀ Prev** issues a new database query to retrieve the next or previous page — no data is buffered in memory beyond the current page.

> **Note:** Sorting by a column header sorts the currently visible 50 rows only, not the full dataset.

## Commands

| Command | Description |
|---------|-------------|
| `Query Forge: Open Console` | Open the Query Console panel |
| `Query Forge: Add Connection` | Add a new database connection |
| `Query Forge: Run Query` | Execute selected SQL (or full document) |
| `Query Forge: Explain Query` | Show the execution plan for selected SQL |
| `Query Forge: Run SQL Script` | Open a `.sql` file and execute it |
| `Query Forge: Refresh Connections` | Refresh the connections sidebar |

## Screenshots

### Query Console
> A dedicated SQL editor panel with connection picker, Run, Explain, and Run Script buttons. Results appear in closeable, pinnable tabs below.

### Results Table
> Sortable grid showing the current page of query results (50 rows per page) with total row count, execution time, and CSV export.

### Explain Plan Tree
> Visual collapsible tree of the execution plan. Full-table-scan nodes are highlighted in amber.

## Known Limitations / Roadmap

- No SSL/TLS certificate configuration yet
- No query history or saved snippets
- Planned: PostgreSQL support
- Planned: Query parameter binding UI
- Sorting applies only to the current page of results (full-dataset ORDER BY planned)
