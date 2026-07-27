function normalized(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function parseComposePs(stdout) {
  const source = stdout.trim();
  if (!source) return [];
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return source.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  }
}

function rowService(row) {
  return row.Service ?? row.service ?? row.Name ?? row.name ?? "unknown";
}

function rowState(row) {
  return normalized(row.State ?? row.state ?? row.Status ?? row.status) || "unknown";
}

function rowHealth(row) {
  const health = normalized(row.Health ?? row.health);
  if (health) return health;
  const status = normalized(row.Status ?? row.status);
  const match = status.match(/\((healthy|unhealthy|starting)\)/);
  return match?.[1] ?? "not-configured";
}

function healthcheckUrl(service) {
  if (!service.healthcheck || !service.url || service.protocol === "tcp") return undefined;
  try {
    return new URL(service.healthcheck, service.url).toString();
  } catch {
    return undefined;
  }
}

export async function probeServiceHealth(service, options = {}) {
  const url = healthcheckUrl(service);
  if (!url) return undefined;
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(options.timeoutMs ?? 3000),
      redirect: "manual",
    });
    return {
      status: response.ok ? "healthy" : "unhealthy",
      url,
      statusCode: response.status,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      status: "unhealthy",
      url,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function createHealthReport(plan, rows, probes = {}) {
  const configured = new Map(plan.services.map((service) => [service.composeService, service]));
  const services = rows.map((row) => {
    const composeService = rowService(row);
    const configuredService = configured.get(composeService);
    const state = rowState(row);
    const composeHealth = rowHealth(row);
    const probe = configuredService ? probes[configuredService.name] : undefined;
    let health = "unknown";
    if (composeHealth === "unhealthy" || probe?.status === "unhealthy") health = "unhealthy";
    else if (composeHealth === "starting") health = "starting";
    else if (composeHealth === "healthy" || probe?.status === "healthy") health = "healthy";

    return {
      name: configuredService?.name ?? composeService,
      composeService,
      state,
      health,
      composeHealth,
      ...(configuredService?.url ? { url: configuredService.url } : {}),
      ...(probe ? { probe } : {}),
    };
  });

  let status = "stopped";
  if (services.length > 0) {
    const allRunning = services.every((service) => service.state === "running");
    if (!allRunning) status = "degraded";
    else if (services.some((service) => service.health === "unhealthy")) status = "unhealthy";
    else if (services.some((service) => service.health === "starting")) status = "starting";
    else if (services.some((service) => service.health === "healthy")) status = "healthy";
    else status = "running";
  }

  return { id: plan.id, status, services };
}

export async function buildHealthReport(plan, rows, options = {}) {
  const entries = await Promise.all(plan.services.map(async (service) => [service.name, await probeServiceHealth(service, options)]));
  const probes = Object.fromEntries(entries.filter(([, probe]) => probe));
  return createHealthReport(plan, rows, probes);
}

export function humanHealthReport(report) {
  const lines = [`Environment: ${report.id}`, `Status: ${report.status}`, "Services:"];
  if (report.services.length === 0) lines.push("  - none running");
  for (const service of report.services) {
    const probe = service.probe ? `, HTTP ${service.probe.statusCode ?? "error"} in ${service.probe.latencyMs}ms` : "";
    lines.push(`  - ${service.name} (${service.composeService}): ${service.state}, health=${service.health}${probe}`);
  }
  return lines.join("\n");
}
