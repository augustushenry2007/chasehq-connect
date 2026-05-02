// Shared zod schemas for client-side input validation.
import { z } from "zod";

// Invoice creation: positive amount, valid email (or empty), well-formed date
// (past dates allowed for back-dated invoices), length-bounded text fields.
export const newInvoiceSchema = z.object({
  client: z
    .string()
    .trim()
    .min(1, { message: "Client name is required." })
    .max(120, { message: "Client name must be under 120 characters." }),
  clientEmail: z
    .string()
    .trim()
    .max(254, { message: "Email is too long." })
    .email({ message: "Enter a valid email address." })
    .or(z.literal("")),
  description: z
    .string()
    .trim()
    .max(500, { message: "Description must be under 500 characters." }),
  amount: z
    .number({ invalid_type_error: "Amount must be a number." })
    .finite({ message: "Amount must be a number." })
    .gt(0, { message: "Amount must be greater than 0." })
    .lte(10_000_000, { message: "Amount is too large." }),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Invalid date." }),
});

export type NewInvoiceInput = z.infer<typeof newInvoiceSchema>;
