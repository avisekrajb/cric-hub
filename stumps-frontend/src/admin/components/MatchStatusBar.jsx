import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Tag from "../../components/Tag";
import { Txt } from "../../components/ui/Field";
import { findMatch } from "../../lib/helpers";

export default function MatchStatusBar({ m, upd }) {
  const set = (k, v) => upd((d) => { findMatch(d, m.id)[k] = v; });
  return (
    <Card title={<>Match status · <Tag m={m} /></>}>
      <div className="flex">
        <Button variant="red" onClick={() => set("st", "live")} disabled={m.st === "live"} style={{ opacity: m.st === "live" ? 0.5 : 1 }}>Go live</Button>
        <Button onClick={() => set("st", "done")}>End match</Button>
        <Button variant="ghost" onClick={() => set("st", "up")}>Set upcoming</Button>
      </div>
      <p className="mut" style={{ margin: "8px 0" }}>Going live shows the video and floating scoreboard to every viewer.</p>
      <Txt l="YouTube video or live ID (viewers watch this)" v={m.yt} on={(v) => set("yt", v.trim())} ph="e.g. dQw4w9WgXcQ" />
      <Txt l="Match note" v={m.note} on={(v) => set("note", v)} />
    </Card>
  );
}
