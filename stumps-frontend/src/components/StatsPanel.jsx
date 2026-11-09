import { useState } from "react";
import Segmented from "./ui/Segmented";
import { TEAMS } from "../constants/seed";

const KINDS = ["Batters", "Bowlers", "Teams"].map((k) => ({ value: k, label: k }));

export default function StatsPanel({ players }) {
  const [k, setK] = useState("Batters");
  const rows = k === "Batters" ? [...players].sort((a, b) => b.runs - a.runs).slice(0, 6).map((p) => [p.name, p.team, p.runs, "runs"])
    : k === "Bowlers" ? [...players].sort((a, b) => b.wkts - a.wkts).slice(0, 6).map((p) => [p.name, p.team, p.wkts, "wkts"]) : TEAMS;
  return (
    <div>
      <Segmented options={KINDS} value={k} onChange={setK} />
      {rows.map(([n, sub, v, u], i) => (
        <div className="lr" key={n}>
          <span className="av">{i + 1}</span>
          <div><b>{n}</b><span className="mut">{sub}</span></div>
          <span className="v">{v}<small>{u}</small></span>
        </div>
      ))}
    </div>
  );
}
