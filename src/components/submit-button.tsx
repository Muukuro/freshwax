"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  pendingLabel = "Working...",
  className = "",
  ...props
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { pending } = useFormStatus();

  return (
    <button className={className} type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingLabel : children}
    </button>
  );
}
