import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const siteRoot = new URL("../docs/", import.meta.url);

test("GitHub Pages entrypoint references local assets", async () => {
  const html = await readFile(new URL("index.html", siteRoot), "utf8");
  assert.match(html, /<link rel="stylesheet" href="\.\/styles\.css">/);
  assert.match(html, /<script src="\.\/app\.js" defer><\/script>/);
  assert.match(html, /id="demo"/);
  assert.match(html, /id="architecture"/);
  assert.match(html, /id="install"/);
  await access(new URL("styles.css", siteRoot));
  await access(new URL("app.js", siteRoot));
  await access(new URL(".nojekyll", siteRoot));
});

test("site contains one primary heading and accessible demo controls", async () => {
  const html = await readFile(new URL("index.html", siteRoot), "utf8");
  const css = await readFile(new URL("styles.css", siteRoot), "utf8");
  assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(css, /prefers-reduced-motion/);
});
