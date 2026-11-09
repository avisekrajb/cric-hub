export const ov = (b) => `${Math.floor(b / 6)}.${b % 6}`;
export const sc = (t) => (t.balls === 0 && t.runs === 0 && t.wkts === 0 ? null : `${t.runs}${t.wkts < 10 ? "/" + t.wkts : ""}`);
export const last = (n) => n.split(" ").slice(-1)[0];
export const dsp = (o) => (o === "0" ? "•" : o);
export const bcls = (o) => (o === "4" || o === "6" ? "f" : o === "W" ? "w" : o === "Wd" || o === "Nb" ? "x" : "");
export const findMatch = (d, id) => d.matches.find((x) => x.id === id);
