import { Ic, IC } from "../lib/icons";
import { TABS } from "../constants/tabs";

export default function SideNav({ tab, go }) {
  return (
    <nav className="nav" aria-label="Main">
      <div className="logo"><i />Stumps</div>
      {TABS.map((t) => (
        <button key={t} className={tab === t ? "on" : ""} onClick={() => go(t)} aria-current={tab === t ? "page" : undefined}>
          <span className="pill"><Ic d={IC[t]} /></span>{t}
        </button>
      ))}
    </nav>
  );
}
