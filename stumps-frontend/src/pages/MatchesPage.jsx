import { useState } from "react";
import MatchRow from "../components/MatchRow";
import Segmented from "../components/ui/Segmented";

const FILTERS = {
  All: () => true,
  Live: (m) => m.st === "live",
  Results: (m) => m.st === "done",
  Next: (m) => m.st === "up",
};

export default function MatchesPage({ db, open }) {
  const [f, setF] = useState("All");
  return (
    <>
      <Segmented value={f} onChange={setF} options={Object.keys(FILTERS).map((k) => ({ value: k, label: k }))} />
      <div className="list">{db.matches.filter(FILTERS[f]).map((m) => <MatchRow key={m.id} m={m} open={open} />)}</div>
    </>
  );
}
