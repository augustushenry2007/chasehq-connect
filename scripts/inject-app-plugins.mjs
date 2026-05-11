#!/usr/bin/env node
// Capacitor 8 only auto-discovers plugins shipped as npm packages. Inline plugins in
// the App target (e.g. GoogleAuthPlugin) must be added to packageClassList manually
// AFTER every `cap copy` / `cap sync`, since those commands regenerate the array.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const APP_PLUGINS = ["GoogleAuthPlugin"];
const __dirname = dirname(fileURLToPath(import.meta.url));
const cfgPath = resolve(__dirname, "../ios/App/App/capacitor.config.json");

const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
const list = new Set(cfg.packageClassList ?? []);
const before = list.size;
for (const cls of APP_PLUGINS) list.add(cls);
cfg.packageClassList = [...list];

if (list.size !== before) {
  writeFileSync(cfgPath, JSON.stringify(cfg, null, "\t") + "\n");
  console.log(`[inject-app-plugins] added: ${APP_PLUGINS.join(", ")}`);
} else {
  console.log("[inject-app-plugins] already present");
}
