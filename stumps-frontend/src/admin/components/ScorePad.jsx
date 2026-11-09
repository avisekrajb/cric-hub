import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { ball } from "../../lib/scoring";
import { dsp, findMatch } from "../../lib/helpers";

const OUTS = ["0", "1", "2", "3", "4", "6", "Wd", "Nb", "W"];

export default function ScorePad({ m, act, undo, upd }) {
  const bt = m[m.bat];
  return (
    <Card title={`Score pad · ${bt.n} batting`}>
      <div className="pd">
        {OUTS.map((o) => (
          <button key={o} className={o === "4" || o === "6" ? "f4" : o === "W" ? "wk" : ""} onClick={() => act((d) => ball(d, m.id, o))}>{dsp(o)}</button>
        ))}
      </div>
      <div className="flex" style={{ marginTop: 10 }}>
        <Button variant="ghost" size="sm" onClick={undo}>Undo last ball</Button>
        <Button variant="ghost" size="sm" onClick={() => upd((d) => { const x = findMatch(d, m.id); [x.striker, x.non] = [x.non, x.striker]; })}>Swap strike</Button>
        <Button variant="ghost" size="sm" onClick={() => upd((d) => { findMatch(d, m.id).over = []; })}>New over</Button>
      </div>
    </Card>
  );
}
