import { useState } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Txt } from "../../components/ui/Field";

const ROLES = ["Batter", "Bowler", "All-rounder", "Wicketkeeper"];

export default function PlayersTab({ db, upd }) {
  const teams = [...new Set(db.matches.flatMap((m) => [m.a.c, m.b.c]).concat(db.players.map((p) => p.team)))];
  const [nw, setNw] = useState({ name: "", team: teams[0] || "", role: "Batter" });
  const set = (id, k, v) => upd((d) => { d.players.find((p) => p.id === id)[k] = v; });
  const add = () => {
    if (!nw.name.trim()) return;
    upd((d) => { d.players.push({ id: "p" + Date.now(), name: nw.name.trim(), team: nw.team, role: nw.role, runs: 0, wkts: 0 }); });
    setNw({ ...nw, name: "" });
  };
  return (
    <>
      <Card title="Add player">
        <div className="row3">
          <Txt l="Name" v={nw.name} on={(v) => setNw({ ...nw, name: v })} />
          <label className="f"><span>Team</span><select className="in" value={nw.team} onChange={(e) => setNw({ ...nw, team: e.target.value })}>{teams.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="f"><span>Role</span><select className="in" value={nw.role} onChange={(e) => setNw({ ...nw, role: e.target.value })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></label>
        </div>
        <Button variant="g" onClick={add}>Add player</Button>
      </Card>
      <Card title={`Players and bowlers (${db.players.length})`}>
        <div className="tw"><table className="tp">
          <thead><tr><th>Name</th><th>Team</th><th>Role</th><th>Runs</th><th>Wkts</th><th /></tr></thead>
          <tbody>
            {db.players.map((p) => (
              <tr key={p.id}>
                <td><input className="in" value={p.name} onChange={(e) => set(p.id, "name", e.target.value)} /></td>
                <td><select className="in" value={p.team} onChange={(e) => set(p.id, "team", e.target.value)}>{teams.map((t) => <option key={t}>{t}</option>)}</select></td>
                <td><select className="in" value={p.role} onChange={(e) => set(p.id, "role", e.target.value)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select></td>
                <td><input className="in" type="number" min="0" value={p.runs} onChange={(e) => set(p.id, "runs", Math.max(0, +e.target.value || 0))} style={{ width: 80 }} /></td>
                <td><input className="in" type="number" min="0" value={p.wkts} onChange={(e) => set(p.id, "wkts", Math.max(0, +e.target.value || 0))} style={{ width: 70 }} /></td>
                <td><Button variant="red" size="sm" onClick={() => upd((d) => { d.players = d.players.filter((x) => x.id !== p.id); })}>Delete</Button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
    </>
  );
}
