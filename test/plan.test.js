import test from "node:test";
import assert from "node:assert/strict";
import { createPlan } from "../src/core/plan.js";

const manifest = {
  version: 1,
  project: { name: "example" },
  runtime: { orchestrator: "compose", composeFiles: ["compose.yaml"], envFiles: [] },
  services: {
    db: { composeService: "postgres", protocol: "tcp", path: "/", openByDefault: false, dependencies: [] },
    api: { composeService: "api", containerPort: 4000, protocol: "http", path: "/", openByDefault: false, dependencies: ["db"] },
    web: { composeService: "web", containerPort: 3000, protocol: "http", path: "/app", openByDefault: true, dependencies: ["api"] },
  },
  worktrees: { projectName: "${project}-${worktree}", portRange: [41000, 49000], bindAddress: "127.0.0.1" },
  lifecycle: { beforeUp: [], afterUp: [], beforeDown: [] },
};

const context = {
  repositoryRoot: "/repo",
  worktreePath: "/repo-web",
  branch: "feature/web",
  repositoryName: "repo",
  worktreeName: "repo-web",
  id: "repo-feature-web-12345678",
};

test("plan includes dependency closure and URLs", async () => {
  const allocator = async (names) => Object.fromEntries([...names].sort().map((name, index) => [name, 42000 + index]));
  const plan = await createPlan(manifest, context, "/repo-web", ["web"], allocator);
  assert.deepEqual(plan.services.map((service) => service.name), ["api", "db", "web"]);
  assert.equal(plan.services.find((service) => service.name === "web").url, "http://127.0.0.1:42001/app");
});
