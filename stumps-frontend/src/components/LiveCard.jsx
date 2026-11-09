import Tag from "./Tag";
import { ov, sc } from "../lib/helpers";

export default function LiveCard({ m, open }) {
  return (
    <button className="lc" onClick={() => open(m)}>
      <div className="r"><Tag m={m} /><span className="m">{m.fmt}</span></div>
      {[m.a, m.b].map((t) => (
        <div className="r" key={t.c} style={{ marginTop: 8 }}>
          <span className="c">{t.c}</span>
          <span className="s">{sc(t) || "—"} <small className="m">{t.balls > 0 ? `(${ov(t.balls)})` : ""}</small></span>
        </div>
      ))}
      <div className="nt">{m.note}</div>
    </button>
  );
}
