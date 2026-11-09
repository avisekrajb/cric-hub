import StatsPanel from "../components/StatsPanel";

export default function StatsPage({ players }) {
  return <div className="panel" style={{ maxWidth: 640 }}><StatsPanel players={players} /></div>;
}
