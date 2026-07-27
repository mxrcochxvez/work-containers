import { createHash } from "node:crypto";
import path from "node:path";
import { runChecked } from "./process.js";

export function slugify(value) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42);
  return slug || "detached";
}

export function createWorktreeId(repositoryName, branch, worktreePath) {
  const digest = createHash("sha256").update(path.resolve(worktreePath)).digest("hex").slice(0, 8);
  return `${slugify(repositoryName)}-${slugify(branch)}-${digest}`.slice(0, 63);
}

export async function resolveWorktreeContext(cwd) {
  const worktreePath = (await runChecked("git", ["rev-parse", "--show-toplevel"], { cwd })).stdout;
  const commonDirectoryRaw = (await runChecked("git", ["rev-parse", "--git-common-dir"], { cwd })).stdout;
  const branchResult = await runChecked("git", ["branch", "--show-current"], { cwd });
  const branch = branchResult.stdout || (await runChecked("git", ["rev-parse", "--short", "HEAD"], { cwd })).stdout;
  const commonDirectory = path.resolve(worktreePath, commonDirectoryRaw);
  const repositoryRoot = path.dirname(commonDirectory);
  const repositoryName = path.basename(repositoryRoot);
  const worktreeName = path.basename(worktreePath);

  return {
    repositoryRoot,
    worktreePath,
    branch,
    repositoryName,
    worktreeName,
    id: createWorktreeId(repositoryName, branch, worktreePath),
  };
}

export function renderProjectName(template, values) {
  return template
    .replaceAll("${project}", slugify(values.project))
    .replaceAll("${worktree}", slugify(values.worktree))
    .replaceAll("${branch}", slugify(values.branch))
    .replaceAll("${id}", slugify(values.id))
    .slice(0, 63);
}
