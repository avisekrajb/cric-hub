import Floater from "./Floater";

export default function LivePlayer({ m, players }) {
  return (
    <div className={`vp ${m.yt ? "yt" : ""}`}>
      {m.yt ? (
        <iframe title={`${m.a.n} v ${m.b.n} live`} src={`https://www.youtube-nocookie.com/embed/${m.yt}?autoplay=1&mute=1&playsinline=1`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : (
        <div className="vph">
          <span className="live" style={{ color: "#ff8a8d" }}>LIVE</span>
          <b style={{ fontSize: 18 }}>{m.a.n} v {m.b.n}</b>
          <span className="mut" style={{ color: "#98a2b3" }}>Video starts soon. Scores below update in real time.</span>
        </div>
      )}
      <Floater m={m} players={players} />
    </div>
  );
}
