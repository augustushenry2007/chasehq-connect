#!/usr/bin/env node
/**
 * watch-ios.mjs
 * Run with: npm run watch:ios
 *
 * What it does:
 *   - Starts vite build --watch (handles all src/ changes with debouncing)
 *   - After each successful Vite build: runs cap sync ios + restarts app in simulator
 *   - Also watches capacitor.config.ts for native config changes:
 *       → runs cap sync ios + restarts app (no vite rebuild needed for config-only changes)
 *   - Note: changes inside ios/ that require a Swift recompile (e.g. new native plugins)
 *       still need Cmd+R in Xcode — simctl can't trigger a native recompile.
 */

import { spawn, execSync, spawnSync } from "child_process";
import { watch } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const APP_ID = "com.chasehq.app";

// ── helpers ────────────────────────────────────────────────────────────────

function log(msg) { console.log(msg); }

function restartApp() {
  try {
    spawnSync("xcrun", ["simctl", "terminate", "booted", APP_ID], { stdio: "pipe" });
    const res = spawnSync("xcrun", ["simctl", "launch", "booted", APP_ID], { stdio: "pipe" });
    if (res.status !== 0) {
      log("  ⚠️  Could not launch in simulator — is one running? Press Cmd+R in Xcode.");
    }
  } catch {
    log("  ⚠️  xcrun not found — press Cmd+R in Xcode to reload.");
  }
}

// Prevent overlapping syncs from rapid successive triggers.
let syncLocked = false;
let syncPending = false;

async function doSync(reason) {
  if (syncLocked) { syncPending = true; return; }
  syncLocked = true;
  log(`\n📦  [${reason}] cap sync ios …`);
  try {
    execSync("npx cap sync ios", { cwd: ROOT, stdio: "inherit" });
    log("🔄  Restarting app in simulator …");
    restartApp();
    log("✅  Ready\n");
  } catch (e) {
    log(`❌  sync failed: ${e.message}`);
  } finally {
    syncLocked = false;
    if (syncPending) { syncPending = false; doSync(reason + " (queued)"); }
  }
}

// ── watch capacitor.config.ts (native config — no vite rebuild needed) ────

let capTimeout;
try {
  watch(path.join(ROOT, "capacitor.config.ts"), () => {
    clearTimeout(capTimeout);
    capTimeout = setTimeout(() => {
      log("\n⚙️  capacitor.config.ts changed");
      doSync("native config");
    }, 400);
  });
  log("👀  Watching capacitor.config.ts for native config changes");
} catch {
  log("⚠️  Could not watch capacitor.config.ts");
}

// ── start vite build --watch ───────────────────────────────────────────────

log("🏗   Starting vite build --watch …\n");
const vite = spawn("npx", ["vite", "build", "--watch"], {
  cwd: ROOT,
  stdio: ["inherit", "pipe", "pipe"],
  shell: process.platform === "win32",
});

let buf = "";
vite.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  buf += chunk.toString();
  // Vite prints "✓ built in Xms" or "built in Xs" after each successful build.
  if (/built in \d/.test(buf)) {
    buf = "";
    doSync("source change");
  }
  if (buf.length > 40_000) buf = buf.slice(-20_000);
});

vite.stderr.on("data", (d) => process.stderr.write(d));
vite.on("close", (code) => {
  log(`\nVite exited (code ${code})`);
  process.exit(code ?? 0);
});

process.on("SIGINT", () => { vite.kill("SIGINT"); process.exit(0); });
process.on("SIGTERM", () => { vite.kill("SIGTERM"); process.exit(0); });
