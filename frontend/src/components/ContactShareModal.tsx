import { X, Phone } from "lucide-react";
import { OFFICER_CONTACTS } from "@/lib/contacts";

interface ContactShareModalProps {
  title: string;
  onClose: () => void;
}

export function ContactShareModal({ title, onClose }: ContactShareModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-card p-5 shadow-elevated">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {OFFICER_CONTACTS.map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between rounded-xl border border-border bg-background p-3"
            >
              <div>
                <div className="text-sm font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.designation}</div>
                <div className="text-xs text-muted-foreground">{c.mobile}</div>
              </div>
              <a
                href={"tel:" + c.mobile}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                <Phone className="h-3.5 w-3.5" />
                Call
              </a>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Demo contact list. Update with real officer details in lib/contacts.ts.
        </p>
      </div>
    </div>
  );
}