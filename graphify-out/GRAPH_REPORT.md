# Graph Report - .  (2026-04-19)

## Corpus Check
- 133 files · ~83,926 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 279 nodes · 201 edges · 106 communities detected
- Extraction: 86% EXTRACTED · 14% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Component 0|Component 0]]
- [[_COMMUNITY_Notifications|Notifications]]
- [[_COMMUNITY_Email & Messaging|Email & Messaging]]
- [[_COMMUNITY_Notifications|Notifications]]
- [[_COMMUNITY_Email & Messaging|Email & Messaging]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_React Hooks|React Hooks]]
- [[_COMMUNITY_Component 7|Component 7]]
- [[_COMMUNITY_Authentication|Authentication]]
- [[_COMMUNITY_Component 9|Component 9]]
- [[_COMMUNITY_Application Flow|Application Flow]]
- [[_COMMUNITY_Email & Messaging|Email & Messaging]]
- [[_COMMUNITY_Invoice Management|Invoice Management]]
- [[_COMMUNITY_Invoice Management|Invoice Management]]
- [[_COMMUNITY_Application Flow|Application Flow]]
- [[_COMMUNITY_Component 15|Component 15]]
- [[_COMMUNITY_React Hooks|React Hooks]]
- [[_COMMUNITY_Component 17|Component 17]]
- [[_COMMUNITY_Application Flow|Application Flow]]
- [[_COMMUNITY_Component 19|Component 19]]
- [[_COMMUNITY_Notifications|Notifications]]
- [[_COMMUNITY_Pages & Screens|Pages & Screens]]
- [[_COMMUNITY_Component 22|Component 22]]
- [[_COMMUNITY_Component 23|Component 23]]
- [[_COMMUNITY_Notifications|Notifications]]
- [[_COMMUNITY_Component 25|Component 25]]
- [[_COMMUNITY_Component 26|Component 26]]
- [[_COMMUNITY_Authentication|Authentication]]
- [[_COMMUNITY_React Hooks|React Hooks]]
- [[_COMMUNITY_Component 29|Component 29]]
- [[_COMMUNITY_Component 30|Component 30]]
- [[_COMMUNITY_Component 31|Component 31]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_React Hooks|React Hooks]]
- [[_COMMUNITY_Authentication|Authentication]]
- [[_COMMUNITY_Component 35|Component 35]]
- [[_COMMUNITY_React Hooks|React Hooks]]
- [[_COMMUNITY_Component 37|Component 37]]
- [[_COMMUNITY_Component 38|Component 38]]
- [[_COMMUNITY_Pages & Screens|Pages & Screens]]
- [[_COMMUNITY_Component 40|Component 40]]
- [[_COMMUNITY_Application Flow|Application Flow]]
- [[_COMMUNITY_Component 42|Component 42]]
- [[_COMMUNITY_Component 43|Component 43]]
- [[_COMMUNITY_Component 44|Component 44]]
- [[_COMMUNITY_Component 45|Component 45]]
- [[_COMMUNITY_Component 46|Component 46]]
- [[_COMMUNITY_Component 47|Component 47]]
- [[_COMMUNITY_Component 48|Component 48]]
- [[_COMMUNITY_Component 49|Component 49]]
- [[_COMMUNITY_Component 50|Component 50]]
- [[_COMMUNITY_Component 51|Component 51]]
- [[_COMMUNITY_Component 52|Component 52]]
- [[_COMMUNITY_Component 53|Component 53]]
- [[_COMMUNITY_Component 54|Component 54]]
- [[_COMMUNITY_Component 55|Component 55]]
- [[_COMMUNITY_Component 56|Component 56]]
- [[_COMMUNITY_Component 57|Component 57]]
- [[_COMMUNITY_Component 58|Component 58]]
- [[_COMMUNITY_Notifications|Notifications]]
- [[_COMMUNITY_Component 60|Component 60]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Component 62|Component 62]]
- [[_COMMUNITY_Component 63|Component 63]]
- [[_COMMUNITY_Component 64|Component 64]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Component 67|Component 67]]
- [[_COMMUNITY_Component 68|Component 68]]
- [[_COMMUNITY_Component 69|Component 69]]
- [[_COMMUNITY_Component 70|Component 70]]
- [[_COMMUNITY_Component 71|Component 71]]
- [[_COMMUNITY_Component 72|Component 72]]
- [[_COMMUNITY_Notifications|Notifications]]
- [[_COMMUNITY_React Hooks|React Hooks]]
- [[_COMMUNITY_Component 75|Component 75]]
- [[_COMMUNITY_Component 76|Component 76]]
- [[_COMMUNITY_Component 77|Component 77]]
- [[_COMMUNITY_Component 78|Component 78]]
- [[_COMMUNITY_Component 79|Component 79]]
- [[_COMMUNITY_Component 80|Component 80]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Component 82|Component 82]]
- [[_COMMUNITY_Component 83|Component 83]]
- [[_COMMUNITY_Component 84|Component 84]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Component 86|Component 86]]
- [[_COMMUNITY_Component 87|Component 87]]
- [[_COMMUNITY_Component 88|Component 88]]
- [[_COMMUNITY_Component 89|Component 89]]
- [[_COMMUNITY_Component 90|Component 90]]
- [[_COMMUNITY_Component 91|Component 91]]
- [[_COMMUNITY_Component 92|Component 92]]
- [[_COMMUNITY_UI Components|UI Components]]
- [[_COMMUNITY_Component 94|Component 94]]
- [[_COMMUNITY_Component 95|Component 95]]
- [[_COMMUNITY_Component 96|Component 96]]
- [[_COMMUNITY_Authentication|Authentication]]
- [[_COMMUNITY_Pages & Screens|Pages & Screens]]
- [[_COMMUNITY_Pages & Screens|Pages & Screens]]
- [[_COMMUNITY_Component 100|Component 100]]
- [[_COMMUNITY_React Hooks|React Hooks]]
- [[_COMMUNITY_Application Flow|Application Flow]]
- [[_COMMUNITY_Component 103|Component 103]]
- [[_COMMUNITY_Component 104|Component 104]]
- [[_COMMUNITY_Component 105|Component 105]]

