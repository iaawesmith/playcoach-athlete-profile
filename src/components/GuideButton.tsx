import type { ButtonHTMLAttributes } from "react";

/** Custom documentation control; shares the project's surface tokens. */
export function GuideButton({ className = "", type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase text-on-surface-variant transition-colors hover:bg-surface-container-high focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-container active:scale-95 disabled:opacity-40 ${className}`} {...props} />;
}