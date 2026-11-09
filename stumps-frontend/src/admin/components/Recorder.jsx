import { useState, useEffect, useRef } from "react";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Floater from "../../components/Floater";

export default function Recorder({ m, players }) {
  const vr = useRef(null), mr = useRef(null), ch = useRef([]), ss = useRef(null);
  const [rec, setRec] = useState(false), [on, setOn] = useState(false), [url, setUrl] = useState(""), [err, setErr] = useState("");
  useEffect(() => () => ss.current && ss.current.getTracks().forEach((t) => t.stop()), []);
  const start = async () => {
    setErr("");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: true });
      ss.current = s; vr.current.srcObject = s; setOn(true); setUrl("");
      const r = new MediaRecorder(s); ch.current = [];
      r.ondataavailable = (e) => e.data.size && ch.current.push(e.data);
      r.onstop = () => { setUrl(URL.createObjectURL(new Blob(ch.current, { type: "video/webm" }))); s.getTracks().forEach((t) => t.stop()); setOn(false); };
      r.start(1000); mr.current = r; setRec(true);
    } catch (e) { setErr("Camera or microphone is blocked. Allow access in the browser and try again."); }
  };
  const stop = () => { if (mr.current) mr.current.stop(); setRec(false); };
  return (
    <Card>
      <div className="vp">
        <video ref={vr} autoPlay muted playsInline style={{ display: on ? "block" : "none" }} />
        {!on && url && <video src={url} controls playsInline />}
        {!on && !url && <div className="vph"><b>Camera off</b><span className="mut" style={{ color: "#98a2b3" }}>Press Record live to start your camera.</span></div>}
        {rec && <span className="recb">● REC</span>}
        <Floater m={m} players={players} />
      </div>
      <div className="flex" style={{ marginTop: 10 }}>
        {!rec ? <Button variant="red" onClick={start}>● Record live</Button> : <Button onClick={stop}>■ Stop and save</Button>}
        {url && <a className="bt ghost" href={url} download={`stumps-${m.a.c}-v-${m.b.c}.webm`}>Download recording</a>}
      </div>
      {err && <p className="err" style={{ marginTop: 8 }}>{err}</p>}
    </Card>
  );
}
