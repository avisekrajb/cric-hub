import { useState } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { ov, findMatch } from "../../lib/helpers";

export default function CommentaryBox({ m, upd }) {
  const [cm, setCm] = useState("");
  const post = () => {
    if (!cm.trim()) return;
    upd((d) => { const x = findMatch(d, m.id); x.feed = [{ o: ov(x[x.bat].balls), t: cm.trim() }, ...x.feed].slice(0, 40); });
    setCm("");
  };
  return (
    <Card title="Commentary">
      <div className="flex" style={{ flexWrap: "nowrap" }}>
        <input className="in" value={cm} placeholder="Type a comment" onChange={(e) => setCm(e.target.value)} />
        <Button variant="g" onClick={post}>Post</Button>
      </div>
    </Card>
  );
}
