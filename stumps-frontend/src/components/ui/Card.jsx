import { cn } from "../../lib/cn";

export default function Card({ title, className, children, ...rest }) {
  return (
    <div className={cn("card", className)} {...rest}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  );
}
