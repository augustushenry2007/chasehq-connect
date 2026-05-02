## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

## Capacitor

When syncing iOS, use `npm run cap:copy:ios` (or `cap:sync:ios`), NOT bare `npx cap copy ios`.
The wrapped scripts (1) run `vite build` so the iOS WebView loads the latest code — bare
`cap copy` only ships whatever is currently in `dist/`, which is silently stale if you forgot
to rebuild — and (2) inject `GoogleAuthPlugin` into `packageClassList`, which Capacitor 8
strips on every cap copy/sync because it's an inline App-target plugin (not an npm package).
If you ever see `"GoogleAuth" plugin is not implemented on ios UNIMPLEMENTED` at runtime,
run `npm run cap:inject` and rebuild.

After ANY frontend (.ts/.tsx/.css) change, the only command needed to get the new code onto
the device is `npm run cap:copy:ios`. Then in Xcode: ⇧⌘K (Clean Build Folder) → ⌘R.
