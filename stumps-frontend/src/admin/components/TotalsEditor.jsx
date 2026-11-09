import Card from "../../components/ui/Card";
import { Num } from "../../components/ui/Field";
import { ov, findMatch } from "../../lib/helpers";

export default function TotalsEditor({ m, upd }) {
  const set = (k, f, v) => upd((d) => { findMatch(d, m.id)[k][f] = v; });
  return (
    <Card title="Edit totals">
      {["a", "b"].map((k) => (
        <div key={k}>
          <b>{m[k].n}</b>
          <div className="row3" style={{ marginTop: 6 }}>
            <Num l="Runs" v={m[k].runs} on={(v) => set(k, "runs", v)} />
            <Num l="Wickets" v={m[k].wkts} on={(v) => set(k, "wkts", Math.min(10, v))} />
            <Num l={`Balls (${ov(m[k].balls)} ov)`} v={m[k].balls} on={(v) => set(k, "balls", v)} />
          </div>
        </div>
      ))}
    </Card>
  );
}
