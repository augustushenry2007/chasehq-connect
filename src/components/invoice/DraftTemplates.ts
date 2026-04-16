import type { Invoice } from "@/lib/data";

type Tone = "Polite" | "Friendly" | "Firm" | "Urgent";

export function getDefaultDraft(invoice: Invoice, tone: Tone): { subject: string; message: string } {
  const { client, id, amount, dueDate, daysPastDue, sentFrom } = invoice;
  const amountStr = `$${amount.toLocaleString()}`;
  const senderName = sentFrom.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const templates: Record<Tone, { subject: string; message: string }> = {
    Polite: {
      subject: `Gentle reminder: Invoice ${id} for ${client}`,
      message: `Dear ${client} team,\n\nI hope this message finds you well. I wanted to kindly follow up regarding invoice ${id} for ${amountStr}, which was due on ${dueDate}${daysPastDue > 0 ? ` (${daysPastDue} days ago)` : ""}.\n\nIf the payment has already been sent, please disregard this note. Otherwise, I'd be grateful if you could let me know the expected timeline.\n\nThank you for your time.\n\nBest regards,\n${senderName}`,
    },
    Friendly: {
      subject: `Friendly reminder: Invoice ${id} for ${client}`,
      message: `Hi ${client} team,\n\nI hope you're having a great week!\n\nI'm just sending a quick note to check in on the status of invoice ${id} (${amountStr}) for the ${invoice.description.toLowerCase()}, which was due ${dueDate}${daysPastDue > 0 ? ` — ${daysPastDue} days ago` : ""}.\n\nIf you've already sent the payment, please disregard this message. Otherwise, feel free to reach out if you have any questions or need me to resend the payment details.\n\nThanks so much!\n${senderName}`,
    },
    Firm: {
      subject: `Action required: Overdue invoice ${id}`,
      message: `Dear ${client} team,\n\nI am writing to follow up on invoice ${id} for ${amountStr}, which was due on ${dueDate}${daysPastDue > 0 ? ` and is now ${daysPastDue} days overdue` : ""}.\n\nDespite previous reminders, I have not yet received payment or a response regarding this invoice. I would appreciate your prompt attention to this matter.\n\nPlease arrange payment at your earliest convenience or contact me to discuss any issues.\n\nRegards,\n${senderName}`,
    },
    Urgent: {
      subject: `URGENT: Immediate payment required – Invoice ${id}`,
      message: `Dear ${client} team,\n\nThis is an urgent follow-up regarding invoice ${id} for ${amountStr}, which was due on ${dueDate}${daysPastDue > 0 ? ` and is now ${daysPastDue} days past due` : ""}.\n\nMultiple reminders have been sent without response. If payment is not received within the next 48 hours, I may need to escalate this matter further.\n\nPlease treat this as a priority and confirm payment arrangements immediately.\n\nRegards,\n${senderName}`,
    },
  };

  return templates[tone];
}
