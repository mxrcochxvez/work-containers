import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runChecked } from "./process.js";

export async function writeComposeOverride(plan) {
  const outputDirectory = path.join(plan.worktreePath, ".work-containers");
  await mkdir(outputDirectory, { recursive: true });
  const outputPath = path.join(outputDirectory, `${plan.id}.override.yaml`);
  const lines = ["services:"];
  const published = plan.services.filter((service) => service.containerPort && service.hostPort);
  if (published.length === 0) {
    lines.push("  {}", "");
  } else {
    for (const service of published) {
      lines.push(
        `  ${JSON.stringify(service.composeService)}:`,
        "    ports: !override",
        `      - ${JSON.stringify(`${service.hostPort}:${service.containerPort}`)}`,
      );
    }
    lines.push("");
  }
  await writeFile(outputPath, lines.join("\n"), "utf8");
  return outputPath;
}

export function composeArgs(plan, overrideFile, commandArgs) {
  const args = ["compose", "--project-name", plan.projectName];
  for (const envFile of plan.envFiles) args.push("--env-file", envFile);
  for (const composeFile of plan.composeFiles) args.push("--file", composeFile);
  args.push("--file", overrideFile, ...commandArgs);
  return args;
}

export async function runCompose(plan, overrideFile, commandArgs, options = {}) {
  return await runChecked("docker", composeArgs(plan, overrideFile, commandArgs), {
    cwd: plan.worktreePath,
    ...options,
  });
}
