#!/usr/bin/env node
import path from "node:path";
import { detectProject } from "./core/init.js";
import { fileExists, findManifest, loadManifest, MANIFEST_NAME, writeManifest } from "./core/manifest.js";
import { resolveWorktreeContext } from "./core/context.js";
import { createPlan } from "./core/plan.js";
import { runLifecycleCommands } from "./core/lifecycle.js";
import { runCompose, writeComposeOverride } from "./core/compose.js";
import { loadState, removeState, saveState } from "./core/state.js";
import { runChecked } from "./core/process.js";

const VERSION = "0.1.0";
const HELP = `work-containers ${VERSION}

Usage: work-containers <command> [options]

Commands:
  init                 Generate a reviewable project manifest
  plan                 Resolve the worktree, services, ports, and URLs
  up                   Start the current worktree environment
  status               Show Docker Compose status
  logs [service]       Show or follow environment logs
  open [service]       Print a preview URL
  down                 Stop the current worktree environment

Common options:
  -m, --manifest PATH  Use a specific manifest
  -s, --services LIST  Comma-separated logical services
      --json           Print machine-readable output
      --help           Show help
      --version        Show version
`;

function hasFlag(args, name) {
  return args.includes(name);
}

function optionValue(args, ...names) {
  for (const name of names) {
    const index = args.indexOf(name);
    if (index >= 0) {
      const value = args[index + 1];
      if (!value || value.startsWith("-")) throw new Error(`${name} requires a value.`);
      return value;
    }
  }
  return undefined;
}

function positionalArgs(args) {
  const optionsWithValues = new Set(["-m", "--manifest", "-s", "--services", "--tail"]);
  const result = [];
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (optionsWithValues.has(value)) {
      index += 1;
      continue;
    }
    if (!value.startsWith("-")) result.push(value);
  }
  return result;
}

function parseServices(args) {
  return optionValue(args, "-s", "--services")?.split(",").map((item) => item.trim()).filter(Boolean);
}

function print(value, json = false) {
  if (json || typeof value !== "string") console.log(JSON.stringify(value, null, 2));
  else console.log(value);
}

async function resolveProject(args) {
  const cwd = process.cwd();
  const explicitManifest = optionValue(args, "-m", "--manifest");
  const manifestPath = explicitManifest ? path.resolve(cwd, explicitManifest) : await findManifest(cwd);
  if (!manifestPath) throw new Error(`No ${MANIFEST_NAME} found. Run work-containers init first.`);
  const manifest = await loadManifest(manifestPath);
  const context = await resolveWorktreeContext(cwd);
  const plan = await createPlan(manifest, context, path.dirname(manifestPath), parseServices(args));
  return { manifestPath, manifest, plan };
}

function humanPlan(plan) {
  const lines = [
    `Environment: ${plan.id}`,
    `Compose project: ${plan.projectName}`,
    `Worktree: ${plan.worktreePath}`,
    "Services:",
  ];
  if (plan.services.length === 0) lines.push("  - all Compose services (no logical services configured)");
  for (const service of plan.services) {
    lines.push(`  - ${service.name} (${service.composeService})${service.url ? ` -> ${service.url}` : ""}`);
  }
  return lines.join("\n");
}

async function commandInit(args) {
  const cwd = process.cwd();
  const manifestPath = path.join(cwd, MANIFEST_NAME);
  if ((await fileExists(manifestPath)) && !hasFlag(args, "--force")) {
    throw new Error(`${manifestPath} already exists. Use --force to replace it.`);
  }
  const detection = await detectProject(cwd);
  await writeManifest(manifestPath, detection.manifest);
  const result = { manifestPath, detected: detection.detected, warnings: detection.warnings };
  if (hasFlag(args, "--json")) print(result, true);
  else {
    console.log(`Created ${manifestPath}`);
    for (const item of detection.detected) console.log(`  detected: ${item}`);
    for (const warning of detection.warnings) console.log(`  review: ${warning}`);
  }
}

