import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-[11px] font-semibold leading-none text-muted-foreground", className)}
      {...props}
    />
  );
}
