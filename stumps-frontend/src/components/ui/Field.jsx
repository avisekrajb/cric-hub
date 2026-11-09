export const Txt = ({ l, v, on, ph }) => (
  <label className="f"><span>{l}</span><input className="in" value={v} placeholder={ph} onChange={(e) => on(e.target.value)} /></label>
);

export const Num = ({ l, v, on }) => (
  <label className="f"><span>{l}</span><input className="in" type="number" min="0" value={v} onChange={(e) => on(Math.max(0, +e.target.value || 0))} /></label>
);
