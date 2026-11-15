"use client";

import { forwardRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";

type PasswordInputProps = Omit<ComponentProps<"input">, "type"> & {
  toggleLabel?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ toggleLabel = "password", className, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          className={`pe-11 ${className ?? ""}`}
        />
        <button
          type="button"
          aria-label={`${visible ? "Hide" : "Show"} ${toggleLabel}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 end-0 flex w-11 items-center justify-center rounded-e-md text-muted-foreground transition-colors hover:text-brand-olive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-olive"
        >
          {visible ? (
            <EyeOff aria-hidden="true" className="size-4" />
          ) : (
            <Eye aria-hidden="true" className="size-4" />
          )}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";
