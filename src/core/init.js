import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileExists } from "./manifest.js";

async function detectComposeFiles(cwd) {
  const candidates = ["compose.yaml", "compose.yml", "docker-compose.yaml", "docker-compose.yml"];
  const found = [];
  for (const candidate of candidates) {
    if (await fileExists(path.join(cwd, candidate))) found.push(candidate);
  }
  return found;
}

async function detectProjectName(cwd) {
  const packagePath = path.join(cwd, "package.json");
  if (await fileExists(packagePath)) {
    const parsed = JSON.parse(await readFile(packagePath, "utf8"));
    if (parsed.name) return parsed.name;
  }
  return path.basename(cwd);
}

export async function detectProject(cwd) {
  const composeFiles = await detectComposeFiles(cwd);
  const projectName = await detectProjectName(cwd);
  const entries = await readdir(cwd);
  const envFiles = entries.filter((entry) => [".env", ".env.local", ".env.development"].includes(entry)).sort();
  const detected = [];
  const warnings = [];

  if (composeFiles.length > 0) detected.push(`Docker Compose: ${composeFiles.join(", ")}`);
  else warnings.push("No Docker Compose file was found. Add one before running work-containers up.");
  if (entries.includes("package.json")) detected.push("Node.js package.json");
  if (entries.includes("pnpm-lock.yaml")) detected.push("pnpm lockfile");
  else if (entries.includes("yarn.lock")) detected.push("Yarn lockfile");
  else if (entries.includes("package-lock.json")) detected.push("npm lockfile");
  if (entries.includes("Dockerfile")) detected.push("Dockerfile");
  if (envFiles.length > 0) detected.push(`Environment files: ${envFiles.join(", ")}`);

  warnings.push("Review the generated file and add logical services, Compose service names, ports, and dependencies.");

  return {
    manifest: {
      version: 1,
      project: { name: projectName },
      runtime: {
        orchestrator: "compose",
        composeFiles: composeFiles.length > 0 ? composeFiles : ["compose.yaml"],
        envFiles,
      },
      services: {},
      worktrees: {
        projectName: "${project}-${worktree}",
        portRange: [41000, 49000],
        bindAddress: "127.0.0.1",
      },
      lifecycle: { beforeUp: [], afterUp: [], beforeDown: [] },
    },
    detected,
    warnings,
  };
}
