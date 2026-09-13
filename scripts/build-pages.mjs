#!/usr/bin/env node
/**
 * GitHub Pages static export.
 *
 * Nitro 3's Vite builder still tries to compile a server bundle for static
 * presets and dies with "rolldownOptions.input should not be an html file"
 * after the client + SSR graphs are already written. We ignore that crash,
 * render `/hardwall/` through the SSR bundle, and drop a real index.html
 * into `.output/public`.
 */
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join } from "node:path";

const root = process.cwd();
const publicDir = join(root, ".output/public");
const ssrEntry = join(root, "node_modules/.nitro/vite/services/ssr/index.js");
const PAGES_URL = "http://localhost/hardwall/";

const env = {
  ...process.env,
  GITHUB_PAGES: "1",
  NITRO_PRESET: "github-pages",
  VITE_AUTH_ENABLED: process.env.VITE_AUTH_ENABLED || "false",
};

function runVite() {
  return new Promise((resolve) => {
    const child = spawn("node", ["scripts/with-app-env.mjs", "vite", "build"], {
      cwd: root,
      env,
      stdio: "inherit",
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

function looksLikeHtml(text) {
  const head = text.slice(0, 512).toLowerCase();
  return head.includes("<html") && text.includes("/hardwall/assets/");
}

async function renderHtml() {
  if (!existsSync(ssrEntry)) {
    throw new Error(`[pages] SSR bundle missing: ${ssrEntry}`);
  }
  const mod = await import(pathToFileURL(ssrEntry).href);
  const fetch = mod.default?.fetch;
  if (typeof fetch !== "function") {
    throw new Error("[pages] SSR bundle has no fetch()");
  }

  let url = PAGES_URL;
  for (let hop = 0; hop < 5; hop += 1) {
    const res = await fetch(new Request(url));
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get("location");
      if (!loc) break;
      url = new URL(loc, url).href;
      continue;
    }
    const html = await res.text();
    if (res.status !== 200 || !looksLikeHtml(html)) {
      throw new Error(
        `[pages] SSR ${url} -> ${res.status} (${html.length} bytes, not a Pages document)`,
      );
    }
    return html;
  }
  throw new Error("[pages] SSR redirect loop");
}

function finalize(html) {
  if (!existsSync(publicDir)) {
    throw new Error("[pages] .output/public is missing");
  }

  const stray = join(publicDir, "index");
  if (existsSync(stray) && statSync(stray).isFile()) unlinkSync(stray);

  const dest = join(publicDir, "index.html");
  writeFileSync(dest, html);
  copyFileSync(dest, join(publicDir, "404.html"));
  writeFileSync(join(publicDir, ".nojekyll"), "");

  const listing = readdirSync(publicDir).join(", ");
  console.log(`[pages] wrote ${dest} (${Buffer.byteLength(html)} bytes)`);
  console.log(`[pages] public: ${listing}`);
}

const code = await runVite();
if (code !== 0) {
  console.log(
    `[pages] vite exited ${code} after client/SSR emit — rendering static HTML (nitro static preset bug)`,
  );
}

try {
  const html = await renderHtml();
  finalize(html);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
