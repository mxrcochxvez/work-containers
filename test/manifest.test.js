import test from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../src/core/manifest.js";

test("manifest validation applies safe defaults", () => {
  const manifest = validateManifest({
    version: 1,
    project: { name: "example" },
    runtime: { orchestrator: "compose", composeFiles: ["compose.yaml"] },
    services: { web: { composeService: "web", containerPort: 3000 } },
  });
  assert.equal(manifest.services.web.protocol, "http");
  assert.deepEqual(manifest.worktrees.portRange, [41000, 49000]);
});

test("manifest validation rejects missing dependencies", () => {
  assert.throws(() => validateManifest({
    version: 1,
    project: { name: "example" },
    runtime: { orchestrator: "compose", composeFiles: ["compose.yaml"] },
    services: { web: { composeService: "web", dependencies: ["api"] } },
  }), /unknown dependency api/);
});
