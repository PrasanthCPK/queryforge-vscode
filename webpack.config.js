'use strict';

const path = require('path');

/** @type {import('webpack').Configuration[]} */
module.exports = [
  // Extension host bundle (Node.js)
  {
    target: 'node',
    mode: 'none',
    entry: './src/extension.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2',
    },
    externals: {
      vscode: 'commonjs vscode',
      mysql2: 'commonjs mysql2',
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [{ loader: 'ts-loader', options: { configFile: 'tsconfig.json' } }],
        },
      ],
    },
    devtool: 'nosources-source-map',
    infrastructureLogging: { level: 'log' },
  },
  // Query Console webview bundle (browser)
  {
    target: 'web',
    mode: 'none',
    entry: './webview-src/queryConsole/main.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'webview-queryConsole.js',
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [{ loader: 'ts-loader', options: { configFile: 'tsconfig.json' } }],
        },
      ],
    },
    devtool: 'nosources-source-map',
  },
  // Results Panel webview bundle (browser)
  {
    target: 'web',
    mode: 'none',
    entry: './webview-src/resultsPanel/main.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'webview-resultsPanel.js',
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [{ loader: 'ts-loader', options: { configFile: 'tsconfig.json' } }],
        },
      ],
    },
    devtool: 'nosources-source-map',
  },
  // Explain Panel webview bundle (browser)
  {
    target: 'web',
    mode: 'none',
    entry: './webview-src/explainPanel/main.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'webview-explainPanel.js',
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          use: [{ loader: 'ts-loader', options: { configFile: 'tsconfig.json' } }],
        },
      ],
    },
    devtool: 'nosources-source-map',
  },
];
