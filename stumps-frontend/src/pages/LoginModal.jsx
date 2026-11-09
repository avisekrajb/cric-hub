import { useState } from "react";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import { ADMIN } from "../constants/admin";

export default function LoginModal({ close, ok }) {
  const [e, setE] = useState(""), [p, setP] = useState(""), [err, setErr] = useState("");
  const submit = (ev) => {
    ev.preventDefault();
    if (e.trim().toLowerCase() === ADMIN.email && p === ADMIN.pw) ok(); else setErr("Wrong email or password.");
  };
  return (
    <Modal onClose={close} label="Admin login">
      <form onSubmit={submit}>
        <h2>Admin login</h2>
        <p className="mut" style={{ margin: "0 0 14px" }}>Sign in to manage scores, players and live streams.</p>
        <label className="f"><span>Email</span><input className="in" type="email" autoFocus value={e} onChange={(x) => setE(x.target.value)} autoComplete="username" /></label>
        <label className="f"><span>Password</span><input className="in" type="password" value={p} onChange={(x) => setP(x.target.value)} autoComplete="current-password" /></label>
        {err && <p className="err">{err}</p>}
        <div className="flex">
          <Button variant="g" type="submit">Log in</Button>
          <Button variant="ghost" type="button" onClick={close}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
}
