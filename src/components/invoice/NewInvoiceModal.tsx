import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { createInvoice } from "@/hooks/useSupabaseData";
import { X } from "lucide-react";
import { toast } from "sonner";

export default function NewInvoiceModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user } = useApp();
  const [client, setClient] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [creating, setCreating] = useState(false);

  if (!visible) return null;

  async function handleCreate() {
    if (!user) { toast.error("Not signed in"); return; }
    if (!client || !amount || !dueDate) { toast.error("Fill in required fields"); return; }
    setCreating(true);
    const result = await createInvoice(user.id, {
      client,
      clientEmail: email,
      description,
      amount: parseFloat(amount),
      dueDate,
    });
    setCreating(false);
    if (result) {
      setClient(""); setEmail(""); setDescription(""); setAmount(""); setDueDate("");
      onCreated();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center" onClick={onClose}>
      <div className="bg-background w-full max-w-lg rounded-t-2xl p-5 pb-8 max-h-[85vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">New Invoice</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="flex flex-col gap-3.5">
          {[
            { label: "Client name *", value: client, onChange: setClient, placeholder: "Apex Digital", type: "text" },
            { label: "Client email", value: email, onChange: setEmail, placeholder: "billing@client.com", type: "email" },
            { label: "Description", value: description, onChange: setDescription, placeholder: "Brand identity & logo system", type: "text" },
            { label: "Amount ($) *", value: amount, onChange: setAmount, placeholder: "4800", type: "number" },
            { label: "Due date *", value: dueDate, onChange: setDueDate, placeholder: "2024-06-15", type: "date" },
          ].map((f) => (
            <div key={f.label}>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{f.label}</label>
              <input
                value={f.value}
                onChange={(e) => f.onChange(e.target.value)}
                placeholder={f.placeholder}
                type={f.type}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-muted text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ))}
          <button
            onClick={handleCreate}
            disabled={!client || !amount || !dueDate || creating}
            className="mt-2 w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
