import { cn } from "../lib/cn";
import { bcls, dsp } from "../lib/helpers";

export default function BallBadge({ o }) {
  return <span className={cn("bl", bcls(o))}>{dsp(o)}</span>;
}
