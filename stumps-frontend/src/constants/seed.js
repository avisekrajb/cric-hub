export const T = (c, n, runs = 0, wkts = 0, balls = 0) => ({ c, n, runs, wkts, balls });
export const PL = (id, name, team, role, runs, wkts) => ({ id, name, team, role, runs, wkts });

export const SEED = {
  players: [
    PL("p1", "Steve Smith", "AUS", "Batter", 412, 0), PL("p2", "Travis Head", "AUS", "Batter", 355, 0),
    PL("p3", "Marnus Labuschagne", "AUS", "Batter", 301, 0), PL("p4", "Pat Cummins", "AUS", "Bowler", 88, 21),
    PL("p5", "Mitchell Starc", "AUS", "Bowler", 40, 18), PL("p6", "Virat Kohli", "IND", "Batter", 398, 0),
    PL("p7", "Shubman Gill", "IND", "Batter", 330, 0), PL("p8", "Jasprit Bumrah", "IND", "Bowler", 20, 26),
    PL("p9", "Mohammed Siraj", "IND", "Bowler", 12, 17), PL("p10", "Ravindra Jadeja", "IND", "All-rounder", 210, 19),
    PL("p11", "Joe Root", "ENG", "Batter", 520, 0), PL("p12", "Harry Brook", "ENG", "Batter", 310, 0),
    PL("p13", "Jofra Archer", "ENG", "Bowler", 30, 15), PL("p14", "Kagiso Rabada", "RSA", "Bowler", 25, 24),
    PL("p15", "Aiden Markram", "RSA", "Batter", 280, 0),
  ],
  matches: [
    { id: "m1", st: "live", series: "Test Championship", fmt: "Test", venue: "MCG, Melbourne", yt: "", bat: "a", striker: "p1", non: "p2", bowler: "p8",
      over: ["1", "0", "4", "W", "2", "6"], note: "Australia lead by 38 runs",
      a: T("AUS", "Australia", 312, 6, 530), b: T("IND", "India", 274, 10, 546),
      card: { p1: { r: 84, b: 141, f: 9, s: 1, w: 0, c: 0, o: 0 }, p2: { r: 47, b: 52, f: 6, s: 1, w: 0, c: 0, o: 0 }, p3: { r: 31, b: 76, f: 3, s: 0, w: 0, c: 0, o: 0 },
        p8: { r: 0, b: 0, f: 0, s: 0, w: 2, c: 58, o: 114 }, p9: { r: 0, b: 0, f: 0, s: 0, w: 1, c: 62, o: 102 }, p10: { r: 0, b: 0, f: 0, s: 0, w: 2, c: 71, o: 132 } },
      feed: [{ o: "88.2", t: "Bumrah to Smith, 1 run, worked off the pads." }, { o: "88.1", t: "Bumrah to Head, FOUR! A crisp cover drive." }] },
    { id: "m2", st: "live", series: "T20I Series", fmt: "T20I", venue: "Eden Gardens, Kolkata", yt: "", bat: "a", striker: "p11", non: "p12", bowler: "p14",
      over: ["1", "1", "0"], note: "England batting first", a: T("ENG", "England", 168, 4, 105), b: T("RSA", "South Africa"),
      card: { p11: { r: 62, b: 38, f: 7, s: 2, w: 0, c: 0, o: 0 }, p12: { r: 29, b: 17, f: 3, s: 1, w: 0, c: 0, o: 0 }, p14: { r: 0, b: 0, f: 0, s: 0, w: 1, c: 31, o: 18 } },
      feed: [{ o: "17.3", t: "Rabada to Root, 1 run, pushed into the gap." }] },
    { id: "m3", st: "done", series: "ODI Series", fmt: "ODI", venue: "Galle Stadium", yt: "", bat: "b", striker: null, non: null, bowler: null, over: [],
      note: "New Zealand won by 5 wickets", a: T("SL", "Sri Lanka", 241, 9, 300), b: T("NZ", "New Zealand", 245, 5, 280), card: {}, feed: [] },
    { id: "m4", st: "up", series: "Women’s T20 World Cup", fmt: "T20I", venue: "Wankhede, Mumbai", yt: "", bat: "a", striker: null, non: null, bowler: null, over: [],
      note: "Today · 7:00 PM", a: T("INW", "India W"), b: T("AUW", "Australia W"), card: {}, feed: [] },
  ],
};

export const VIDEOS = [
  { id: 1, t: "Top 10 catches of the season", tag: "12:08", yt: "dQw4w9WgXcQ" },
  { id: 2, t: "Bumrah’s spell, ball by ball", tag: "8:41", yt: "dQw4w9WgXcQ" },
  { id: 3, t: "How Bazball changed Test cricket", tag: "15:22", yt: "dQw4w9WgXcQ" },
];

export const TEAMS = [["Australia", "1st", "124", "pts"], ["India", "2nd", "116", "pts"], ["South Africa", "3rd", "108", "pts"], ["England", "4th", "99", "pts"]];

export const NEWS = [
  ["Selectors name 15-man squad for home Test series", "2h"],
  ["Pitch report: MCG surface to turn on day four", "4h"],
  ["Five players to watch at the Women’s T20 World Cup", "6h"],
];
