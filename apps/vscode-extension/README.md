# FlowLens

FlowLens visualizes TypeScript code flow from inside VS Code.

FlowLens is currently in alpha. The core graph workflow is usable, but analyzer coverage, graph presentation, and extension behavior are still evolving.

## Features

- Generate a graph from the symbol at the active cursor position in a TypeScript or TSX file.
- Render the graph in a VS Code webview beside the current editor.
- Use the editor context menu or the `FlowLens: Generate Graph` command.

## Requirements

- VS Code `1.104.0` or newer.
- A TypeScript or TSX file on disk.
- A `tsconfig.json` at or above the file being analyzed.

## Usage

1. Open a TypeScript or TSX file in a workspace.
2. Place the cursor on the code you want to inspect.
3. Run `FlowLens: Generate Graph` from the Command Palette, or use the editor context menu.

FlowLens opens a graph view beside the editor and reports how many nodes and edges were generated.

## Limitations

- FlowLens currently supports TypeScript and TSX files only.
- Unsaved virtual documents and files outside a `tsconfig.json` project are not supported.
- Graph quality depends on the analyzer's current TypeScript AST coverage.
- Behavior and graph output may change between alpha releases.

## Publishing

This package is prepared for manual Marketplace publishing under publisher `flowlens`.

```sh
pnpm --filter ./apps/vscode-extension package
```

The command builds the extension and writes a `.vsix` file that can be uploaded through the Visual Studio Marketplace publisher portal.

For command-line publishing, authenticate and publish the packaged VSIX:

```sh
pnpm --dir apps/vscode-extension exec vsce login flowlens
pnpm --dir apps/vscode-extension exec vsce publish --packagePath flowlens-0.1.0.vsix
```
