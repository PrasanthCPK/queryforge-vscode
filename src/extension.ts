import * as vscode from 'vscode';
import { ConnectionManager } from './database/ConnectionManager';
import { ConnectionTreeProvider } from './providers/ConnectionTreeProvider';
import { SQLCodeLensProvider } from './providers/SQLCodeLensProvider';
import { registerCommands } from './commands/index';

export function activate(context: vscode.ExtensionContext): void {
  const manager = new ConnectionManager(context);
  const treeProvider = new ConnectionTreeProvider(manager);

  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('queryforgeConnections', treeProvider),
    vscode.languages.registerCodeLensProvider({ language: 'sql' }, new SQLCodeLensProvider()),
  );

  registerCommands(context, manager, treeProvider);

  context.subscriptions.push({
    dispose: () => void manager.disconnectAll(),
  });
}

export function deactivate(): void {
  // Cleanup handled via subscriptions in activate()
}
