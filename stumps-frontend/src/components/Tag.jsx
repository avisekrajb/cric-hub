export default function Tag({ m }) {
  return m.st === "live" ? <span className="live">LIVE</span> : <span className="mut">{m.st === "done" ? "Result" : "Upcoming"}</span>;
}
