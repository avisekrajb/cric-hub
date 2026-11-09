import { Ic, IC } from "../lib/icons";

export default function Footer({ onAdmin }) {
  return (
    <footer className="ft">
      <button className="admb" onClick={onAdmin}><Ic d={IC.lock} s={14} /> Admin</button>
    </footer>
  );
}
