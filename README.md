# work-containers

Give every Git worktree an isolated, dependency-aware Docker Compose preview environment that humans and coding agents can start, inspect, and destroy.

> Early MVP: the manifest and CLI contract are usable now. Automatic Compose-service discovery, health polling, garbage collection, and MCP adapters are planned next.

## Why

Git worktrees are ideal for parallel feature work and coding agents, but complicated applications often need databases, queues, APIs, workers, and frontend servers before a change can be previewed. Running several worktrees at once usually causes container-name, network, volume, and host-port conflicts.

`work-containers` gives each worktree:

- a stable environment ID
- an isolated Docker Compose project name
- dynamically allocated preview ports
- dependency-aware service selection
- structured JSON output for coding agents
- lifecycle commands and saved environment state

## Requirements

- Node.js 20+ (no runtime dependencies)
- Git
- Docker with Docker Compose v2

The generated Compose override uses the Compose `!override` YAML tag so worktree-specific published ports replace the ports in the base service. Use a current Docker Compose release.

## Install for development

```bash
npm link
```

## Quick start

From a project repository or any of its worktrees:

```bash
work-containers init
```

Review the generated `work-containers.json` and map its logical services to Compose services:

```json
{
  "version": 1,
  "project": { "name": "my-app" },
  "runtime": {
    "orchestrator": "compose",
    "composeFiles": ["compose.yaml"]
  },
  "services": {
    "database": { "composeService": "postgres", "protocol": "tcp" },
    "api": {
      "composeService": "api",
      "containerPort": 4000,
      "dependencies": ["database"]
    },
    "web": {
      "composeService": "web",
      "containerPort": 3000,
      "openByDefault": true,
      "dependencies": ["api"]
    }
  }
}
```

Then run:

```bash
work-containers plan
work-containers up
work-containers open
work-containers logs web
work-containers down
```

To start only a service and its declared dependencies:

```bash
work-containers up --services web
```

## Agent usage

Every primary command supports structured output:

```bash
work-containers plan --json
work-containers up --json
work-containers open web --json
work-containers down --json
```

A Claude skill template is included at [`integrations/claude/work-containers/SKILL.md`](integrations/claude/work-containers/SKILL.md). The CLI is intentionally the source of truth so Codex, Claude Code, OpenCode, and a future MCP server can all use the same behavior.

## Commands

| Command | Purpose |
| --- | --- |
| `init` | Detect project files and generate a reviewable manifest. |
| `plan` | Resolve the worktree ID, service dependency closure, Compose project, ports, and URLs. |
| `up` | Create an override file and start the selected Compose services. |
| `status` | Show Compose service status. |
| `logs [service]` | Stream all logs or one logical service's logs. |
| `open [service]` | Print the default or selected preview URL. |
| `down` | Stop the environment and optionally remove volumes. |

## Isolation model

Docker Compose resources are isolated by `--project-name`. The default template is `${project}-${worktree}`. Preview ports are selected deterministically from the configured range and checked for availability before startup.

Persistent named volumes are isolated when their Compose names are project-scoped. Volumes with explicit global `name:` values and bind mounts remain shared; this is intentional Compose behavior and should be reviewed for each project.

## Safety model

`init` detects evidence but does not invent or execute database migrations, seed scripts, secret setup, or external integrations. Lifecycle commands must be explicitly added to the manifest. This prevents an agent from silently running destructive or production-connected commands.

## Development

```bash
npm run check
```

## Roadmap

- Parse `docker compose config --format json` during `init`
- Propose service ports and dependencies with confidence scores
- Health-check polling and compact failure diagnostics
- Shared versus per-worktree service policies
- Global environment listing and garbage collection
- MCP server exposing the CLI as structured tools
- Codex and OpenCode integration templates

## License

MIT