## God Nodes (most connected - your core abstractions)
1. `useApp()` - 11 edges
2. `json()` - 10 edges
3. `persist()` - 5 edges
4. `handleCreate()` - 5 edges
5. `doSend()` - 5 edges
6. `ErrorBoundary` - 4 edges
7. `useEntitlement()` - 4 edges
8. `ChaseHQ Web Application` - 4 edges
9. `RequireOnboarding()` - 3 edges
10. `useNotificationPreferences()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Growth Arrow Icon with Frame` --semantically_similar_to--> `Invoice Follow-up Automation`  [INFERRED] [semantically similar]
  src/assets/app-logo.png → index.html
- `Google Sign-in Button UI Component` --references--> `ChaseHQ Web Application`  [INFERRED]
  src/assets/google-signin-button.png → index.html
- `useNotifications()` --calls--> `useApp()`  [INFERRED]
  src/hooks/useNotifications.ts → src/context/AppContext.tsx
- `useInvoices()` --calls--> `useApp()`  [INFERRED]
  src/hooks/useSupabaseData.ts → src/context/AppContext.tsx
- `doSend()` --calls--> `advanceScheduleAfterSend()`  [INFERRED]
  src/components/invoice/AIDraftComposer.tsx → src/hooks/useNotifications.ts

## Hyperedges (group relationships)
- **Google-based Authentication System** — google_signin_button, index_entry_point, index_root_element [INFERRED 0.70]

## Communities

### Community 0 - "Component 0"
Cohesion: 0.12
Nodes (7): isGuestOnboarded(), savePending(), handleCreate(), resetDraft(), RequireOnboarding(), isAuthError(), withAuthRetry()

### Community 1 - "Notifications"
Cohesion: 0.11
Nodes (8): useApp(), FlowBootstrap(), NotificationPermissionCard(), PostInvoiceAuthScreen(), RootRedirect(), useGmailConnection(), useNotificationPreferences(), useSendingMailbox()

