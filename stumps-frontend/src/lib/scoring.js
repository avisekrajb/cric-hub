import { ov } from "./helpers";

/* Scoring engine: apply one ball to match `mid` inside draft state `d`. */
export function ball(d, mid, o) {
  const m = d.matches.find((x) => x.id === mid); if (!m) return;
  const t = m[m.bat], pl = (id) => d.players.find((p) => p.id === id);
  const cd = (id) => (id ? (m.card[id] = m.card[id] || { r: 0, b: 0, f: 0, s: 0, w: 0, c: 0, o: 0 }) : null);
  const legal = o !== "Wd" && o !== "Nb", n = /^\d$/.test(o) ? +o : 0, x = legal ? 0 : 1;
  const st = cd(m.striker), bw = cd(m.bowler), sp = pl(m.striker), bp = pl(m.bowler);
  if (legal && t.balls % 6 === 0) m.over = [];
  t.runs += n + x; if (legal) t.balls++;
  if (st) { if (legal) st.b++; st.r += n; if (n === 4) st.f++; if (n === 6) st.s++; }
  if (sp) sp.runs += n;
  if (bw) { bw.c += n + x; if (legal) bw.o++; }
  let txt = n === 0 ? "Dot ball." : n === 4 ? "FOUR!" : n === 6 ? "SIX!" : `${n} run${n > 1 ? "s" : ""}.`;
  if (o === "Wd") txt = "Wide, 1 extra."; if (o === "Nb") txt = "No ball, 1 extra.";
  if (o === "W") { t.wkts = Math.min(10, t.wkts + 1); if (bw) bw.w++; if (bp) bp.wkts++; txt = `WICKET! ${sp ? sp.name : "Batter"} is out.`; m.striker = null; if (t.wkts === 10) m.note = `${t.n} all out`; }
  const swap = () => { [m.striker, m.non] = [m.non, m.striker]; };
  if (m.striker && m.non) { if (n % 2 === 1) swap(); if (legal && t.balls % 6 === 0) swap(); }
  m.over = [...m.over, o].slice(-8);
  m.feed = [{ o: ov(t.balls), t: `${bp ? bp.name : "Bowler"} to ${sp ? sp.name : "batter"}, ${txt}` }, ...m.feed].slice(0, 40);
}
