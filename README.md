# work-containers

Give every Git worktree an isolated, dependency-aware Docker Compose preview environment that humans and coding agents can start, inspect, and destroy.

**Project site:** [mxrcochxvez.github.io/work-containers](https://mxrcochxvez.github.io/work-containers/)

> Early MVP: the CLI and manifest contract are usable now. Compose discovery and health-aware status are included in the current development branch; shared-service policies, garbage collection, and MCP adapters remain on the roadmap.

## Why

Git worktrees are ideal for parallel feature work and coding agents, but complicated applications often need databases, queues, APIs, workers, and frontend servers before a change can be previewed. Running several worktrees at once usually causes container-name, network, volume, and host-port conflicts.

`work-containers` gives each worktree:

- a stable environment ID
- an isolated Docker Compose project name
- dynamically allocated preview ports
- dependency-aware service selection
- automatic Compose service discovery during `init`
- health-aware status summaries
- structured JSON output for coding agents
- lifecycle commands and saved environment state

## Requirements

- Node.js 20+ with no runtime dependencies
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

When Docker Compose is available, `init` inspects the resolved Compose configuration and proposes logical services, ports, dependencies, preview defaults, and confidence metadata. Review the generated `work-containers.json` before starting anything.

```json
{
  "version": 1,
  "project": { "name": "my-app" },
  "runtime": {
    "orchestrator": "compose",
    "composeFiles": ["compose.yaml"]
  },
  "services": {
    "database": {
      "composeService": "postgres",
      "containerPort": 5432,
      "protocol": "tcp"
    },
    "api": {
      "composeService": "api",
      "containerPort": 4000,
      "dependencies": ["database"]
    },
    "web": {
      "composeService": "web",
      "containerPort": 3000,
      "openByDefault": true,
      "dependencies": ["api"],
      "discovery": {
        "source": "docker-compose-config",
        "confidence": 0.94,
        "reasons": [
          "service declared by Docker Compose",
          "container port 3000 detected",
          "dependencies detected: api"
        ]
      }
    }
  }
}
```

Then run:

```bash
work-containers plan
work-containers up
work-containers status
work-containers open
work-containers logs web
work-containers down
```

To start only one service and its declared dependency closure:

```bash
work-containers up --services web
```

## Agent usage

Primary commands support structured output:

```bash
work-containers plan --json
work-containers up --json
work-containers status --json
work-containers open web --json
work-containers down --json
```

A Claude skill template is included at [`integrations/claude/work-containers/SKILL.md`](integrations/claude/work-containers/SKILL.md). The CLI is intentionally the source of truth so Codex, Claude Code, OpenCode, and a future MCP server can all use the same behavior.

## Commands

| Command | Purpose |
| --- | --- |
| `init` | Detect project files, inspect Compose configuration, and generate a reviewable manifest. |
| `plan` | Resolve the worktree ID, service dependency closure, Compose project, ports, and URLs. |
| `up` | Create an override file and start the selected Compose services. |
| `status` | Summarize Compose container and configured HTTP health. |
| `logs [service]` | Stream all logs or one logical service's logs. |
| `open [service]` | Print the default or selected preview URL. |
| `down` | Stop the environment and optionally remove volumes. |

## Isolation model

Docker Compose resources are isolated by `--project-name`. The default template is `${project}-${worktree}`. Preview ports are selected deterministically from the configured range and checked for availability before startup.

Persistent named volumes are isolated when their Compose names are project-scoped. Volumes with explicit global `name:` values and bind mounts remain shared; this is intentional Compose behavior and should be reviewed for each project.

## Discovery model

`work-containers init` runs the read-only equivalent of:

```bash
docker compose config --format json
```

It uses the resolved configuration to propose:

- logical services matching Compose service names
- exposed or published container ports
- `depends_on` relationships
- likely HTTP preview services
- infrastructure protocols such as TCP for databases and queues
- confidence scores and reasons for each inference

Discovery failures are warnings rather than fatal errors, so a manifest can still be generated and edited manually.

## Safety model

`init` detects evidence but does not invent or execute database migrations, seed scripts, secret setup, or external integrations. Lifecycle commands must be explicitly added to the manifest. This prevents an agent from silently running destructive or production-connected commands.

Configured HTTP health checks are probed by `status`; arbitrary commands are not inferred or executed.

## Project site

The dependency-free site in [`docs/`](docs/) explains the thesis, architecture, and installation flow and includes an interactive simulation of isolated worktree environments. It is deployed through [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

## Development

```bash
npm run check
```

## Roadmap

- Wait-for-health support during `up` with compact failure diagnostics
- Shared versus per-worktree service policies
- Global environment listing and garbage collection
- MCP server exposing the CLI as structured tools
- Codex and OpenCode integration templates
- Remote preview providers and CI environments

## License

MIT
