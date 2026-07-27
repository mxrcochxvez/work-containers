import test from "node:test";
import assert from "node:assert/strict";
import { validateManifest } from "../src/core/manifest.js";

test("preserves valid service discovery metadata", () => {
  const manifest = validateManifest({
    version: 1,
    project: { name: "demo" },
    runtime: { orchestrator: "compose", composeFiles: ["compose.yaml"] },
    services: {
      web: {
        composeService: "web",
        discovery: {
          source: "docker-compose-config",
          confidence: 0.94,
          reasons: ["port detected"],
        },
      },
    },
  });

  assert.equal(manifest.services.web.discovery.confidence, 0.94);
});
