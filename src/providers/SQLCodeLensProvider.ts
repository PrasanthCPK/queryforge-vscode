import * as vscode from 'vscode';

interface StatementRange {
  text: string;
  range: vscode.Range;
}

function parseStatements(document: vscode.TextDocument): StatementRange[] {
  const text = document.getText();
  const statements: StatementRange[] = [];
  let start = 0;

  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === ';') {
      const chunk = text.slice(start, i).trim();
      if (chunk.length > 0) {
        const rawStart = text.indexOf(chunk, start);
        const startPos = document.positionAt(rawStart);
        const endPos = document.positionAt(i);
        statements.push({ text: chunk, range: new vscode.Range(startPos, endPos) });
      }
      start = i + 1;
    }
  }
  return statements;
}

export class SQLCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    const lenses: vscode.CodeLens[] = [];
    for (const stmt of parseStatements(document)) {
      const range = new vscode.Range(stmt.range.start, stmt.range.start);
      lenses.push(
        new vscode.CodeLens(range, {
          title: '▶ Run',
          command: 'queryforge.runQuery',
          arguments: [stmt.text],
        }),
        new vscode.CodeLens(range, {
          title: '⚡ Explain',
          command: 'queryforge.explainQuery',
          arguments: [stmt.text],
        }),
      );
    }
    return lenses;
  }
}
