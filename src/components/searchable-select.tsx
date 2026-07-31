import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
  allLabel?: string;
  className?: string;
}

export function SearchableSelect({
  label,
  options,
  value,
  onChange,
  allLabel = "All",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherValue, setOtherValue] = useState("");

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={cn("h-9 justify-between gap-2 text-xs font-medium", className)}
          >
            <span className="text-muted-foreground">{label}:</span>
            <span className="truncate">{value || allLabel}</span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder={`Search ${label}...`} className="h-9" />
            <CommandList>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    onChange(allLabel);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === allLabel ? "opacity-100" : "opacity-0")} />
                  {allLabel}
                </CommandItem>
                {options.map((opt) => (
                  <CommandItem
                    key={opt}
                    onSelect={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === opt ? "opacity-100" : "opacity-0")} />
                    {opt}
                  </CommandItem>
                ))}
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setOtherOpen(true);
                  }}
                  className="text-muted-foreground"
                >
                  <Check className="mr-2 h-4 w-4 opacity-0" />
                  Other…
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {otherOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-background/60 backdrop-blur-sm"
          onClick={() => setOtherOpen(false)}
        >
          <div className="w-72 rounded-xl border bg-card p-4 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 text-sm font-medium">Enter custom {label}</div>
            <Input
              value={otherValue}
              onChange={(e) => setOtherValue(e.target.value)}
              placeholder={`Custom ${label.toLowerCase()}`}
              autoFocus
            />
            <div className="mt-3 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOtherOpen(false)}>Cancel</Button>
              <Button
                size="sm"
                onClick={() => {
                  if (otherValue.trim()) onChange(otherValue.trim());
                  setOtherOpen(false);
                  setOtherValue("");
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}