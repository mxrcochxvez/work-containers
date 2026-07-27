import test from "node:test";
import assert from "node:assert/strict";
import { composeConfigArgs, discoverServicesFromComposeConfig } from "../src/core/discovery.js";

test("discovers compose services, ports, dependencies, and preview service", () => {
  const result = discoverServicesFromComposeConfig({
    services: {
      web: {
        build: ".",
        ports: [{ target: 3000, published: "3000" }],
        depends_on: { db: { condition: "service_healthy" } },
      },
      db: {
        image: "postgres:17",
        expose: { "5432/tcp": {} },
        healthcheck: { test: ["CMD", "pg_isready"] },
      },
    },
  });

  assert.equal(result.services.web.containerPort, 3000);
  assert.equal(result.services.web.protocol, "http");
  assert.equal(result.services.web.openByDefault, true);
  assert.deepEqual(result.services.web.dependencies, ["db"]);
  assert.equal(result.services.db.protocol, "tcp");
  assert.equal(result.services.db.containerPort, 5432);
  assert.ok(result.services.web.discovery.confidence >= 0.9);
});

test("builds compose config command arguments", () => {
  assert.deepEqual(composeConfigArgs(["compose.yaml", "compose.dev.yaml"], [".env"]), [
    "compose",
    "--env-file",
    ".env",
    "--file",
    "compose.yaml",
    "--file",
    "compose.dev.yaml",
    "config",
    "--format",
    "json",
  ]);
});
