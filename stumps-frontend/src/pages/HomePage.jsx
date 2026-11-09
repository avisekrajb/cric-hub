import { useState } from "react";
import LivePlayer from "../components/LivePlayer";
import LiveCard from "../components/LiveCard";
import MatchRow from "../components/MatchRow";
import StatsPanel from "../components/StatsPanel";
import NewsList from "../components/NewsList";
import Segmented from "../components/ui/Segmented";

export default function HomePage({ db, open, go }) {
  const live = db.matches.filter((m) => m.st === "live"), rest = db.matches.filter((m) => m.st !== "live");
  const [fi, setFi] = useState(0);
  const feat = live[fi] || live[0];
  return (
    <div className="home">
      <div>
        <section className="sec">
          <div className="h2">Live video {feat && <button onClick={() => open(feat)}>Open match</button>}</div>
          {live.length > 1 && (
            <Segmented value={fi} onChange={setFi}
              options={live.map((m, i) => ({ value: i, label: <><span className="dot" />{m.a.c} v {m.b.c}</> }))} />
          )}
          {feat ? <LivePlayer m={feat} players={db.players} /> : <div className="empty">No match is live right now. Check upcoming matches below.</div>}
        </section>
        {live.length > 0 && (
          <section className="sec">
            <div className="h2">Live now <button onClick={() => go("Matches")}>See all</button></div>
            <div className="rail">{live.map((m) => <LiveCard key={m.id} m={m} open={open} />)}</div>
          </section>
        )}
        <section className="sec">
          <div className="h2">Results and upcoming</div>
          <div className="list">{rest.map((m) => <MatchRow key={m.id} m={m} open={open} />)}</div>
        </section>
      </div>
      <div className="side">
        <section className="sec panel"><div className="h2">Top players</div><StatsPanel players={db.players} /></section>
        <section className="sec panel"><div className="h2">News</div><NewsList /></section>
      </div>
    </div>
  );
}
