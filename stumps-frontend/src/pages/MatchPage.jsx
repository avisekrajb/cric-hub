import { useState } from "react";
import LivePlayer from "../components/LivePlayer";
import Tag from "../components/Tag";
import Segmented from "../components/ui/Segmented";
import { Ic, IC } from "../lib/icons";
import { ov, sc } from "../lib/helpers";

const TABS = ["Commentary", "Scorecard", "Info"].map((t) => ({ value: t, label: t }));

export default function MatchPage({ m, players, back }) {
  const [tab, setTab] = useState("Commentary");
  const P = (id) => players.find((p) => p.id === id);
  const bats = (c) => players.filter((p) => m.card[p.id] && (m.card[p.id].b > 0 || m.card[p.id].r > 0) && p.team === c);
  const bowls = (c) => players.filter((p) => m.card[p.id] && m.card[p.id].o > 0 && p.team === c);
  return (
    <div>
      <button className="back" onClick={back}><Ic d={IC.back} s={16} /> Back</button>
      <div className="mhd"><div><b>{m.series}</b><div className="mut">{m.fmt} · {m.venue}</div></div><Tag m={m} /></div>
      {m.st === "live" ? <LivePlayer m={m} players={players} /> : (
        <div className="vp"><div className="vph"><b style={{ fontSize: 18 }}>{m.st === "done" ? "Match finished" : "Not started yet"}</b><span className="mut" style={{ color: "#98a2b3" }}>{m.note}</span></div></div>
      )}
      <div className="sb">
        {[m.a, m.b].map((t) => (
          <div className="ln" key={t.c}><span className="c">{t.c}</span><span className="s">{sc(t) || "—"} <span className="m">{t.balls > 0 ? `(${ov(t.balls)} ov)` : ""}</span></span></div>
        ))}
        <div className="nt">{m.note}</div>
      </div>
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {tab === "Commentary" && (m.feed.length ? m.feed.map((f, i) => <div className="cm" key={i}><span className="ov">{f.o}</span><span>{f.t}</span></div>) : <div className="empty">Commentary appears once the match starts.</div>)}
      {tab === "Scorecard" && [m.a, m.b].map((t) => (
        <div key={t.c}>
          <div className="h2">{t.n}</div>
          {bats(t.c).length > 0 && (
            <table className="tb"><thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th></tr></thead><tbody>
              {bats(t.c).map((p) => { const c = m.card[p.id]; return <tr key={p.id}><td>{p.name}{m.striker === p.id ? " *" : ""}</td><td>{c.r}</td><td>{c.b}</td><td>{c.f}</td><td>{c.s}</td></tr>; })}
            </tbody></table>
          )}
          {bowls(t.c).length > 0 && (
            <table className="tb"><thead><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th></tr></thead><tbody>
              {bowls(t.c).map((p) => { const c = m.card[p.id]; return <tr key={p.id}><td>{p.name}</td><td>{ov(c.o)}</td><td>{c.c}</td><td>{c.w}</td></tr>; })}
            </tbody></table>
          )}
        </div>
      ))}
      {tab === "Info" && [["Series", m.series], ["Format", m.fmt], ["Venue", m.venue], ["Batting", m[m.bat].n], ["At crease", [P(m.striker), P(m.non)].filter(Boolean).map((p) => p.name).join(", ") || "—"]].map(([k, v]) => (
        <div className="cm" key={k}><span className="ov" style={{ width: 80 }}>{k}</span><span>{v}</span></div>
      ))}
    </div>
  );
}