### Community 2 - "Email & Messaging"
Cohesion: 0.17
Nodes (10): doSend(), handleGenerate(), handleSendClick(), handleDelete(), deleteInvoice(), generateFollowup(), recordFollowup(), sendFollowupEmail() (+2 more)

### Community 3 - "Notifications"
Cohesion: 0.16
Nodes (8): getUserTimezone(), commitChanges(), persist(), resetDefaults(), togglePaused(), advanceScheduleAfterSend(), createScheduleForInvoice(), useNotifications()

### Community 4 - "Email & Messaging"
Cohesion: 0.19
Nodes (4): json(), sendViaGmail(), sendViaSmtp(), verifyReceiptWithApple()

### Community 5 - "UI Components"
Cohesion: 0.21
Nodes (7): handleRestore(), purchaseSubscription(), restorePurchases(), handlePurchase(), handleRestore(), handleStartTrial(), primaryAction()

### Community 6 - "React Hooks"
Cohesion: 0.33
Nodes (7): Toaster(), addToRemoveQueue(), dispatch(), genId(), reducer(), toast(), useToast()

### Community 7 - "Component 7"
Cohesion: 0.22
Nodes (0): 

### Community 8 - "Authentication"
Cohesion: 0.25
Nodes (8): ChaseHQ Application Logo, Google Sign-in Button UI Component, Invoice Follow-up Automation, ChaseHQ Web Application, TypeScript React Main Entry Point, React Root DOM Element, Growth Arrow Icon with Frame, Allow Public Crawling by Major Search Bots

### Community 9 - "Component 9"
Cohesion: 0.33
Nodes (0): 

### Community 10 - "Application Flow"
Cohesion: 0.4
Nodes (1): ErrorBoundary

### Community 11 - "Email & Messaging"
Cohesion: 0.5
Nodes (3): TrialBanner(), deriveCanSend(), useEntitlement()

### Community 12 - "Invoice Management"
Cohesion: 0.4
Nodes (0): 

### Community 13 - "Invoice Management"
Cohesion: 0.4
Nodes (0): 

### Community 14 - "Application Flow"
Cohesion: 0.4
Nodes (0): 

### Community 15 - "Component 15"
Cohesion: 0.5
Nodes (0): 

### Community 16 - "React Hooks"
Cohesion: 0.5
Nodes (0): 

### Community 17 - "Component 17"
Cohesion: 0.5
Nodes (0): 

### Community 18 - "Application Flow"
Cohesion: 0.67
Nodes (2): isTestingMode(), readUrlFlag()

### Community 19 - "Component 19"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Notifications"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "Pages & Screens"
Cohesion: 0.67
Nodes (0): 

### Community 22 - "Component 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Component 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Notifications"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Component 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Component 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Authentication"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "React Hooks"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Component 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Component 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Component 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "React Hooks"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Authentication"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Component 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "React Hooks"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Component 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Component 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Pages & Screens"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Component 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Application Flow"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Component 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Component 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Component 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Component 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Component 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Component 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Component 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Component 49"
Cohesion: 1.0
Nodes (0): 

### Community 50 - "Component 50"
Cohesion: 1.0
Nodes (0): 

### Community 51 - "Component 51"
Cohesion: 1.0
Nodes (0): 

### Community 52 - "Component 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Component 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Component 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Component 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Component 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Component 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Component 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Notifications"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Component 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Component 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Component 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Component 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Component 67"
Cohesion: 1.0
Nodes (0): 

### Community 68 - "Component 68"
Cohesion: 1.0
Nodes (0): 

### Community 69 - "Component 69"
Cohesion: 1.0
Nodes (0): 

### Community 70 - "Component 70"
Cohesion: 1.0
Nodes (0): 

### Community 71 - "Component 71"
Cohesion: 1.0
Nodes (0): 

### Community 72 - "Component 72"
Cohesion: 1.0
Nodes (0): 

### Community 73 - "Notifications"
Cohesion: 1.0
Nodes (0): 

