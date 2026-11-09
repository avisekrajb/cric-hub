import Card from "../../components/ui/Card";
import Segmented from "../../components/ui/Segmented";
import { findMatch } from "../../lib/helpers";

function Sel({ l, value, list, onChange }) {
  return (
    <label className="f"><span>{l}</span>
      <select className="in" value={value || ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Select player</option>
        {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>
  );
}

export default function LineupEditor({ m, players, upd }) {
  const bt = m[m.bat], bo = m[m.bat === "a" ? "b" : "a"];
  const bats = players.filter((p) => p.team === bt.c), bowls = players.filter((p) => p.team === bo.c);
  const set = (k, v) => upd((d) => { findMatch(d, m.id)[k] = v; });
  const flip = (k) => upd((d) => { const x = findMatch(d, m.id); x.bat = k; x.striker = null; x.non = null; x.bowler = null; x.over = []; });
  return (
    <Card title="Line-up">
      <Segmented value={m.bat} onChange={flip} options={["a", "b"].map((k) => ({ value: k, label: `${m[k].c} batting` }))} />
      <Sel l="Striker" value={m.striker} list={bats} onChange={(v) => set("striker", v)} />
      <Sel l="Non-striker" value={m.non} list={bats} onChange={(v) => set("non", v)} />
      <Sel l="Bowler" value={m.bowler} list={bowls} onChange={(v) => set("bowler", v)} />
    </Card>
  );
}
