import test from "node:test";
import assert from "node:assert/strict";
import { createWorktreeId, renderProjectName, slugify } from "../src/core/context.js";

test("slugify creates Compose-safe names", () => {
  assert.equal(slugify("Feature/Add Login_UI"), "feature-add-login-ui");
});

test("createWorktreeId is stable and path-specific", () => {
  assert.match(createWorktreeId("Example App", "feature/auth", "/tmp/example-auth"), /^example-app-feature-auth-[a-f0-9]{8}$/);
});

test("renderProjectName replaces template values", () => {
  assert.equal(renderProjectName("${project}-${worktree}", {
    project: "Example App",
    worktree: "Auth Worktree",
    branch: "feature/auth",
    id: "example-auth-12345678",
  }), "example-app-auth-worktree");
});
