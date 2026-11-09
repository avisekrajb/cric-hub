import Segmented from "../../components/ui/Segmented";
import Recorder from "../components/Recorder";
import ScorePad from "../components/ScorePad";
import MatchStatusBar from "../components/MatchStatusBar";
import LineupEditor from "../components/LineupEditor";
import TotalsEditor from "../components/TotalsEditor";
import CommentaryBox from "../components/CommentaryBox";

export default function ScoringTab({ db, upd, act, undo, mid, setMid }) {
  const m = db.matches.find((x) => x.id === mid) || db.matches[0];
  if (!m) return <div className="empty">Add a match in the Matches tab first.</div>;
  return (
    <div className="cols">
      <div>
        <Segmented value={m.id} onChange={setMid}
          options={db.matches.map((x) => ({ value: x.id, label: <>{x.st === "live" && <span className="dot" />}{x.a.c} v {x.b.c}</> }))} />
        <Recorder m={m} players={db.players} />
        <ScorePad m={m} act={act} undo={undo} upd={upd} />
      </div>
      <div>
        <MatchStatusBar m={m} upd={upd} />
        <LineupEditor m={m} players={db.players} upd={upd} />
        <TotalsEditor m={m} upd={upd} />
        <CommentaryBox m={m} upd={upd} />
      </div>
    </div>
  );
}
