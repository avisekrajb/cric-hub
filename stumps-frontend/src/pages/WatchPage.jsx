import { useState } from "react";
import LivePlayer from "../components/LivePlayer";
import { VIDEOS } from "../constants/seed";

export default function WatchPage({ db, open }) {
  const [cur, setCur] = useState(VIDEOS[0]);
  const live = db.matches.filter((m) => m.st === "live");
  return (
    <div className="watch">
      <div>
        <div className="h2">Live streams</div>
        {live.length ? live.map((m) => (
          <section className="sec" key={m.id}>
            <LivePlayer m={m} players={db.players} />
            <div className="h2" style={{ marginTop: 8 }}>{m.a.n} v {m.b.n} <button onClick={() => open(m)}>Open match</button></div>
          </section>
        )) : <div className="empty sec">No live streams right now.</div>}
        <div className="h2">Highlights</div>
        <div className="vp"><iframe title={cur.t} src={`https://www.youtube-nocookie.com/embed/${cur.yt}`} allow="encrypted-media; picture-in-picture" allowFullScreen /></div>
        <div className="h2" style={{ marginTop: 8 }}>{cur.t}</div>
      </div>
      <div>
        {VIDEOS.map((v) => (
          <button key={v.id} className="vrow" onClick={() => setCur(v)}>
            <span className="th"><b>{v.tag}</b></span><p>{v.t}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
