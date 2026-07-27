# Agent instructions

This repository builds the `work-containers` CLI.

- Use Node.js 20 or newer.
- Run `npm run check` before committing.
- Keep orchestration logic in the CLI core. Agent integrations and future MCP tools should be thin adapters.
- Do not execute inferred lifecycle commands automatically during `init`; generated configuration must remain reviewable.
- Preserve structured `--json` output for agent consumers.
