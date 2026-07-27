import path from "node:path";
import { allocatePorts } from "./ports.js";
import { renderProjectName } from "./context.js";

function dependencyClosure(manifest, requested) {
  if (!requested?.length) return Object.keys(manifest.services);
  const selected = new Set();
  const visit = (name) => {
    const service = manifest.services[name];
    if (!service) throw new Error(`Unknown service: ${name}`);
    if (selected.has(name)) return;
    selected.add(name);
    for (const dependency of service.dependencies) visit(dependency);
  };
  for (const name of requested) visit(name);
  return [...selected];
}

export async function createPlan(manifest, context, manifestDirectory, requested, portAllocator = allocatePorts) {
  const names = dependencyClosure(manifest, requested);
  const publishable = names.filter((name) => manifest.services[name]?.containerPort !== undefined);
  const ports = await portAllocator(publishable, manifest.worktrees.portRange, manifest.worktrees.bindAddress, context.id);

  const services = names.sort().map((name) => {
    const service = manifest.services[name];
    const hostPort = ports[name];
    const pathPart = service.path.startsWith("/") ? service.path : `/${service.path}`;
    const url = hostPort && service.protocol !== "tcp"
      ? `${service.protocol}://${manifest.worktrees.bindAddress}:${hostPort}${pathPart}`
      : undefined;
    return {
      name,
      composeService: service.composeService,
      ...(service.containerPort === undefined ? {} : { containerPort: service.containerPort }),
      ...(hostPort === undefined ? {} : { hostPort }),
      protocol: service.protocol,
      ...(url ? { url } : {}),
      ...(service.healthcheck ? { healthcheck: service.healthcheck } : {}),
    };
  });

  return {
    id: context.id,
    projectName: renderProjectName(manifest.worktrees.projectName, {
      project: manifest.project.name,
      worktree: context.worktreeName,
      branch: context.branch,
      id: context.id,
    }),
    worktreePath: context.worktreePath,
    composeFiles: manifest.runtime.composeFiles.map((file) => path.resolve(manifestDirectory, file)),
    envFiles: manifest.runtime.envFiles.map((file) => path.resolve(manifestDirectory, file)),
    services,
  };
}