async function commandPlan(args) {
  const { plan } = await resolveProject(args);
  print(hasFlag(args, "--json") ? plan : humanPlan(plan), hasFlag(args, "--json"));
}

async function commandUp(args) {
  const json = hasFlag(args, "--json");
  const { manifestPath, manifest, plan } = await resolveProject(args);
  await runChecked("docker", ["compose", "version"]);
  await runLifecycleCommands(manifest.lifecycle.beforeUp, plan.worktreePath);
  const overrideFile = await writeComposeOverride(plan);
  const composeServices = [...new Set(plan.services.map((service) => service.composeService))];
  await runCompose(plan, overrideFile, ["up", "--detach", ...(hasFlag(args, "--build") ? ["--build"] : []), ...composeServices], { inherit: !json });
  await runLifecycleCommands(manifest.lifecycle.afterUp, plan.worktreePath);
  await saveState({ ...plan, overrideFile, manifestPath, updatedAt: new Date().toISOString() });
  print(json ? { status: "started", ...plan } : humanPlan(plan), json);
}

async function commandStatus(args) {
  const json = hasFlag(args, "--json");
  const { plan } = await resolveProject(args);
  const state = await loadState(plan.id);
  if (!state) throw new Error("No environment state found. Run work-containers up first.");
  const result = await runCompose(state, state.overrideFile, json ? ["ps", "--format", "json"] : ["ps"], { inherit: !json });
  if (json) {
    const rows = result.stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line));
    print({ id: plan.id, services: rows }, true);
  }
}

async function commandLogs(args) {
  const { manifest, plan } = await resolveProject(args);
  const state = await loadState(plan.id);
  if (!state) throw new Error("No environment state found. Run work-containers up first.");
  const [service] = positionalArgs(args);
  const composeService = service ? manifest.services[service]?.composeService : undefined;
  if (service && !composeService) throw new Error(`Unknown service: ${service}`);
  const tail = optionValue(args, "--tail") ?? "200";
  await runCompose(state, state.overrideFile, [
    "logs",
    ...(!hasFlag(args, "--no-follow") ? ["--follow"] : []),
    "--tail",
    tail,
    ...(composeService ? [composeService] : []),
  ], { inherit: true });
}

async function commandDown(args) {
  const json = hasFlag(args, "--json");
  const { manifest, plan } = await resolveProject(args);
  const state = await loadState(plan.id);
  if (!state) {
    print(json ? { status: "not-running", id: plan.id } : `No saved environment for ${plan.id}.`, json);
    return;
  }
  await runLifecycleCommands(manifest.lifecycle.beforeDown, plan.worktreePath);
  await runCompose(state, state.overrideFile, ["down", "--remove-orphans", ...(hasFlag(args, "--volumes") ? ["--volumes"] : [])], { inherit: !json });
  await removeState(plan.id);
  print(json ? { status: "stopped", id: plan.id } : `Stopped ${plan.id}.`, json);
}

async function commandOpen(args) {
  const json = hasFlag(args, "--json");
  const { manifest, plan } = await resolveProject(args);
  const [service] = positionalArgs(args);
  const selected = service
    ? plan.services.find((item) => item.name === service)
    : plan.services.find((item) => manifest.services[item.name]?.openByDefault && item.url) ?? plan.services.find((item) => item.url);
  if (!selected?.url) throw new Error(service ? `Service ${service} has no preview URL.` : "No preview service is configured.");
  print(json ? { service: selected.name, url: selected.url } : selected.url, json);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === "--help" || command === "-h") return console.log(HELP);
  if (command === "--version" || command === "-V") return console.log(VERSION);
  if (hasFlag(args, "--help")) return console.log(HELP);

  const commands = {
    init: commandInit,
    plan: commandPlan,
    up: commandUp,
    status: commandStatus,
    logs: commandLogs,
    open: commandOpen,
    down: commandDown,
  };
  const handler = commands[command];
  if (!handler) throw new Error(`Unknown command: ${command}\n\n${HELP}`);
  await handler(args);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
