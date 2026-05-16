import type { Invoice } from "@/lib/data";
import type { UserProfile } from "@/lib/userProfile/types";
import { getRegisterTokens, type RegisterTokens } from "./templateRegister";

export type Tone = "Friendly" | "Firm" | "Urgent" | "Final Notice";

export const TEMPLATE_COUNT = 5;

function computeDaysUntilDue(dueDateISO: string): number {
  const due = new Date(dueDateISO + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

function buildTemplates(
  invoice: Invoice,
  tone: Tone,
  senderDisplayName?: string,
  profile?: UserProfile,
): Array<{ subject: string; message: string }> {
  const { client, id, amount, dueDate, dueDateISO, sentFrom, description } = invoice;
  const amountStr = `$${amount.toLocaleString()}`;
  const senderName = senderDisplayName?.trim()
    ? senderDisplayName.trim().replace(/\b\w/g, (c) => c.toUpperCase())
    : sentFrom.split("@")[0].replace(/\./g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Register tokens drive greeting + sign-off variation by tone tier and work type.
  // Pronoun (I vs. we) is intentionally not substituted in static templates — the
  // English contraction matrix ("I'm" vs "We're") is too risky to handle here.
  // Pronoun differentiation lives in the AI prompt path instead.
  const tokens: RegisterTokens = getRegisterTokens(profile ?? {}, tone);
  const greetTeam = tokens.greetingTeam(client);
  const greetPerson = tokens.greetingPerson(client);
  const signOffFriendly = tokens.signoffFriendly;
  const signOffFormal = tokens.signoffFormal;

  const daysUntilDue = computeDaysUntilDue(dueDateISO);
  const isOverdue = daysUntilDue < 0;
  const daysOverdue = isOverdue ? -daysUntilDue : 0;
  const dueIsToday = daysUntilDue === 0;

  const wasOrIs = isOverdue ? "was due" : "is due";
  const daysPl = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
  const overdueNote = isOverdue
    ? ` and is now ${daysPl(daysOverdue)} overdue`
    : dueIsToday ? ", which is due today" : "";
  const pastDueRef = isOverdue
    ? `, now ${daysPl(daysOverdue)} overdue`
    : dueIsToday ? ", which is due today" : `, due ${dueDate}`;

  const allTemplates: Record<Tone, Array<{ subject: string; message: string }>> = {
    Friendly: [
      {
        subject: `Friendly reminder: Invoice ${id} for ${client}`,
        message: `${greetTeam}\n\nI hope you're having a great week!\n\nI'm just sending a quick note about invoice ${id} (${amountStr}) for the ${description.toLowerCase()}, which ${wasOrIs} due on ${dueDate}${isOverdue ? ` — ${daysPl(daysOverdue)} ago` : ""}.\n\nIf you've already sent the payment, please disregard this message. Otherwise, feel free to reach out if you have any questions or need me to resend the payment details.\n\n${signOffFriendly},\n${senderName}`,
      },
      {
        subject: `Quick note about Invoice ${id}`,
        message: `${greetTeam}\n\nJust a quick heads-up — invoice ${id} for ${amountStr} is showing as unpaid in my records${isOverdue ? ` and is now ${daysPl(daysOverdue)} past the due date` : dueIsToday ? " and is due today" : ""}. No worries if it's already in process — just wanted to flag it!\n\nLet me know if you need me to resend any details.\n\n${signOffFriendly},\n${senderName}`,
      },
      {
        subject: `Checking in on Invoice ${id}`,
        message: `${greetPerson}\n\nHope all is going well! Wanted to touch base on invoice ${id} (${amountStr}) — due${dueIsToday ? " today" : ` on ${dueDate}`}${isOverdue ? `, now ${daysPl(daysOverdue)} overdue` : ""}. If there's anything needed from my end to process this, just say the word.\n\n${signOffFriendly},\n${senderName}`,
      },
      {
        subject: isOverdue ? `Just a nudge — Invoice ${id} is still open` : `Heads-up: Invoice ${id} is due ${dueIsToday ? "today" : `on ${dueDate}`}`,
        message: `${greetPerson}\n\nHope things are going well on your end. Just leaving a friendly nudge — invoice ${id} for ${amountStr} (${description.toLowerCase()}) is still unpaid${isOverdue ? `, now ${daysPl(daysOverdue)} past the due date` : dueIsToday ? " and is due today" : ` with a due date of ${dueDate}`}.\n\nNo stress if it's in the pipeline — just didn't want it to get lost.\n\n${signOffFriendly},\n${senderName}`,
      },
      {
        subject: `Quick one re: Invoice ${id}`,
        message: `${greetPerson}\n\nSuper quick — invoice ${id} for ${amountStr} is ${isOverdue ? `${daysPl(daysOverdue)} past due (was due ${dueDate})` : dueIsToday ? `due today (${dueDate})` : `due on ${dueDate}`}. ${isOverdue ? "All good if payment is on its way!" : "Please make sure payment is on track!"}\n\nFeel free to ping me if anything comes up.\n\n${signOffFriendly},\n${senderName}`,
      },
    ],
    Firm: [
      {
        subject: isOverdue
          ? `Action required: Invoice ${id} is overdue`
          : dueIsToday
          ? `Payment due today: Invoice ${id}`
          : `Upcoming payment: Invoice ${id} due ${dueDate}`,
        message: isOverdue
          ? `${greetTeam}\n\nI am writing to follow up on invoice ${id} for ${amountStr}, which was due on ${dueDate}${overdueNote}.\n\nThis invoice remains outstanding. Please arrange payment at your earliest convenience or contact me to discuss any issues.\n\n${signOffFormal},\n${senderName}`
          : dueIsToday
          ? `${greetTeam}\n\nThis is a reminder that invoice ${id} for ${amountStr} (${description.toLowerCase()}) is due today.\n\nPlease arrange payment today. If you have any questions or need payment details resent, I'm happy to help.\n\n${signOffFormal},\n${senderName}`
          : `${greetTeam}\n\nI am writing to follow up on invoice ${id} for ${amountStr} (${description.toLowerCase()}), which is due on ${dueDate}.\n\nPlease ensure payment is arranged by the due date. If you have any questions or need any additional details, don't hesitate to reach out.\n\n${signOffFormal},\n${senderName}`,
      },
      {
        subject: isOverdue
          ? `Payment overdue: Invoice ${id} (${amountStr})`
          : `Payment reminder: Invoice ${id} (${amountStr})`,
        message: `${greetTeam}\n\nI'm following up on invoice ${id} for ${amountStr}${pastDueRef}.\n\n${isOverdue ? "Please remit payment immediately or contact me within 48 hours to confirm a payment date." : "Please ensure payment is processed by the due date. Contact me if you have any questions."}\n\n${signOffFormal},\n${senderName}`,
      },
      {
        subject: isOverdue
          ? `Invoice ${id} – immediate payment required`
          : `Pre-due notice: Invoice ${id}`,
        message: isOverdue
          ? `${greetPerson}\n\nInvoice ${id} for ${amountStr} (due ${dueDate}) remains unpaid. I require full payment within 5 business days.\n\nIf you dispute any aspect of this invoice, please notify me in writing immediately. Otherwise, please arrange payment without further delay.\n\n${signOffFormal},\n${senderName}`
          : `${greetPerson}\n\nI'm writing in advance to ensure invoice ${id} for ${amountStr} (${description.toLowerCase()}) is on your radar ahead of the due date (${dueDate}).\n\nPlease confirm that payment will be processed on time. If there are any questions or issues with this invoice, please let me know promptly.\n\n${signOffFormal},\n${senderName}`,
      },
      {
        subject: isOverdue
          ? `Final courtesy notice: Invoice ${id} (${amountStr})`
          : `Payment confirmation request: Invoice ${id} (${amountStr})`,
        message: isOverdue
          ? `${greetPerson}\n\nThis is a final courtesy notice regarding invoice ${id} for ${amountStr}, outstanding since ${dueDate} (${daysPl(daysOverdue)} overdue).\n\nIf I do not receive payment or a confirmed payment date within 72 hours, I will need to consider my next steps.\n\nPlease act on this promptly.\n\n${signOffFormal},\n${senderName}`
          : `${greetPerson}\n\nPlease treat this as a formal notice that invoice ${id} for ${amountStr} is due on ${dueDate}.\n\nI'd appreciate confirmation that payment is scheduled and will be processed on time. If there are any concerns, please reach out immediately.\n\n${signOffFormal},\n${senderName}`,
      },
      {
        subject: `${amountStr} outstanding — Invoice ${id}`,
        message: isOverdue
          ? `${greetPerson}\n\nInvoice ${id} for ${amountStr} remains unpaid after ${daysPl(daysOverdue)}. Payment is required within 48 hours or this matter will be escalated.\n\n${signOffFormal},\n${senderName}`
          : dueIsToday
          ? `${greetPerson}\n\nInvoice ${id} for ${amountStr} is due today. Please arrange payment immediately or contact me to confirm timing.\n\n${signOffFormal},\n${senderName}`
          : `${greetPerson}\n\nInvoice ${id} for ${amountStr} is due on ${dueDate}. Please ensure this is paid on time — I'm flagging it now so there are no last-minute delays.\n\n${signOffFormal},\n${senderName}`,
      },
    ],
    Urgent: [
      {
        subject: isOverdue
          ? `URGENT: Immediate payment required – Invoice ${id}`
          : dueIsToday
          ? `URGENT: Invoice ${id} is due today — please confirm payment`
          : `URGENT: Invoice ${id} due ${dueDate} — please confirm`,
        message: isOverdue
          ? `${greetTeam}\n\nThis is an urgent follow-up regarding invoice ${id} for ${amountStr}, which was due on ${dueDate} and is now ${daysPl(daysOverdue)} past due.\n\nThis invoice requires immediate attention. If payment is not received within the next 48 hours, I may need to escalate this matter further.\n\nPlease treat this as a priority and confirm payment arrangements immediately.\n\n${signOffFormal},\n${senderName}`
          : dueIsToday
          ? `${greetTeam}\n\nThis is an urgent reminder that invoice ${id} for ${amountStr} is due today.\n\nPlease arrange payment immediately and confirm once processed. If there are any issues, contact me now.\n\n${signOffFormal},\n${senderName}`
          : `${greetTeam}\n\nThis is an urgent reminder that invoice ${id} for ${amountStr} (${description.toLowerCase()}) is due on ${dueDate}.\n\nI need confirmation that payment will be processed on time. Please respond to this message immediately — if there are any issues with this invoice, I need to know now, not after the due date.\n\n${signOffFormal},\n${senderName}`,
      },
      {
        subject: isOverdue
          ? `Overdue payment notice – Invoice ${id} (${amountStr})`
          : `Payment due notice – Invoice ${id} (${amountStr})`,
        message: isOverdue
          ? `${greetTeam}\n\nI need to address the outstanding balance on invoice ${id} for ${amountStr}, due ${dueDate} (${daysPl(daysOverdue)} past due).\n\nPayment must be received without further delay to avoid escalation. Please respond immediately with confirmation of payment or a specific payment date.\n\n${signOffFormal},\n${senderName}`
          : dueIsToday
          ? `${greetTeam}\n\nPayment on invoice ${id} for ${amountStr} is due today. Please confirm that payment has been arranged or is being processed now.\n\nThis matter requires your immediate attention.\n\n${signOffFormal},\n${senderName}`
          : `${greetTeam}\n\nThis is an urgent notice that invoice ${id} for ${amountStr} is due on ${dueDate}.\n\nPlease confirm immediately that payment is scheduled. If there are any blockers on your end, I need to know now — not after the due date has passed.\n\n${signOffFormal},\n${senderName}`,
      },
      {
        subject: isOverdue
          ? `[OVERDUE] Invoice ${id} – final warning before escalation`
          : `[URGENT] Invoice ${id} – payment required by ${dueDate}`,
        message: isOverdue
          ? `${greetTeam}\n\nThis is a formal notice that invoice ${id} for ${amountStr} is ${daysPl(daysOverdue)} overdue.\n\nI require payment in full within 24 hours. If payment is not received or a payment arrangement is not confirmed by then, I will proceed with escalation without further notice.\n\n${signOffFormal},\n${senderName}`
          : `${greetTeam}\n\nThis is a formal notice that invoice ${id} for ${amountStr} must be paid in full by ${dueDate}.\n\nPlease confirm that payment is on schedule. If there are any issues, I need to hear from you immediately — failure to respond before the due date will result in escalation.\n\n${signOffFormal},\n${senderName}`,
      },
      {
        subject: isOverdue
          ? `Please respond — Invoice ${id} is critically overdue`
          : `Please respond — Invoice ${id} requires attention`,
        message: isOverdue
          ? `${greetTeam}\n\nI have not been able to reach anyone regarding invoice ${id} for ${amountStr}, which is now ${daysPl(daysOverdue)} overdue.\n\nI'm asking you to respond to this email, call me, or arrange payment today. I need acknowledgment that this is being addressed.\n\nIf I don't hear back within 24 hours, I will proceed with escalation.\n\n${signOffFormal},\n${senderName}`
          : dueIsToday
          ? `${greetTeam}\n\nI have not yet received confirmation that invoice ${id} for ${amountStr} will be paid today as due.\n\nPlease respond immediately with confirmation. If there are any issues, contact me now.\n\n${signOffFormal},\n${senderName}`
          : `${greetTeam}\n\nI have not yet received confirmation that invoice ${id} for ${amountStr}, due ${dueDate}, will be paid on time.\n\nPlease respond with confirmation before the due date. If I don't hear back, I will follow up immediately on ${dueDate}.\n\n${signOffFormal},\n${senderName}`,
      },
      {
        subject: isOverdue
          ? `Invoice ${id} — we need to resolve this now`
          : `Invoice ${id} — payment due ${dueDate}`,
        message: isOverdue
          ? `${greetPerson}\n\nI've valued working with you, but the non-payment of invoice ${id} for ${amountStr} (${daysPl(daysOverdue)} overdue) is making that difficult to maintain.\n\nI need this resolved within 48 hours. Please confirm payment or contact me immediately to discuss.\n\n${signOffFormal},\n${senderName}`
          : `${greetPerson}\n\nI value our working relationship and want to ensure invoice ${id} for ${amountStr} is settled on time (due ${dueDate}).\n\nPlease confirm that payment is being processed. If anything is preventing timely payment, let's discuss it immediately — I'd much rather resolve this directly before the due date.\n\n${signOffFormal},\n${senderName}`,
      },
    ],
    "Final Notice": [
      {
        subject: `FINAL NOTICE — Invoice ${id} (${amountStr}) requires immediate action`,
        message: isOverdue
          ? `${greetTeam}\n\nThis is a FINAL NOTICE regarding invoice ${id} for ${amountStr}, originally due on ${dueDate} and now ${daysPl(daysOverdue)} past due.\n\nThis invoice remains unpaid and we have not received a response addressing the outstanding balance. Please consider this our final attempt to resolve this matter directly. If full payment is not received within 7 calendar days, we will have no choice but to consider next steps, which may include referring this account to a third-party collections agency.\n\nWe would much prefer to resolve this amicably. If there is a reason for the delay or if you would like to discuss a payment arrangement, please contact me immediately.\n\nThank you for your prompt attention to this matter.\n\n${signOffFormal},\n${senderName}`
          : dueIsToday
          ? `${greetTeam}\n\nThis is a FINAL NOTICE regarding invoice ${id} for ${amountStr}, which is due today.\n\nPayment must be received today. If full payment is not received by end of business today, I will have no choice but to proceed with escalation, which may include referral to a third-party collections agency.\n\nIf there is any reason for a delay or you wish to discuss a payment arrangement, please contact me immediately.\n\nThank you for your prompt attention.\n\n${signOffFormal},\n${senderName}`
          : `${greetTeam}\n\nThis is a FINAL NOTICE regarding invoice ${id} for ${amountStr}, which is due on ${dueDate}.\n\nPayment is expected in full by ${dueDate}. If payment is not received by the due date, I will proceed with next steps, which may include referral to a third-party collections agency.\n\nIf there is any reason you will be unable to pay by ${dueDate}, please contact me immediately to discuss arrangements.\n\nThank you for your prompt attention to this matter.\n\n${signOffFormal},\n${senderName}`,
      },
      {
        subject: `FINAL NOTICE – Invoice ${id} (${amountStr})`,
        message: isOverdue
          ? `${greetPerson}\n\nThis is your final notice regarding invoice ${id} for ${amountStr}, which remains unpaid (${daysPl(daysOverdue)} overdue).\n\nIf payment is not received within 7 days, this account will be referred to a collections agency without further notice.\n\nTo resolve this immediately, please remit payment or contact me within 24 hours.\n\n${signOffFormal},\n${senderName}`
          : `${greetPerson}\n\nThis is a final notice regarding invoice ${id} for ${amountStr}, due on ${dueDate}.\n\nFull payment is required by the due date. If payment is not received by ${dueDate}, this account will be escalated and may be referred to a collections agency.\n\nTo avoid escalation, please confirm payment by responding to this email now.\n\n${signOffFormal},\n${senderName}`,
      },
      {
        subject: `FINAL NOTICE: Immediate action required – Invoice ${id}`,
        message: isOverdue
          ? `${greetTeam}\n\nThis letter constitutes formal notice that invoice ${id} for ${amountStr} (originally due ${dueDate}) remains outstanding.\n\nUnless full payment is received within 5 business days, I will engage a third-party collections agency and/or seek legal counsel to recover the outstanding amount plus any applicable fees.\n\nIf you wish to settle this matter directly, please contact me immediately.\n\n${signOffFormal},\n${senderName}`
          : `${greetTeam}\n\nThis letter constitutes formal notice that invoice ${id} for ${amountStr} must be paid in full by ${dueDate}.\n\nIf payment is not received by the due date, I will proceed with formal collection proceedings, which may include a third-party agency and associated cost recovery.\n\nIf you wish to resolve this directly before the due date, please contact me immediately.\n\n${signOffFormal},\n${senderName}`,
      },
      {
        subject: isOverdue
          ? `Last chance to resolve Invoice ${id} directly`
          : `Last chance to settle Invoice ${id} before ${dueDate}`,
        message: isOverdue
          ? `${greetPerson}\n\nThis is the last notice I'll be sending before handing invoice ${id} (${amountStr}) to a third party.\n\nIf you'd like to resolve this directly — whether that's full payment or a structured arrangement — please contact me within 5 days. After that, I won't be in a position to intervene.\n\nI'd genuinely prefer we handle this between us.\n\n${signOffFormal},\n${senderName}`
          : `${greetPerson}\n\nThis is the final notice before invoice ${id} (${amountStr}) is escalated. Payment is due on ${dueDate}.\n\nIf you'd like to resolve this directly by confirming payment or arranging terms, please contact me before ${dueDate}. After the due date, I will not be in a position to prevent escalation.\n\n${signOffFormal},\n${senderName}`,
      },
      {
        subject: isOverdue
          ? `FINAL NOTICE: Invoice ${id} — ${amountStr} — account referred for collection`
          : `FINAL NOTICE: Invoice ${id} — ${amountStr} — action required by ${dueDate}`,
        message: isOverdue
          ? `${greetPerson}\n\nYou are formally notified that invoice ${id} for ${amountStr}, now ${daysPl(daysOverdue)} past due, remains unpaid.\n\nUnless full payment is received within 5 business days, your account will be forwarded to a third-party collections agency and all associated fees will become your responsibility.\n\nTo prevent this, contact me immediately.\n\n${signOffFormal},\n${senderName}`
          : `${greetPerson}\n\nYou are formally notified that invoice ${id} for ${amountStr} is due on ${dueDate}.\n\nFull payment must be received by ${dueDate}. Failure to pay by the due date will result in immediate referral to a third-party collections agency, and all associated fees will become your responsibility.\n\nTo prevent this, please confirm payment before the due date.\n\n${signOffFormal},\n${senderName}`,
      },
    ],
  };

  return allTemplates[tone];
}

export function getDefaultDraft(invoice: Invoice, tone: Tone, senderDisplayName?: string, profile?: UserProfile): { subject: string; message: string } {
  return buildTemplates(invoice, tone, senderDisplayName, profile)[0];
}

export function getTemplateDraft(invoice: Invoice, tone: Tone, index: number, senderDisplayName?: string, profile?: UserProfile): { subject: string; message: string } {
  const templates = buildTemplates(invoice, tone, senderDisplayName, profile);
  return templates[index % templates.length];
}
