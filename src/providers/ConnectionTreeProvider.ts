import * as vscode from 'vscode';
import type { Connection, DbType } from '../types';
import type { ConnectionManager } from '../database/ConnectionManager';

export class ConnectionItem extends vscode.TreeItem {
  constructor(
    public readonly connection: Connection,
    public readonly isConnected: boolean,
  ) {
    super(connection.name, vscode.TreeItemCollapsibleState.None);
    this.description = `${connection.host}:${connection.port}/${connection.database}`;
    this.tooltip = `${connection.dbType.toUpperCase()} · ${connection.username}@${connection.host}`;
    this.contextValue = isConnected ? 'connectionConnected' : 'connectionDisconnected';
    this.iconPath = new vscode.ThemeIcon(
      isConnected ? 'database' : 'circle-outline',
      isConnected
        ? new vscode.ThemeColor('charts.green')
        : new vscode.ThemeColor('disabledForeground'),
    );
  }
}

class GroupItem extends vscode.TreeItem {
  constructor(public readonly dbType: DbType) {
    super(
      dbType === 'mysql' ? 'MySQL / MariaDB' : 'Oracle',
      vscode.TreeItemCollapsibleState.Expanded,
    );
    this.contextValue = 'group';
    this.iconPath = new vscode.ThemeIcon('server');
  }
}

type TreeNode = GroupItem | ConnectionItem;

export class ConnectionTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly manager: ConnectionManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      const types = [...new Set(this.manager.getAll().map(c => c.dbType))] as DbType[];
      return types.map(t => new GroupItem(t));
    }
    if (element instanceof GroupItem) {
      return this.manager
        .getAll()
        .filter(c => c.dbType === element.dbType)
        .map(c => new ConnectionItem(c, this.manager.isConnected(c.id)));
    }
    return [];
  }
}