### Community 74 - "React Hooks"
Cohesion: 1.0
Nodes (0): 

### Community 75 - "Component 75"
Cohesion: 1.0
Nodes (0): 

### Community 76 - "Component 76"
Cohesion: 1.0
Nodes (0): 

### Community 77 - "Component 77"
Cohesion: 1.0
Nodes (0): 

### Community 78 - "Component 78"
Cohesion: 1.0
Nodes (0): 

### Community 79 - "Component 79"
Cohesion: 1.0
Nodes (0): 

### Community 80 - "Component 80"
Cohesion: 1.0
Nodes (0): 

### Community 81 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 82 - "Component 82"
Cohesion: 1.0
Nodes (0): 

### Community 83 - "Component 83"
Cohesion: 1.0
Nodes (0): 

### Community 84 - "Component 84"
Cohesion: 1.0
Nodes (0): 

### Community 85 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 86 - "Component 86"
Cohesion: 1.0
Nodes (0): 

### Community 87 - "Component 87"
Cohesion: 1.0
Nodes (0): 

### Community 88 - "Component 88"
Cohesion: 1.0
Nodes (0): 

### Community 89 - "Component 89"
Cohesion: 1.0
Nodes (0): 

### Community 90 - "Component 90"
Cohesion: 1.0
Nodes (0): 

### Community 91 - "Component 91"
Cohesion: 1.0
Nodes (0): 

### Community 92 - "Component 92"
Cohesion: 1.0
Nodes (0): 

### Community 93 - "UI Components"
Cohesion: 1.0
Nodes (0): 

### Community 94 - "Component 94"
Cohesion: 1.0
Nodes (0): 

### Community 95 - "Component 95"
Cohesion: 1.0
Nodes (0): 

### Community 96 - "Component 96"
Cohesion: 1.0
Nodes (0): 

### Community 97 - "Authentication"
Cohesion: 1.0
Nodes (0): 

### Community 98 - "Pages & Screens"
Cohesion: 1.0
Nodes (0): 

### Community 99 - "Pages & Screens"
Cohesion: 1.0
Nodes (0): 

### Community 100 - "Component 100"
Cohesion: 1.0
Nodes (0): 

### Community 101 - "React Hooks"
Cohesion: 1.0
Nodes (0): 

### Community 102 - "Application Flow"
Cohesion: 1.0
Nodes (0): 

### Community 103 - "Component 103"
Cohesion: 1.0
Nodes (1): ChaseHQ: Get Paid Without the Awkwardness

### Community 104 - "Component 104"
Cohesion: 1.0
Nodes (1): ChaseHQ Placeholder Branding SVG

### Community 105 - "Component 105"
Cohesion: 1.0
Nodes (1): SEO Robot Configuration

