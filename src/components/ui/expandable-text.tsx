import { useState } from "react";
import { Eye, Copy, Check, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ExpandableTextProps {
  text?: string | null;
  maxLength?: number;
  title?: string;
  className?: string;
}

export function ExpandableText({
  text,
  maxLength = 55,
  title = "Full Text Content",
  className = "",
}: ExpandableTextProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!text || text.trim() === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  const isLong = text.length > maxLength;

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <div className="text-xs text-foreground/90 break-words leading-relaxed max-w-[280px]">
        {isLong ? `${text.substring(0, maxLength)}...` : text}
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
        >
          <Eye className="h-3 w-3" />
          <span>Read full ({text.length} chars)</span>
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] rounded-2xl p-0 overflow-hidden border bg-card shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b bg-muted/40">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <FileText className="h-4.5 w-4.5 text-primary" /> {title}
            </DialogTitle>
          </DialogHeader>

          <div className="p-6 overflow-y-auto max-h-[60vh]">
            <div className="rounded-xl border bg-muted/20 p-4 text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans break-words select-text">
              {text}
            </div>
          </div>

          <DialogFooter className="px-6 py-3 border-t bg-muted/20 flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">{text.length} characters</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5 text-xs rounded-xl"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy Text"}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setOpen(false)}
                className="rounded-xl font-bold px-4 text-xs"
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
