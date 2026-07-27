import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const MANIFEST_NAME = "work-containers.json";

export async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function findManifest(startDirectory) {
  let current = path.resolve(startDirectory);
  while (true) {
    const candidate = path.join(current, MANIFEST_NAME);
    if (await fileExists(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`Invalid work-containers manifest: ${message}`);
}

function stringArray(value, field) {
  const result = value ?? [];
  assert(Array.isArray(result) && result.every((item) => typeof item === "string"), `${field} must be an array of strings.`);
  return result;
}

function discoveryMetadata(value, field) {
  if (value === undefined) return undefined;
  assert(value && typeof value === "object" && !Array.isArray(value), `${field} must be an object.`);
  assert(typeof value.source === "string" && value.source.length > 0, `${field}.source is required.`);
  assert(typeof value.confidence === "number" && value.confidence >= 0 && value.confidence <= 1, `${field}.confidence must be between 0 and 1.`);
  return {
    source: value.source,
    confidence: value.confidence,
    reasons: stringArray(value.reasons, `${field}.reasons`),
  };
}

export function validateManifest(raw) {
  assert(raw && typeof raw === "object" && !Array.isArray(raw), "root must be an object.");
  assert(raw.version === 1, "version must be 1.");
  assert(typeof raw.project?.name === "string" && raw.project.name.length > 0, "project.name is required.");
  assert(raw.runtime?.orchestrator === "compose", "runtime.orchestrator must be compose.");
  assert(Array.isArray(raw.runtime?.composeFiles) && raw.runtime.composeFiles.length > 0, "runtime.composeFiles must contain at least one file.");

  const services = {};
  for (const [name, service] of Object.entries(raw.services ?? {})) {
    assert(service && typeof service === "object", `services.${name} must be an object.`);
    assert(typeof service.composeService === "string" && service.composeService.length > 0, `services.${name}.composeService is required.`);
    if (service.containerPort !== undefined) {
      assert(Number.isInteger(service.containerPort) && service.containerPort >= 1 && service.containerPort <= 65535, `services.${name}.containerPort must be a valid port.`);
    }
    const protocol = service.protocol ?? "http";
    assert(["http", "https", "tcp"].includes(protocol), `services.${name}.protocol must be http, https, or tcp.`);
    assert(service.path === undefined || typeof service.path === "string", `services.${name}.path must be a string.`);
    assert(service.healthcheck === undefined || typeof service.healthcheck === "string", `services.${name}.healthcheck must be a string.`);
    assert(service.openByDefault === undefined || typeof service.openByDefault === "boolean", `services.${name}.openByDefault must be a boolean.`);
    const discovery = discoveryMetadata(service.discovery, `services.${name}.discovery`);
    services[name] = {
      composeService: service.composeService,
      ...(service.containerPort === undefined ? {} : { containerPort: service.containerPort }),
      protocol,
      path: service.path ?? "/",
      ...(service.healthcheck ? { healthcheck: service.healthcheck } : {}),
      openByDefault: service.openByDefault ?? false,
      dependencies: stringArray(service.dependencies, `services.${name}.dependencies`),
      ...(discovery ? { discovery } : {}),
    };
  }

  for (const [name, service] of Object.entries(services)) {
    for (const dependency of service.dependencies) {
      assert(dependency in services, `services.${name} references unknown dependency ${dependency}.`);
    }
  }

  const portRange = raw.worktrees?.portRange ?? [41000, 49000];
  assert(Array.isArray(portRange) && portRange.length === 2 && portRange.every(Number.isInteger), "worktrees.portRange must contain two integers.");
  assert(portRange[0] >= 1024 && portRange[1] <= 65535 && portRange[0] <= portRange[1], "worktrees.portRange is invalid.");

  return {
    version: 1,
    project: { name: raw.project.name },
    runtime: {
      orchestrator: "compose",
      composeFiles: stringArray(raw.runtime.composeFiles, "runtime.composeFiles"),
      envFiles: stringArray(raw.runtime.envFiles, "runtime.envFiles"),
    },
    services,
    worktrees: {
      projectName: raw.worktrees?.projectName ?? "${project}-${worktree}",
      portRange,
      bindAddress: raw.worktrees?.bindAddress ?? "127.0.0.1",
    },
    lifecycle: {
      beforeUp: stringArray(raw.lifecycle?.beforeUp, "lifecycle.beforeUp"),
      afterUp: stringArray(raw.lifecycle?.afterUp, "lifecycle.afterUp"),
      beforeDown: stringArray(raw.lifecycle?.beforeDown, "lifecycle.beforeDown"),
    },
  };
}

export async function loadManifest(manifestPath) {
  const source = await readFile(manifestPath, "utf8");
  let raw;
  try {
    raw = JSON.parse(source);
  } catch (error) {
    throw new Error(`Invalid JSON in ${manifestPath}: ${error.message}`);
  }
  return validateManifest(raw);
}

export async function writeManifest(manifestPath, manifest) {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}
