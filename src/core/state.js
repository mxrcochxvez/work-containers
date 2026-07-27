import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function stateDirectory() {
  return process.env.WORK_CONTAINERS_HOME
    ? path.resolve(process.env.WORK_CONTAINERS_HOME)
    : path.join(os.homedir(), ".work-containers");
}

function statePath(id) {
  return path.join(stateDirectory(), "environments", `${id}.json`);
}

export async function saveState(state) {
  const filePath = statePath(state.id);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function loadState(id) {
  try {
    return JSON.parse(await readFile(statePath(id), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export async function removeState(id) {
  await rm(statePath(id), { force: true });
}
