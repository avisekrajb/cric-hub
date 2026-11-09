import Tag from "./Tag";
import { sc } from "../lib/helpers";

export default function MatchRow({ m, open }) {
  return (
    <button className="mc" onClick={() => open(m)}>
      <div className="r"><span className="mut">{m.series}</span><Tag m={m} /></div>
      {[m.a, m.b].map((t) => <div className="r tm" key={t.c}><span>{t.n}</span><span>{sc(t) || "—"}</span></div>)}
      <div className="nt">{m.note}</div>
    </button>
  );
}
