import { useEffect, useRef, useState } from "react";
import { Ban, CircleDot, Flame, Sparkles, Zap } from "lucide-react";
import { useI18n } from "../contexts/LanguageContext";
import { cn } from "../lib/utils";

const MOMENTS = {
  "6": {
    key: "six",
    titleKey: "moment.six",
    subtitleKey: "moment.sixSub",
    icon: Flame,
    tone: "from-lime/30 via-mint/15 to-transparent border-lime/40 text-lime",
    chip: "bg-lime text-ink-950",
  },
  "4": {
    key: "four",
    titleKey: "moment.four",
    subtitleKey: "moment.fourSub",
    icon: Zap,
    tone: "from-sky/30 via-sky/10 to-transparent border-sky/40 text-sky",
    chip: "bg-sky text-ink-950",
  },
  W: {
    key: "out",
    titleKey: "moment.out",
    subtitleKey: "moment.outSub",
    icon: Ban,
    tone: "from-coral/30 via-coral/10 to-transparent border-coral/40 text-coral",
    chip: "bg-coral text-white",
  },
  nb: {
    key: "noball",
    titleKey: "moment.noBall",
    subtitleKey: "moment.noBallSub",
    icon: Sparkles,
    tone: "from-amber-400/30 via-amber-300/10 to-transparent border-amber-400/40 text-amber-400",
    chip: "bg-amber-400 text-ink-950",
  },
  wd: {
    key: "wide",
    titleKey: "moment.wide",
    subtitleKey: "moment.wideSub",
    icon: CircleDot,
    tone: "from-amber-400/30 via-amber-300/10 to-transparent border-amber-400/40 text-amber-400",
    chip: "bg-amber-400 text-ink-950",
  },
  w: {
    key: "wicket",
    titleKey: "moment.out",
    subtitleKey: "moment.outSub",
    icon: Ban,
    tone: "from-coral/30 via-coral/10 to-transparent border-coral/40 text-coral",
    chip: "bg-coral text-white",
  },
};

const momentFor = (ball) => {
  if (!ball) return null;
  const label = String(ball.label || "").toLowerCase();
  if (ball.isWicket || label === "w" || label.startsWith("w")) return MOMENTS.W;
  if (label === "6" || ball.runs === 6) return MOMENTS["6"];
  if (label === "4" || ball.runs === 4) return MOMENTS["4"];
  if (label.includes("nb")) return MOMENTS.nb;
  if (label.includes("wd")) return MOMENTS.wd;
  return null;
};

const keyOf = (innings, ball) =>
  `${innings?.number ?? 0}-${ball?.over ?? 0}-${ball?.ball ?? 0}-${ball?.label ?? ""}`;

export default function BallMoment({ match, className = "" }) {
  const { t } = useI18n();
  const innings = match?.innings?.[match.currentInnings];
  const over = innings?.oversDetail?.at(-1);
  const lastBall = over?.balls?.at(-1);
  const [moment, setMoment] = useState(null);
  const [confetti, setConfetti] = useState(false);
  const previous = useRef("");
  const timer = useRef(null);

  useEffect(() => {
    if (!lastBall) return;
    const key = keyOf(innings, lastBall);
    if (!previous.current) {
      previous.current = key;
      return;
    }
    if (previous.current === key) return;
    previous.current = key;
    const next = momentFor(lastBall);
    if (!next) return;
    setMoment({ ...next, ball: lastBall, innings: innings?.number });
    setConfetti(next.key === "six" || next.key === "four");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setMoment(null);
      setConfetti(false);
    }, 2600);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyOf(innings, lastBall)]);

  useEffect(() => () => clearTimeout(timer.current), []);

  if (!moment) return null;
  const Icon = moment.icon;

  return (
    <div className={cn("pointer-events-none fixed inset-x-0 bottom-6 z-[75] flex justify-center px-4 sm:bottom-10", className)}>
      <div className="animate-ball-pop relative overflow-hidden rounded-3xl border border-white/15 bg-ink-950/95 px-6 py-4 text-white shadow-[0_30px_90px_-20px_rgba(0,0,0,.85)] backdrop-blur-xl">
        <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-95", moment.tone)} />
        {confetti && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 14 }).map((_, index) => (
              <span
                key={index}
                className="animate-confetti absolute top-0 h-2 w-1 rounded-sm"
                style={{
                  left: `${8 + index * 6.5}%`,
                  background: index % 3 === 0 ? "#c8ff3d" : index % 3 === 1 ? "#00e28a" : "#5cc8ff",
                  animationDelay: `${index * 40}ms`,
                  "--drift": `${(index % 2 ? 1 : -1) * (12 + index * 3)}px`,
                }}
              />
            ))}
          </div>
        )}
        <div className="relative flex items-center gap-4">
          <span className={cn("grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-xl font-black shadow-lg", moment.chip)}>
            {moment.ball?.label?.toUpperCase() || <Icon size={22} />}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-display text-2xl font-700 tracking-tight">
              <Icon size={20} /> {t(moment.titleKey)}
            </p>
            <p className="text-[11px] font-medium text-white/60">
              {t(moment.subtitleKey)}
              {moment.ball?.over ? ` · ${t("moment.over", { over: `${moment.ball.over}.${moment.ball.ball}` })}` : ""}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
