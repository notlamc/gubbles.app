import { useId, type InputHTMLAttributes, type ReactNode } from "react";

export function Field({
  label,
  hint,
  error,
  className = "",
  trailing,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode; error?: string; trailing?: ReactNode }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className="block text-sm font-bold text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
          className={`h-12 w-full rounded-2xl border bg-night-950/60 px-4 text-base text-ink placeholder:text-faint transition focus:border-sun-300 focus:outline-none focus:ring-2 focus:ring-sun-300/40 ${
            error ? "border-danger-400/70" : "border-white/12"
          } ${trailing ? "pr-24" : ""}`}
          {...props}
        />
        {trailing ? <div className="absolute inset-y-0 right-2 flex items-center">{trailing}</div> : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-faint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errId} role="alert" className="text-sm font-semibold text-danger-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
