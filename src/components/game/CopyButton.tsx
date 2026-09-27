"use client";

import { useState } from "react";
import { Icon } from "@/components/icons";
import { buttonClass } from "@/components/ui/button";

export function CopyButton({ text, label = "Copy", className = "" }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("secondary", "md", className)}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          window.prompt("Copy this link:", text);
        }
      }}
    >
      {copied ? <Icon.Check className="h-4 w-4 text-mint-300" /> : <Icon.Copy className="h-4 w-4" />}
      <span aria-live="polite">{copied ? "Copied!" : label}</span>
    </button>
  );
}
