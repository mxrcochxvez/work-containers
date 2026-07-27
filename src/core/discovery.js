import { run } from "./process.js";

const HTTP_PORTS = new Set([80, 443, 3000, 3001, 4000, 4173, 4200, 5000, 5173, 8000, 8080, 8081, 8888]);
const INFRA_PATTERN = /(postgres|mysql|mariadb|mongo|redis|valkey|rabbit|kafka|zookeeper|elastic|opensearch|memcached|nats|database|(^|[-_])db($|[-_])|cache|queue|broker)/i;
const PREVIEW_PATTERN = /(web|frontend|front-end|client|ui|app|site|dashboard)/i;

function numericPort(value) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535 ? parsed : undefined;
}

function servicePorts(service) {
  const result = [];
  for (const port of service.ports ?? []) {
    const target = numericPort(typeof port === "object" ? port.target : String(port).split(":").at(-1)?.split("/")[0]);
    if (target && !result.includes(target)) result.push(target);
  }
  for (const port of Object.keys(service.expose ?? {})) {
    const target = numericPort(port.split("/")[0]);
    if (target && !result.includes(target)) result.push(target);
  }
  return result;
}

function dependencyNames(dependsOn) {
  if (Array.isArray(dependsOn)) return dependsOn;
  if (dependsOn && typeof dependsOn === "object") return Object.keys(dependsOn);
  return [];
}

function isInfrastructure(name, service) {
  return INFRA_PATTERN.test(`${name} ${service.image ?? ""}`);
}

function pickPort(ports, infrastructure) {
  if (ports.length === 0) return undefined;
  if (!infrastructure) return ports.find((port) => HTTP_PORTS.has(port)) ?? ports[0];
  return ports[0];
}

export function discoverServicesFromComposeConfig(config) {
  const composeServices = config?.services ?? {};
  const services = {};
  const details = [];

  for (const [name, service] of Object.entries(composeServices)) {
    const infrastructure = isInfrastructure(name, service);
    const ports = servicePorts(service);
    const containerPort = pickPort(ports, infrastructure);
    const protocol = infrastructure ? "tcp" : containerPort === 443 ? "https" : containerPort ? "http" : "tcp";
    const dependencies = dependencyNames(service.depends_on).filter((dependency) => dependency in composeServices);
    const reasons = ["service declared by Docker Compose"];
    if (containerPort) reasons.push(`container port ${containerPort} detected`);
    if (dependencies.length > 0) reasons.push(`dependencies detected: ${dependencies.join(", ")}`);
    if (service.healthcheck) reasons.push("Compose healthcheck detected");

    const confidence = Number(Math.min(0.99, 0.82 + (containerPort ? 0.08 : 0) + (service.image || service.build ? 0.04 : 0) + (service.healthcheck ? 0.03 : 0)).toFixed(2));
    services[name] = {
      composeService: name,
      ...(containerPort ? { containerPort } : {}),
      protocol,
      path: "/",
      openByDefault: false,
      dependencies,
      discovery: {
        source: "docker-compose-config",
        confidence,
        reasons,
      },
    };
    details.push({ name, composeService: name, containerPort, protocol, dependencies, confidence });
  }

  const previewName = details.find((item) => item.protocol !== "tcp" && PREVIEW_PATTERN.test(item.name))?.name
    ?? details.find((item) => item.protocol !== "tcp")?.name;
  if (previewName) services[previewName].openByDefault = true;

  return { services, details };
}

export function composeConfigArgs(composeFiles, envFiles = []) {
  const args = ["compose"];
  for (const envFile of envFiles) args.push("--env-file", envFile);
  for (const composeFile of composeFiles) args.push("--file", composeFile);
  args.push("config", "--format", "json");
  return args;
}

export async function inspectComposeProject(cwd, composeFiles, envFiles = []) {
  try {
    const result = await run("docker", composeConfigArgs(composeFiles, envFiles), { cwd });
    if (result.exitCode !== 0) {
      return { services: {}, details: [], warning: result.stderr || result.stdout || "Docker Compose config failed." };
    }
    const config = JSON.parse(result.stdout);
    return discoverServicesFromComposeConfig(config);
  } catch (error) {
    return { services: {}, details: [], warning: error instanceof Error ? error.message : String(error) };
  }
}
