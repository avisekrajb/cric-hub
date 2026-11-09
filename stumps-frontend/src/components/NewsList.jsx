import { NEWS } from "../constants/seed";

export default function NewsList() {
  return NEWS.map(([t, h]) => <div className="news" key={t}><span>{t}</span><span className="mut">{h}</span></div>);
}
