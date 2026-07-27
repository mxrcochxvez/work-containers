import test from "node:test";
import assert from "node:assert/strict";
import { createHealthReport, parseComposePs } from "../src/core/health.js";

const plan = {
  id: "demo-feature-abc123",
  services: [
    { name: "web", composeService: "web", protocol: "http", url: "http://127.0.0.1:41000" },
    { name: "db", composeService: "db", protocol: "tcp" },
  ],
};

test("parses Compose ps JSON arrays and NDJSON", () => {
  const rows = [{ Service: "web", State: "running", Health: "healthy" }];
  assert.deepEqual(parseComposePs(JSON.stringify(rows)), rows);
  assert.deepEqual(parseComposePs(rows.map((row) => JSON.stringify(row)).join("\n")), rows);
});

test("summarizes healthy and unhealthy environments", () => {
  const healthy = createHealthReport(plan, [
    { Service: "web", State: "running", Health: "healthy" },
    { Service: "db", State: "running", Health: "healthy" },
  ]);
  assert.equal(healthy.status, "healthy");

  const unhealthy = createHealthReport(plan, [
    { Service: "web", State: "running", Health: "unhealthy" },
    { Service: "db", State: "exited" },
  ]);
  assert.equal(unhealthy.status, "degraded");
  assert.equal(unhealthy.services[0].health, "unhealthy");
});
