import { cn } from "../../lib/cn";

/* variant: "" | "g" | "red" | "ghost"; size: "" | "sm" */
export default function Button({ variant = "", size = "", className, children, ...rest }) {
  return (
    <button className={cn("bt", variant, size, className)} {...rest}>
      {children}
    </button>
  );
}
