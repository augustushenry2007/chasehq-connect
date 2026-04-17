

Let me explore the relevant files first.
<lov-tool-use id="toolu_vrtx_0195PYLBAQXz8weub9P1FBFF" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/InvoiceDetailScreen.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01TpmxuNZcCs5UbFD6i7USqf" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/invoice/AIDraftComposer.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01VK7bP1oht7dtcyAwG4omyc" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/invoice/NewInvoiceModal.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01XUYFmwDoN7Eg73SYaK3DXB" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/invoice/DraftTemplates.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01DTpYcFS8WJMxvFJzgLBirw" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/generate-followup/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01LvMDvmF2QfEd9bsnPUmZez" name="code--view" integration-id="code" data="{\"file_path\": \"src/pages/InvoiceDetailScreen.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_019NhCgEydm7WQUKj7qX6maJ" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/invoice/AIDraftComposer.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01FyWGHKsrQi6esqEpmWSRL8" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/invoice/NewInvoiceModal.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01QSa6NKVL1S7pr6rGcDEyWC" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/generate-followup/index.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01EQuKCce3kmEpfJn4XMt7V7" name="code--view" integration-id="code" data="{\"file_path\": \"src/components/invoice/ChaseTimeline.tsx\"}">
</lov-tool-use>
<lov-plan>

## Plan — Invoice page overhaul + AI fixes

### 1. Invoice Details panel — collapsed by default
`InvoiceDetailScreen.tsx`: change `useState(true)` → `useState(false)`. Add chevron rotation transition for smooth feel.

### 2. Chase Timeline redesign (calmer, more scannable)
Rebuild `ChaseTimeline.tsx` as a **vertical stacked list** instead of cramped horizontal row:
- Each step on its own row: dot + label (left), date (right)
- Larger spacing (`py-3`), 14px label, 12px muted date
- Vertical connector line between dots (subtle border)
- Active step gets a soft sky-blue background pill
- Final notice step uses a subtle warning accent (amber dot/text) to signal escalation
- "Edit" mode shows date inputs inline next to each row (mm/dd/yyyy via formatted display, native picker underneath)
- Drop the calendar/X imports that aren't used

### 3. Delete invoice
- Add `deleteInvoice(invoiceId)` in `useSupabaseData.ts` (`supabase.from("invoices").delete().eq("id", id)`)
- Add trash icon button in `InvoiceDetailScreen` header (top-right of back row)
- Use `AlertDialog` from `@/components/ui/alert-dialog`: title "Delete this invoice?", body "This action cannot be undone. All follow-ups and history for this invoice will be permanently removed.", Cancel / Delete (destructive variant)
- On success: toast + `navigate("/invoices")` + `refetch()`

### 4. "Send via Gmail" → "Send"
`AIDraftComposer.tsx` line 142: change to `<Send className="w-4 h-4" /> Send`. Search rest of codebase for any other instances.

### 5. Invoice page color system alignment
Replace ad-hoc colors (`bg-foreground text-background` send button, hardcoded `accent/30`) with semantic tokens already used on Dashboard:
- Send button: `bg-primary text-primary-foreground` (matches dashboard CTAs)
- Client reply card: `bg-primary/5 border-primary/20`
- Detail rows: keep `bg-card` but unify radius (`rounded-2xl`) and border (`border-border`) — already aligned
- Status colors stay via `StatusBadge` (single source)
- AI badge: already uses `bg-primary/10 text-primary` ✓

### 6. Regenerate AI bug + tone variation
Root causes:
- `useEffect` resets draft to template on every tone change, overwriting AI output silently
- AI gateway may cache identical prompts → add nonce + temperature

Fixes:
- **Frontend** (`AIDraftComposer.tsx`): split effect — only load template on initial mount, not on every tone change. When user clicks Regenerate, always call AI. When tone changes after AI generation, auto-regenerate with new tone.
- **Edge function** (`generate-followup/index.ts`):
  - Add `temperature: 0.9` to request
  - Add explicit per-tone instructions in the system prompt (Polite = warm + apologetic; Friendly = casual + upbeat; Firm = direct + matter-of-fact; Urgent = serious + time-sensitive)
  - Append a random variation seed to user prompt: `Variation seed: ${crypto.randomUUID()}` so identical inputs produce different outputs
  - Accept optional `previousMessage` from client; if provided, instruct model "Write a meaningfully different variation than: ..."
- Pass `previousMessage: currentDraft` from frontend on regenerate clicks

### 7. Date format US localization
`NewInvoiceModal.tsx`: `<input type="date">` always shows browser-native locale (uneditable). Replace with controlled text input + format helper:
- Display value as `MM/DD/YYYY` via mask
- Store as ISO `yyyy-mm-dd` for DB
- Add small calendar icon button that opens `<Popover>` with `Calendar` from `@/components/ui/calendar` (already in project) for picker UX
- Update placeholder to `MM/DD/YYYY`
- Audit other date displays (already use `en-US` toLocaleDateString ✓)

### 8. "Formal Notice" → "Final Notice"
`ChaseTimeline.tsx` already says "Final notice" ✓. Search project for "Formal Notice" / "approval needed" — likely in `OnboardingScreen.tsx` follow-up schedule preview. Replace with "Final Notice".

### 9. Final Notice escalation feature
New tone option in `AIDraftComposer`: add `"Final Notice"` to TONES array (5 tones now). When selected:
- Tone pill renders in **destructive amber/red** (`bg-amber-500 text-white border-amber-600`) instead of primary blue
- Above the draft, show a warning banner: amber background, AlertTriangle icon, copy: *"This is a final escalation notice. Please review carefully — it signals serious consequences for non-payment and should only be sent after prior reminders."*
- Subject prefix "FINAL NOTICE — " auto-prepended
- Body template tone: formal, references prior reminders, mentions next steps (referral to collections / legal review) — non-legal-advice phrasing
- Send button changes to "Send Final Notice" with amber styling
- Click Send → opens `AlertDialog` confirmation: "Send Final Notice to {client}? This message carries more weight than a regular reminder. Make sure all earlier follow-ups have been sent. [Cancel] [Send Final Notice (destructive)]"
- Edge function: add Final Notice case in system prompt with explicit instructions (firm, formal, references "previous reminders sent on...", mentions "next steps may include referral to a collections agency or further action", does NOT make legal claims)
- Update `DraftTemplates.ts` with a Final Notice template fallback

### 10. Files

**Edited**:
- `src/pages/InvoiceDetailScreen.tsx` — collapsed default, delete button + dialog, color tokens
- `src/components/invoice/ChaseTimeline.tsx` — vertical layout redesign
- `src/components/invoice/AIDraftComposer.tsx` — fix regenerate, add Final Notice tone + confirm dialog, rename Send, color alignment
- `src/components/invoice/DraftTemplates.ts` — add Final Notice template, escalated copy
- `src/components/invoice/NewInvoiceModal.tsx` — MM/DD/YYYY input + calendar picker
- `src/hooks/useSupabaseData.ts` — add `deleteInvoice` helper
- `supabase/functions/generate-followup/index.ts` — temperature, tone-specific prompts, variation seed, previousMessage support, Final Notice case
- `src/pages/OnboardingScreen.tsx` — "Formal Notice" → "Final Notice" if present

### Edge cases
- Deleting an invoice with active follow-ups: ON DELETE CASCADE not set on `followups.invoice_id` — followups will be orphaned. Add cleanup: delete followups first, then invoice (or document as known limitation; no FK exists currently per schema).
- Final Notice send confirmation can't be bypassed accidentally
- Date picker: handle invalid manual entry gracefully (keep input, show no error until submit)
- Regenerate: if AI returns same text by chance, show toast hint "Try a different tone for more variation"

