import BallBadge from "./BallBadge";
import { ov, last } from "../lib/helpers";

export default function Floater({ m, players }) {
  const t = m[m.bat], o = m[m.bat === "a" ? "b" : "a"];
  const P = (id) => players.find((p) => p.id === id), cd = (id) => m.card[id] || { r: 0, b: 0 };
  const s = P(m.striker), n = P(m.non), b = P(m.bowler);
  const need = m.fmt !== "Test" && o.balls > 0 ? o.runs + 1 - t.runs : null;
  return (
    <div className="fl" aria-live="polite">
      <span className="c">{t.c}</span>
      <span className="r">{t.runs}/{t.wkts}</span>
      <span className="o">{ov(t.balls)} ov</span>
      {need !== null && <span className="need">{need > 0 ? `Need ${need}` : "Target reached"}</span>}
      <span className="bs">{m.over.map((x, i) => <BallBadge key={i} o={x} />)}</span>
      <span className="pp">
        {s && <span>{last(s.name)}* {cd(s.id).r} <i>({cd(s.id).b})</i></span>}
        {n && <span>{last(n.name)} {cd(n.id).r} <i>({cd(n.id).b})</i></span>}
        {b && <span>{last(b.name)} <i>{m.card[b.id] ? `${m.card[b.id].w}/${m.card[b.id].c}` : ""}</i></span>}
      </span>
    </div>
  );
}
