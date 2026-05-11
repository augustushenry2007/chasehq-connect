## Evidence-Based Debugging Policy

**Always applies** to every bug, crash, or unexpected behavior investigation — no exceptions, no opt-out.

**Core rule**: No code changes until the root cause is proven from evidence (code, logs, stack traces, runtime behavior). Never hypothesize; never fix symptoms.

**Mandatory sequence before any fix**:
1. Reproduce the issue
2. Trace the execution flow through actual files (never reason abstractly)
3. Identify state ownership and all mutation points
4. Prove the exact divergence point
5. Output: reproduction path, execution trace, ownership analysis, proven root cause, why other explanations are rejected, minimal fix strategy

**Forbidden without direct evidence**: arbitrary delays/timeouts, retry loops, forced refreshes, defensive resets, duplicate state syncing, extra loading guards, UI masking, bandaid patches.

Full policy detail: memory file `feedback_evidence_based_debugging.md`.

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

**Claude must run `npm run cap:copy:ios` automatically after editing any frontend file —
no asking, no "should I deploy?", no leaving it as a manual step for the user.** This
applies every single time, even for tiny edits or rapid iteration. The Xcode rebuild
ships whatever is in `dist/`, so skipping `cap:copy:ios` ships stale JS to the device
and silently breaks testing. Same rule for edge functions: after editing
`supabase/functions/**`, run `supabase functions deploy <fn>` automatically.
