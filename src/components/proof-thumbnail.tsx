import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImageOff } from "lucide-react";

export function ProofThumbnail({ src, alt = "Proof" }: { src?: string | null; alt?: string }) {
  const [open, setOpen] = useState(false);

  if (!src) {
    return (
      <div className="flex h-9 w-12 items-center justify-center rounded-md border bg-muted/30 text-muted-foreground/60" title="No proof attached">
        <ImageOff className="h-3.5 w-3.5" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block h-10 w-14 shrink-0 overflow-hidden rounded-md border bg-muted cursor-pointer"
      >
        <img src={src} alt={alt} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          <img src={src} alt={alt} className="max-h-[80vh] w-full object-contain bg-black" />
        </DialogContent>
      </Dialog>
    </>
  );
}