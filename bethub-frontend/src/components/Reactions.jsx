import { useCallback, useRef, useState } from "react";
import { useSocket, useSocketEvent } from "../contexts/SocketContext";
import { useI18n } from "../contexts/LanguageContext";
import { cn } from "../lib/utils";

const EMOJIS = ["🔥", "👏", "💯", "🏏", "😮", "🎉", "💚", "🤯", "🙌"];

export default function Reactions({ matchId, className = "" }) {
  const { t } = useI18n();
  const { socket } = useSocket();
  const [floaters, setFloaters] = useState([]);
  const timers = useRef(new Map());

  const addFloater = useCallback((emoji) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setFloaters((rows) => [...rows.slice(-24), { id, emoji, left: 8 + Math.random() * 82 }]);
    const timer = setTimeout(() => {
      setFloaters((rows) => rows.filter((row) => row.id !== id));
      timers.current.delete(id);
    }, 2600);
    timers.current.set(id, timer);
  }, []);

  useSocketEvent("reaction:new", ({ emoji }) => addFloater(emoji));

  const react = (emoji) => {
    if (!socket) return;
    socket.emit("reaction:send", { matchId, emoji });
    addFloater(emoji);
  };

  return (
    <div className={cn("relative", className)}>
      <div className="pointer-events-none absolute inset-x-0 bottom-full h-52 overflow-hidden">
        {floaters.map((floater) => (
          <span
            key={floater.id}
            className="absolute bottom-0 animate-floatUp text-2xl"
            style={{ left: `${floater.left}%` }}
          >
            {floater.emoji}
          </span>
        ))}
      </div>
      <div className="card flex flex-wrap items-center justify-center gap-1 p-2">
        <span className="mr-1 px-1 text-[9px] font-bold uppercase tracking-wider text-white/30">{t("reactions.react")}</span>
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => react(emoji)}
            className="rounded-lg px-2 py-1.5 text-lg transition hover:-translate-y-0.5 hover:bg-white/10 active:scale-95"
            aria-label={`React ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
