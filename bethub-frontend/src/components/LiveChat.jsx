import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Smile, UserRound } from "lucide-react";
import { useSocket, useSocketEvent } from "../contexts/SocketContext";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../contexts/LanguageContext";
import { api } from "../lib/api";
import { cn, formatDateTime, initials, timeAgo } from "../lib/utils";

const quickEmojis = ["🏏", "🔥", "👏", "😮", "💯"];

export default function LiveChat({ matchId, className = "" }) {
  const { t } = useI18n();
  const { socket } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [name, setName] = useState(() => localStorage.getItem("bethub_guest_name") || "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const nearBottomRef = useRef(true);

  useEffect(() => {
    let active = true;
    api(`/api/matches/${matchId}/chat`)
      .then((data) => {
        if (active) setMessages(data.messages || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [matchId]);

  useSocketEvent("chat:message", (message) => {
    if (String(message.match) !== String(matchId)) return;
    setMessages((rows) => {
      if (rows.some((row) => row._id === message._id)) return rows;
      return [...rows, message].slice(-120);
    });
  });

  useSocketEvent("chat:delete", ({ messageId }) => {
    setMessages((rows) => rows.map((row) => (row._id === messageId ? { ...row, isHidden: true } : row)));
  });

  useEffect(() => {
    const el = listRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const send = (event) => {
    event.preventDefault();
    const body = text.trim();
    if (!body || !socket) return;
    if (!user && name.trim()) localStorage.setItem("bethub_guest_name", name.trim());
    setSending(true);
    setError("");
    socket.emit("chat:send", { matchId, body, name: name.trim() || undefined }, (ack) => {
      setSending(false);
      if (!ack?.ok) {
        setError(ack?.message || t("chat.error"));
        return;
      }
      setText("");
    });
    setText("");
  };

  return (
    <div className={cn("card flex h-[520px] flex-col overflow-hidden", className)}>
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-bold text-white"><MessageCircle size={15} className="text-lime" /> {t("chat.title")}</p>
        <span className="flex items-center gap-1.5 text-[10px] text-white/35"><span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-mint" /> {t("chat.live")}</span>
      </div>

      <div ref={listRef} onScroll={onScroll} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-center">
            <div>
              <Smile size={22} className="mx-auto mb-2 text-white/20" />
              <p className="text-xs text-white/35">{t("chat.first")}</p>
              <p className="mt-1 text-[10px] text-white/25">{t("chat.instant")}</p>
            </div>
          </div>
        )}
        {messages.map((message) => (
          <div key={message._id} className={cn("flex gap-2.5", message.isHidden && "opacity-40")}>
            <span
              className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-bold text-ink-950"
              style={{ backgroundColor: message.avatarColor || "#c8ff3d" }}
            >
              {initials(message.user || t("chat.guest"))}
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                <span className="font-semibold text-white/75">{message.user || t("chat.guest")}</span>
                <span className="text-[9px] text-white/25" title={new Date(message.createdAt).toLocaleString()}>{timeAgo(message.createdAt)}</span>
                <span className="text-[9px] font-medium text-white/35">{formatDateTime(message.createdAt)}</span>
                {message.isHidden && <span className="text-[9px] uppercase text-coral/60">{t("chat.removed")}</span>}
              </p>
              <p className="break-words text-[13px] leading-relaxed text-white/65">{message.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/[0.07] p-3">
        {!user && (
          <label className="mb-2 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
            <UserRound size={12} className="text-white/30" />
            <input
              value={name}
              onChange={(event) => setName(event.target.value.slice(0, 32))}
              placeholder={t("chat.namePlaceholder")}
              className="w-full bg-transparent text-[11px] text-white placeholder:text-white/25 outline-none"
            />
          </label>
        )}
        <div className="mb-2 flex gap-1">
          {quickEmojis.map((emoji) => (
            <button key={emoji} type="button" onClick={() => setText((value) => `${value}${emoji}`)} className="rounded-md px-1.5 py-1 text-sm transition hover:bg-white/10">
              {emoji}
            </button>
          ))}
        </div>
        <form onSubmit={send} className="flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value.slice(0, 280))}
            placeholder={t("chat.placeholder")}
            className="input !py-2 text-[12px]"
            maxLength={280}
          />
          <button type="submit" className="btn-primary !px-3" disabled={sending || !text.trim() || !socket} aria-label={t("chat.send")}>
            <Send size={15} />
          </button>
        </form>
        {error && <p className="mt-1 text-[10px] text-coral">{error}</p>}
        <p className="mt-1.5 text-right text-[9px] text-white/20">{t("chat.counter", { count: text.length })}</p>
      </div>
    </div>
  );
}
