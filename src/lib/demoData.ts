import type { Invoice } from "@/lib/data";
import type { User } from "@supabase/supabase-js";

export const DEMO_USER = {
  id: "demo-user-00000000",
  email: "alex@morgandesigns.co",
  user_metadata: { avatar_url: "", full_name: "Alex Morgan", name: "Alex Morgan" },
  app_metadata: {},
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00.000Z",
} as unknown as User;

export const DEMO_FULL_NAME = "Alex Morgan";

const PAY = "Bank transfer — BSB 062-000 · Account 1234 5678 (Ref: invoice number)";
const FROM = "alex@morgandesigns.co";

export const DEMO_INVOICES: Invoice[] = [
  {
    id: "INV-001", dbId: "demo-db-001",
    client: "Foxwell Media", clientEmail: "accounts@foxwellmedia.com",
    description: "Social Media Campaign — Q1 Package",
    amount: 3200, dueDate: "Apr 4, 2026", dueDateISO: "2026-04-04",
    createdAtISO: "2026-03-20T09:00:00.000Z",
    status: "Escalated", daysPastDue: 31, sentFrom: FROM, paymentDetails: PAY,
  },
  {
    id: "INV-004", dbId: "demo-db-004",
    client: "Meridian Studio", clientEmail: "billing@meridianstudio.io",
    description: "Brand Identity Package",
    amount: 4800, dueDate: "Apr 21, 2026", dueDateISO: "2026-04-21",
    createdAtISO: "2026-04-01T09:00:00.000Z",
    status: "Overdue", daysPastDue: 14, sentFrom: FROM, paymentDetails: PAY,
  },
  {
    id: "INV-006", dbId: "demo-db-006",
    client: "Peak Digital", clientEmail: "hello@peakdigital.co",
    description: "SEO Audit & Strategy Report",
    amount: 2200, dueDate: "Apr 28, 2026", dueDateISO: "2026-04-28",
    createdAtISO: "2026-04-10T09:00:00.000Z",
    status: "Overdue", daysPastDue: 7, sentFrom: FROM, paymentDetails: PAY,
  },
  {
    id: "INV-008", dbId: "demo-db-008",
    client: "Juniper Labs", clientEmail: "finance@juniperlabs.dev",
    description: "UI/UX Consultation — Sprint 3",
    amount: 2750, dueDate: "May 3, 2026", dueDateISO: "2026-05-03",
    createdAtISO: "2026-04-15T09:00:00.000Z",
    status: "Follow-up", daysPastDue: 2, sentFrom: FROM, paymentDetails: PAY,
  },
  {
    id: "INV-009", dbId: "demo-db-009",
    client: "Callum Reid", clientEmail: "callum@reiddesign.co",
    description: "Logo Refresh & Brand Guidelines",
    amount: 950, dueDate: "May 12, 2026", dueDateISO: "2026-05-12",
    createdAtISO: "2026-04-20T09:00:00.000Z",
    status: "Upcoming", daysPastDue: 0, sentFrom: FROM, paymentDetails: PAY,
  },
  {
    id: "INV-010", dbId: "demo-db-010",
    client: "Harlow & Sons", clientEmail: "admin@harlowandsons.com.au",
    description: "Commercial Photography Session",
    amount: 1800, dueDate: "May 19, 2026", dueDateISO: "2026-05-19",
    createdAtISO: "2026-04-22T09:00:00.000Z",
    status: "Upcoming", daysPastDue: 0, sentFrom: FROM, paymentDetails: PAY,
  },
  {
    id: "INV-002", dbId: "demo-db-002",
    client: "Vesper Agency", clientEmail: "ops@vesperagency.com",
    description: "Full Rebrand — Identity, Web & Print",
    amount: 11200, dueDate: "Mar 15, 2026", dueDateISO: "2026-03-15",
    createdAtISO: "2026-02-15T09:00:00.000Z",
    status: "Paid", daysPastDue: 0, sentFrom: FROM, paymentDetails: PAY,
  },
  {
    id: "INV-003", dbId: "demo-db-003",
    client: "Nora Creative Co.", clientEmail: "nora@noracreative.co",
    description: "Web Design & Development",
    amount: 6500, dueDate: "Mar 28, 2026", dueDateISO: "2026-03-28",
    createdAtISO: "2026-02-28T09:00:00.000Z",
    status: "Paid", daysPastDue: 0, sentFrom: FROM, paymentDetails: PAY,
  },
];
