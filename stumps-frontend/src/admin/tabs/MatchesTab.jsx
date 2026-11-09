import { useState } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Txt } from "../../components/ui/Field";
import Tag from "../../components/Tag";
import { T } from "../../constants/seed";

const EMPTY = { series: "", fmt: "T20I", venue: "", ac: "", an: "", bc: "", bn: "" };

export default function MatchesTab({ db, upd }) {
  const [f, setF] = useState(EMPTY);
  const add = () => {
    if (!f.ac || !f.bc) return;
    upd((d) => {
      d.matches.unshift({ id: "m" + Date.now(), st: "up", series: f.series || "Friendly", fmt: f.fmt, venue: f.venue, yt: "", bat: "a", striker: null, non: null, bowler: null, over: [], note: "Starts soon", a: T(f.ac.toUpperCase(), f.an || f.ac), b: T(f.bc.toUpperCase(), f.bn || f.bc), card: {}, feed: [] });
    });
    setF({ ...f, series: "", venue: "", ac: "", an: "", bc: "", bn: "" });
  };
  const set = (id, k, v) => upd((d) => { d.matches.find((m) => m.id === id)[k] = v; });
  return (
    <>
      <Card title="Add match">
        <div className="row2"><Txt l="Series" v={f.series} on={(v) => setF({ ...f, series: v })} /><Txt l="Format" v={f.fmt} on={(v) => setF({ ...f, fmt: v })} ph="Test, ODI, T20I" /></div>
        <Txt l="Venue" v={f.venue} on={(v) => setF({ ...f, venue: v })} />
        <div className="row2"><Txt l="Team A code" v={f.ac} on={(v) => setF({ ...f, ac: v })} ph="AUS" /><Txt l="Team A name" v={f.an} on={(v) => setF({ ...f, an: v })} /></div>
        <div className="row2"><Txt l="Team B code" v={f.bc} on={(v) => setF({ ...f, bc: v })} ph="IND" /><Txt l="Team B name" v={f.bn} on={(v) => setF({ ...f, bn: v })} /></div>
        <Button variant="g" onClick={add}>Add match</Button>
      </Card>
      {db.matches.map((m) => (
        <Card key={m.id}>
          <div className="flex" style={{ justifyContent: "space-between" }}><b>{m.a.n} v {m.b.n}</b><Tag m={m} /></div>
          <div className="row2" style={{ marginTop: 8 }}><Txt l="Series" v={m.series} on={(v) => set(m.id, "series", v)} /><Txt l="Venue" v={m.venue} on={(v) => set(m.id, "venue", v)} /></div>
          <div className="flex">
            <select className="in" style={{ width: "auto" }} value={m.st} onChange={(e) => set(m.id, "st", e.target.value)}>
              <option value="up">Upcoming</option><option value="live">Live</option><option value="done">Finished</option>
            </select>
            <Button variant="red" size="sm" onClick={() => upd((d) => { d.matches = d.matches.filter((x) => x.id !== m.id); })}>Delete match</Button>
          </div>
        </Card>
      ))}
    </>
  );
}
