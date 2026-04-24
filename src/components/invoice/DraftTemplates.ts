import type { Invoice } from "@/lib/data";

export type Tone = "Polite" | "Friendly" | "Firm" | "Urgent" | "Final Notice";

export const TEMPLATE_COUNT = 5;

function buildTemplates(invoice: Invoice, tone: Tone, senderDisplayName?: string): Array<{ subject: string; message: string }> {
  const { client, id, amount, dueDate, daysPastDue, sentFrom, description } = invoice;
  const amountStr = `$${amount.toLocaleString()}`;
  const senderName = senderDisplayName?.trim()
    ? senderDisplayName.trim().replace(/\b\w/g, (c) => c.toUpperCase())
    : sentFrom.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const overdueStr = daysPastDue > 0 ? ` (${daysPastDue} days ago)` : "";
  const overdueNote = daysPastDue > 0 ? ` and is now ${daysPastDue} days overdue` : "";

  const allTemplates: Record<Tone, Array<{ subject: string; message: string }>> = {
    Polite: [
      {
        subject: `Gentle reminder: Invoice ${id} for ${client}`,
        message: `Dear ${client} team,\n\nI hope this message finds you well. I wanted to kindly follow up regarding invoice ${id} for ${amountStr}, which was due on ${dueDate}${overdueStr}.\n\nIf the payment has already been sent, please disregard this note. Otherwise, I'd be grateful if you could let me know the expected timeline.\n\nThank you for your time.\n\nBest regards,\n${senderName}`,
      },
      {
        subject: `Quick follow-up on Invoice ${id}`,
        message: `Hi ${client},\n\nI just wanted to follow up on invoice ${id} for ${amountStr}, which was due on ${dueDate}. Could you let me know if there's anything I can do to help move this along?\n\nAppreciate your time.\n\nKind regards,\n${senderName}`,
      },
      {
        subject: `Invoice ${id} – following up`,
        message: `Dear ${client} team,\n\nThank you for our continued working relationship. I'm reaching out regarding invoice ${id} for ${amountStr} (due ${dueDate}${daysPastDue > 0 ? `, now ${daysPastDue} days past due` : ""}). I'd appreciate confirmation of the expected payment date at your earliest convenience.\n\nKind regards,\n${senderName}`,
      },
      {
        subject: `Invoice ${id} – just wanted to check in`,
        message: `Dear ${client},\n\nI know how quickly inboxes fill up, so I just wanted to make sure this didn't slip through. Invoice ${id} for ${amountStr} was due on ${dueDate}${overdueStr}.\n\nCompletely fine if payment is already on its way — if there's anything you need from me to process it, don't hesitate to ask. Happy to resend or reformat if that helps.\n\nBest,\n${senderName}`,
      },
      {
        subject: `Quick check — did Invoice ${id} come through?`,
        message: `Hi ${client},\n\nI'm following up to make sure invoice ${id} (${amountStr}, due ${dueDate}) came through without any issues. Sometimes these things get caught in filters or lost in the shuffle.\n\nPlease let me know if you'd like me to resend it, and feel free to reach out if there are any questions about the work or the payment details.\n\nMany thanks,\n${senderName}`,
      },
    ],
    Friendly: [
      {
        subject: `Friendly reminder: Invoice ${id} for ${client}`,
        message: `Hi ${client} team,\n\nI hope you're having a great week!\n\nI'm just sending a quick note to check in on the status of invoice ${id} (${amountStr}) for the ${description.toLowerCase()}, which was due ${dueDate}${daysPastDue > 0 ? ` — ${daysPastDue} days ago` : ""}.\n\nIf you've already sent the payment, please disregard this message. Otherwise, feel free to reach out if you have any questions or need me to resend the payment details.\n\nThanks so much!\n${senderName}`,
      },
      {
        subject: `Quick note about Invoice ${id}`,
        message: `Hey ${client} team!\n\nJust a quick heads-up — invoice ${id} for ${amountStr} is showing as unpaid in my records. No worries if it crossed in the mail, just wanted to flag it!\n\nLet me know if you need me to resend any details.\n\nCheers,\n${senderName}`,
      },
      {
        subject: `Checking in on Invoice ${id}`,
        message: `Hi there,\n\nHope all is going well! Wanted to touch base on invoice ${id} (${amountStr}) from ${dueDate}. If there's anything needed from my end to process this, just say the word.\n\nThanks for working with me!\n${senderName}`,
      },
      {
        subject: `Just a nudge — Invoice ${id} is still open`,
        message: `Hey ${client}!\n\nHope things are going well on your end. Just leaving a friendly nudge — invoice ${id} for ${amountStr} (${description.toLowerCase()}) is still showing as unpaid${daysPastDue > 0 ? `, now ${daysPastDue} days past the due date` : ""}.\n\nNo stress if it's in the pipeline — just didn't want it to get lost.\n\nCheers,\n${senderName}`,
      },
      {
        subject: `Hey — quick one re: Invoice ${id}`,
        message: `Hi ${client},\n\nSuper quick — invoice ${id} for ${amountStr} from ${dueDate} is still sitting open on my end. All good if payment is on its way!\n\nFeel free to ping me if anything comes up.\n\nThanks so much,\n${senderName}`,
      },
    ],
    Firm: [
      {
        subject: `Action required: Overdue invoice ${id}`,
        message: `Dear ${client} team,\n\nI am writing to follow up on invoice ${id} for ${amountStr}, which was due on ${dueDate}${overdueNote}.\n\nDespite previous reminders, I have not yet received payment or a response regarding this invoice. I would appreciate your prompt attention to this matter.\n\nPlease arrange payment at your earliest convenience or contact me to discuss any issues.\n\nRegards,\n${senderName}`,
      },
      {
        subject: `Payment overdue: Invoice ${id} (${amountStr})`,
        message: `Dear ${client} team,\n\nI'm following up again on invoice ${id} for ${amountStr}${daysPastDue > 0 ? `, now ${daysPastDue} days overdue` : `, due ${dueDate}`}.\n\nThis is my second notice. Please remit payment immediately or contact me within 48 hours to confirm a payment date.\n\nRegards,\n${senderName}`,
      },
      {
        subject: `Invoice ${id} – immediate payment required`,
        message: `Dear ${client},\n\nDespite my previous correspondence, invoice ${id} for ${amountStr} (due ${dueDate}) remains unpaid. I require full payment within 5 business days.\n\nIf you dispute any aspect of this invoice, please notify me in writing immediately. Otherwise, please arrange payment without further delay.\n\nRegards,\n${senderName}`,
      },
      {
        subject: `Final courtesy notice: Invoice ${id} (${amountStr})`,
        message: `Dear ${client},\n\nThis is a final courtesy notice regarding invoice ${id} for ${amountStr}, which has been outstanding since ${dueDate}${daysPastDue > 0 ? ` (${daysPastDue} days overdue)` : ""}.\n\nI have made several attempts to resolve this directly. If I do not receive payment or a confirmed payment date within 72 hours, I will need to consider my next steps.\n\nPlease act on this promptly.\n\nRegards,\n${senderName}`,
      },
      {
        subject: `${amountStr} outstanding — Invoice ${id}`,
        message: `Dear ${client},\n\nInvoice ${id} for ${amountStr} remains unpaid${daysPastDue > 0 ? ` after ${daysPastDue} days` : ` since ${dueDate}`}. This is not a reminder — it is a notice that payment is required within 48 hours or this matter will be escalated.\n\nRegards,\n${senderName}`,
      },
    ],
    Urgent: [
      {
        subject: `URGENT: Immediate payment required – Invoice ${id}`,
        message: `Dear ${client} team,\n\nThis is an urgent follow-up regarding invoice ${id} for ${amountStr}, which was due on ${dueDate}${daysPastDue > 0 ? ` and is now ${daysPastDue} days past due` : ""}.\n\nMultiple reminders have been sent without response. If payment is not received within the next 48 hours, I may need to escalate this matter further.\n\nPlease treat this as a priority and confirm payment arrangements immediately.\n\nRegards,\n${senderName}`,
      },
      {
        subject: `Overdue payment notice – Invoice ${id} (${amountStr})`,
        message: `Dear ${client} team,\n\nI need to address the outstanding balance on invoice ${id} for ${amountStr}, due ${dueDate}${daysPastDue > 0 ? ` (${daysPastDue} days past due)` : ""}.\n\nPayment must be received today to avoid further action. Please respond to this email immediately with confirmation of payment or a specific payment date.\n\nThis matter requires your immediate attention.\n\nRegards,\n${senderName}`,
      },
      {
        subject: `[OVERDUE] Invoice ${id} – final warning before escalation`,
        message: `Dear ${client} team,\n\nThis is a formal notice that invoice ${id} for ${amountStr} is${daysPastDue > 0 ? ` ${daysPastDue} days` : ""} overdue and your account is at risk.\n\nI require payment in full within 24 hours. If payment is not received or a payment arrangement is not confirmed by then, I will proceed with escalation without further notice.\n\nRegards,\n${senderName}`,
      },
      {
        subject: `Please respond — Invoice ${id} is critically overdue`,
        message: `Dear ${client} team,\n\nI have not been able to reach anyone regarding invoice ${id} for ${amountStr}${daysPastDue > 0 ? `, which is now ${daysPastDue} days overdue` : `, due ${dueDate}`}.\n\nI'm asking you to respond to this email, call me, or arrange payment today. I need any form of acknowledgment that this is being addressed.\n\nIf I don't hear back within 24 hours, I will proceed with escalation.\n\nRegards,\n${senderName}`,
      },
      {
        subject: `Invoice ${id} — we need to resolve this now`,
        message: `Dear ${client},\n\nI've valued working with you, but the continued non-payment of invoice ${id} for ${amountStr}${daysPastDue > 0 ? ` (${daysPastDue} days overdue)` : ""} is making that difficult to maintain.\n\nI need this resolved within 48 hours. Please confirm payment or contact me immediately to discuss.\n\nRegards,\n${senderName}`,
      },
    ],
    "Final Notice": [
      {
        subject: `FINAL NOTICE — Invoice ${id} (${amountStr}) requires immediate action`,
        message: `Dear ${client} team,\n\nThis is a FINAL NOTICE regarding invoice ${id} for ${amountStr}, originally due on ${dueDate}${daysPastDue > 0 ? ` and now ${daysPastDue} days past due` : ""}.\n\nDespite multiple reminders sent over the past several weeks, this invoice remains unpaid and we have not received a response addressing the outstanding balance.\n\nPlease consider this our final attempt to resolve this matter directly. If full payment is not received within 7 calendar days from the date of this notice, we will have no choice but to consider next steps, which may include referring this account to a third-party collections agency or pursuing other recovery options available to us.\n\nWe would much prefer to resolve this amicably. If there is a reason for the delay or if you would like to discuss a payment arrangement, please contact me immediately so we can avoid further escalation.\n\nThank you for your prompt attention to this matter.\n\nRegards,\n${senderName}`,
      },
      {
        subject: `FINAL NOTICE – Invoice ${id} (${amountStr})`,
        message: `Dear ${client},\n\nThis is your final notice regarding invoice ${id} for ${amountStr}, which remains unpaid${daysPastDue > 0 ? ` (${daysPastDue} days overdue)` : ` as of ${dueDate}`}.\n\nIf payment is not received within 7 days, this account will be referred to a collections agency without further notice.\n\nTo resolve this immediately, please remit payment or contact me within 24 hours.\n\nRegards,\n${senderName}`,
      },
      {
        subject: `FINAL NOTICE: Immediate action required – Invoice ${id}`,
        message: `Dear ${client} team,\n\nThis letter constitutes formal notice that invoice ${id} for ${amountStr} (originally due ${dueDate}) remains outstanding and all prior collection attempts have been exhausted.\n\nUnless full payment is received within 5 business days from this notice, I will engage a third-party collections agency and/or seek legal counsel to recover the outstanding amount plus any applicable fees.\n\nIf you wish to settle this matter directly, please contact me immediately.\n\nRegards,\n${senderName}`,
      },
      {
        subject: `Last chance to resolve Invoice ${id} directly`,
        message: `Dear ${client},\n\nThis is the last notice I'll be sending before handing invoice ${id} (${amountStr}) to a third party.\n\nIf you'd like to resolve this directly — whether that's full payment or a structured arrangement — please contact me within 5 days. After that, I won't be in a position to intervene.\n\nI'd genuinely prefer we handle this between us.\n\nRegards,\n${senderName}`,
      },
      {
        subject: `FINAL NOTICE: Invoice ${id} — ${amountStr} — account referred for collection`,
        message: `Dear ${client},\n\nYou are formally notified that invoice ${id} for ${amountStr}${daysPastDue > 0 ? `, now ${daysPastDue} days past due` : ""}, remains unpaid and all prior resolution attempts have been exhausted.\n\nUnless full payment is received within 5 business days of this notice, your account will be forwarded to a third-party collections agency and all associated fees will become your responsibility.\n\nTo prevent this, contact me immediately.\n\nRegards,\n${senderName}`,
      },
    ],
  };

  return allTemplates[tone];
}

export function getDefaultDraft(invoice: Invoice, tone: Tone, senderDisplayName?: string): { subject: string; message: string } {
  return buildTemplates(invoice, tone, senderDisplayName)[0];
}

export function getTemplateDraft(invoice: Invoice, tone: Tone, index: number, senderDisplayName?: string): { subject: string; message: string } {
  const templates = buildTemplates(invoice, tone, senderDisplayName);
  return templates[index % templates.length];
}
