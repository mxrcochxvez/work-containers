import net from "node:net";
import { createHash } from "node:crypto";

export async function isPortAvailable(port, host) {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.listen({ port, host }, () => server.close(() => resolve(true)));
  });
}

function portOffset(seed, width) {
  const digest = createHash("sha256").update(seed).digest();
  return digest.readUInt32BE(0) % width;
}

export async function allocatePorts(serviceNames, range, host, seed) {
  const [start, end] = range;
  const width = end - start + 1;
  if (serviceNames.length > width) throw new Error(`Port range ${start}-${end} is too small.`);

  const reserved = new Set();
  const result = {};
  for (const serviceName of [...serviceNames].sort()) {
    const initial = portOffset(`${seed}:${serviceName}`, width);
    let assigned;
    for (let attempt = 0; attempt < width; attempt += 1) {
      const candidate = start + ((initial + attempt) % width);
      if (reserved.has(candidate)) continue;
      if (await isPortAvailable(candidate, host)) {
        assigned = candidate;
        break;
      }
    }
    if (assigned === undefined) throw new Error(`No available port found for ${serviceName}.`);
    reserved.add(assigned);
    result[serviceName] = assigned;
  }
  return result;
}