## Knowledge Gaps
- **7 isolated node(s):** `ChaseHQ: Get Paid Without the Awkwardness`, `TypeScript React Main Entry Point`, `ChaseHQ Application Logo`, `Google Sign-in Button UI Component`, `ChaseHQ Placeholder Branding SVG` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Component 22`** (2 nodes): `buildRedirectHtml()`, `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 23`** (2 nodes): `App.tsx`, `main.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Notifications`** (2 nodes): `handleTap()`, `NotificationBell.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 25`** (2 nodes): `StatusBadge.tsx`, `StatusBadge()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 26`** (2 nodes): `TabLayout.tsx`, `TabLayout()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Authentication`** (2 nodes): `GoogleIcon()`, `GoogleIcon.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Hooks`** (2 nodes): `useChart()`, `chart.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 29`** (2 nodes): `ResizablePanelGroup()`, `resizable.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 30`** (2 nodes): `Toaster()`, `sonner.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 31`** (2 nodes): `Calendar()`, `calendar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (2 nodes): `useFormField()`, `form.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Hooks`** (2 nodes): `useCarousel()`, `carousel.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Authentication`** (2 nodes): `AuthForm()`, `AuthForm.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 35`** (2 nodes): `getDefaultDraft()`, `DraftTemplates.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Hooks`** (2 nodes): `use-mobile.tsx`, `useIsMobile()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 37`** (2 nodes): `utils.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 38`** (2 nodes): `PlaceholderIndex()`, `Index.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pages & Screens`** (2 nodes): `handle()`, `PreDashboardDecisionScreen.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 40`** (2 nodes): `NotFound()`, `NotFound.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Application Flow`** (2 nodes): `FlowRouter()`, `FlowRouter.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 42`** (2 nodes): `transitions.ts`, `resolveTransition()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 43`** (1 nodes): `tailwind.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 44`** (1 nodes): `eslint.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 45`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 46`** (1 nodes): `vitest.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 47`** (1 nodes): `postcss.config.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 48`** (1 nodes): `capacitor.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 49`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 50`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 51`** (1 nodes): `vite-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 52`** (1 nodes): `example.test.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 53`** (1 nodes): `setup.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 54`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 55`** (1 nodes): `client.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 56`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 57`** (1 nodes): `NavLink.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 58`** (1 nodes): `aspect-ratio.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Notifications`** (1 nodes): `alert-dialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 60`** (1 nodes): `tabs.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (1 nodes): `card.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 62`** (1 nodes): `slider.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 63`** (1 nodes): `popover.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 64`** (1 nodes): `progress.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (1 nodes): `input-otp.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (1 nodes): `hover-card.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 67`** (1 nodes): `sheet.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 68`** (1 nodes): `scroll-area.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 69`** (1 nodes): `label.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 70`** (1 nodes): `navigation-menu.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 71`** (1 nodes): `accordion.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 72`** (1 nodes): `tooltip.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Notifications`** (1 nodes): `alert.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Hooks`** (1 nodes): `use-toast.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 75`** (1 nodes): `switch.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 76`** (1 nodes): `radio-group.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 77`** (1 nodes): `command.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 78`** (1 nodes): `toggle-group.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 79`** (1 nodes): `avatar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 80`** (1 nodes): `menubar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (1 nodes): `dialog.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 82`** (1 nodes): `badge.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 83`** (1 nodes): `table.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 84`** (1 nodes): `separator.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (1 nodes): `button.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 86`** (1 nodes): `toggle.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 87`** (1 nodes): `toast.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 88`** (1 nodes): `checkbox.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 89`** (1 nodes): `collapsible.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 90`** (1 nodes): `dropdown-menu.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 91`** (1 nodes): `select.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 92`** (1 nodes): `textarea.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `UI Components`** (1 nodes): `input.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 94`** (1 nodes): `skeleton.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 95`** (1 nodes): `context-menu.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 96`** (1 nodes): `validation.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Authentication`** (1 nodes): `AuthScreen.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pages & Screens`** (1 nodes): `WelcomeScreen.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Pages & Screens`** (1 nodes): `OnboardingScreen.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 100`** (1 nodes): `PrivacyPolicy.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `React Hooks`** (1 nodes): `TermsOfUse.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Application Flow`** (1 nodes): `states.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 103`** (1 nodes): `ChaseHQ: Get Paid Without the Awkwardness`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 104`** (1 nodes): `ChaseHQ Placeholder Branding SVG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Component 105`** (1 nodes): `SEO Robot Configuration`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useApp()` connect `Notifications` to `Component 0`, `Notifications`, `Email & Messaging`, `Email & Messaging`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `createScheduleForInvoice()` connect `Notifications` to `Component 0`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Why does `useNotifications()` connect `Notifications` to `Notifications`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 10 inferred relationships involving `useApp()` (e.g. with `RequireOnboarding()` and `useNotificationPreferences()`) actually correct?**
  _`useApp()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `handleCreate()` (e.g. with `savePending()` and `withAuthRetry()`) actually correct?**
  _`handleCreate()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `doSend()` (e.g. with `sendFollowupEmail()` and `recordFollowup()`) actually correct?**
  _`doSend()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `ChaseHQ: Get Paid Without the Awkwardness`, `TypeScript React Main Entry Point`, `ChaseHQ Application Logo` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._