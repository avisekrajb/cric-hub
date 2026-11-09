import { useState, useRef } from "react";
import Button from "../components/ui/Button";
import Segmented from "../components/ui/Segmented";
import ScoringTab from "./tabs/ScoringTab";
import PlayersTab from "./tabs/PlayersTab";
import MatchesTab from "./tabs/MatchesTab";

const TABS = ["Scoring", "Players", "Matches"].map((t) => ({ value: t, label: t }));

export default function AdminApp({ db, upd, logout }) {
  const [tab, setTab] = useState("Scoring");
  const [mid, setMid] = useState((db.matches.find((m) => m.st === "live") || db.matches[0] || {}).id);
  const hist = useRef([]);
  const act = (fn) => { hist.current = [...hist.current.slice(-19), JSON.stringify({ matches: db.matches, players: db.players })]; upd(fn); };
  const undo = () => { const h = hist.current.pop(); if (h) { const p = JSON.parse(h); upd((d) => { d.matches = p.matches; d.players = p.players; }); } };
  return (
    <div className="cr adm">
      <header className="adt"><h1>Stumps admin</h1><Button variant="ghost" size="sm" onClick={logout}>Log out</Button></header>
      <main className="am">
        <Segmented options={TABS} value={tab} onChange={setTab} />
        {tab === "Scoring" && <ScoringTab db={db} upd={upd} act={act} undo={undo} mid={mid} setMid={setMid} />}
        {tab === "Players" && <PlayersTab db={db} upd={upd} />}
        {tab === "Matches" && <MatchesTab db={db} upd={upd} />}
      </main>
    </div>
  );
}
