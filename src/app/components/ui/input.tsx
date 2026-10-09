import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground bg-input-background border-2 border-field-border flex min-h-11 w-full min-w-0 rounded-xl px-3 py-2 text-base font-semibold transition-[color,box-shadow] focus-visible:border-focus disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
