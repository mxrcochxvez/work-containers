---
name: work-containers
description: Start, inspect, and stop an isolated preview environment for the current Git worktree.
---

# Work Containers

Use this skill when the user asks to run, preview, inspect, test, or debug changes in a Git worktree.

## Workflow

1. Run `work-containers plan --json` and inspect the resolved services and URLs.
2. If no manifest exists, run `work-containers init --json`, review the generated file, and complete the service mappings before starting containers.
3. Run `work-containers up --json`.
4. Use `work-containers status --json`, `work-containers logs <service> --no-follow`, and `work-containers open <service> --json` as needed.
5. Run `work-containers down --json` when the environment is no longer needed.

Never silently add real production secrets. Never run destructive lifecycle commands without showing the user what was detected.
