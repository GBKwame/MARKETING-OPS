import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface Option { value: string; label: string }

export function MultiSelect({
  label,
  options,
  values,
  onChange,
  className,
}: {
  label: string;
  options: Option[];
  values: string[];
  onChange: (v: string[]) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (v: string) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);

  const selected = options.filter((o) => values.includes(o.value));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("h-9 justify-between gap-2 text-xs font-medium", className)}>
          <span className="text-muted-foreground">{label}:</span>
          {selected.length === 0 ? (
            <span>All</span>
          ) : selected.length <= 2 ? (
            <span className="flex gap-1">
              {selected.map((s) => (
                <Badge key={s.value} variant="secondary" className="h-5 px-1.5 text-[10px]">{s.label}</Badge>
              ))}
            </span>
          ) : (
            <span>{selected.length} selected</span>
          )}
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={`Search ${label}...`} className="h-9" />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const active = values.includes(o.value);
                return (
                  <CommandItem key={o.value} onSelect={() => toggle(o.value)}>
                    <Check className={cn("mr-2 h-4 w-4", active ? "opacity-100" : "opacity-0")} />
                    {o.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {values.length > 0 && (
            <div className="border-t p-2">
              <Button size="sm" variant="ghost" className="h-7 w-full text-xs" onClick={() => onChange([])}>
                <X className="mr-1 h-3 w-3" /> Clear
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}