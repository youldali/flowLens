---
name: flowlens-tooling-env
description: FlowLens local tooling environment notes. Use when running package manager, Node, pnpm, Corepack, or project verification commands in the FlowLens repository, especially if pnpm is missing from PATH or FNM_DIR points at a Snap/VS Code fnm directory.
metadata:
  short-description: FlowLens Node/pnpm environment
---

# FlowLens Tooling Environment

When `pnpm` is missing from PATH, do not assume it is unavailable. The reliable fnm root for this workspace is:

```sh
/home/yannis/.local/share/fnm
```

The VS Code/Codex process may expose a misleading `FNM_DIR` under `/home/yannis/snap/code/...`; ignore that value for FlowLens tooling.

For this repository, prefer the Node version declared in `package.json` engines. At the time this skill was written, the matching direct binaries are:

```sh
/home/yannis/.local/share/fnm/node-versions/v26.1.0/installation/bin/node
/home/yannis/.local/share/fnm/node-versions/v26.1.0/installation/bin/corepack
/home/yannis/.local/share/fnm/node-versions/v26.1.0/installation/bin/pnpm
```

Use the direct `pnpm` binary when normal PATH lookup fails:

```sh
/home/yannis/.local/share/fnm/node-versions/v26.1.0/installation/bin/pnpm --version
```

Avoid relying on `fnm env` inside the sandbox if it fails to create multishell symlinks under `/run/user/1000`.
