

The user reports the app feels laggy when navigating between Dashboard and Invoices. From the session replay: each tab switch triggers a full skeleton flash because `useInvoices()` refetches from Supabase on every mount.

## Root cause

`useInvoices` runs `fetchInvoices()` in a `useEffect` on every component mount. Since Dashboard and Invoices are separate routes, switching tabs unmounts/remounts the screen → refetch → skeleton flash → data appears. That's the "lag" — it's not network latency, it's redundant fetches and re-renders.

Also: the `StatCard` ref warning in console suggests a minor React issue but isn't the perf problem.

## Fix

**1. Cache invoices at app level** so tab switches are instant.

Add a lightweight invoices cache to `AppContext`:
- Single subscription, fetched once after auth
- Exposes `{ invoices, loading, refetch }` 
- `useInvoices()` becomes a thin consumer of context (no own fetch)
- First load shows skeleton; subsequent tab switches show cached data instantly with a silent background refresh

**2. Realtime sync** (optional, cheap): subscribe to Postgres changes on `invoices` table so the cache stays fresh without polling. Falls back to manual `refetch()` after mutations (create/delete/update).

**3. Fix StatCard ref warning**: wrap `StatCard` with `forwardRef` or stop passing a ref to it (likely from a parent map). Quick check + fix.

**4. Preserve scroll/no layout shift**: cache means skeleton only shows on true cold load. Tab switching = instant render of cached list.

## Files

- `src/context/AppContext.tsx` — add `invoices`, `invoicesLoading`, `refetchInvoices` to context; fetch once when `user` is set; subscribe to realtime changes
- `src/hooks/useSupabaseData.ts` — `useInvoices()` returns context values instead of fetching itself; keep `deleteInvoice` etc. as-is but call `refetchInvoices` after mutations
- `src/pages/DashboardScreen.tsx` — fix `StatCard` ref warning (likely missing key vs ref confusion)
- No DB or edge function changes

## Result

- First app load: one skeleton, then data
- Every subsequent tab switch: instant, no skeleton, no flash
- Mutations (new/delete invoice): optimistic refetch keeps UI in sync
- Realtime updates from other devices/sessions reflect automatically

