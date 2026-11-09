import mongoose from "mongoose";
import { connectDatabase } from "./config/db.js";
import env from "./config/env.js";
import logger from "./config/logger.js";
import { bootstrap } from "./services/bootstrap.js";
import Country from "./models/Country.model.js";
import Player from "./models/Player.model.js";
import Team from "./models/Team.model.js";
import Match from "./models/Match.model.js";
import Ball from "./models/Ball.model.js";
import Video from "./models/Video.model.js";
import ChatMessage from "./models/ChatMessage.model.js";
import { computeResult } from "./services/scoring.service.js";
import { slugify } from "./utils/ids.js";
import { CRICKET_COUNTRIES as COUNTRIES } from "./data/cricket-countries.js";

const AVATAR = (i) => `https://i.pravatar.cc/400?img=${(i % 70) + 1}`;
const UNS = (id, w = 900) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const squads = {
  India: [
    ["Rohit Sharma", "Batter", true, false, 45],
    ["Shubman Gill", "Batter", false, false, 77],
    ["Virat Kohli", "Batter", false, false, 18],
    ["Suryakumar Yadav", "Batter", false, false, 63],
    ["Rishabh Pant", "Wicket-Keeper", false, true, 17],
    ["Hardik Pandya", "All-Rounder", false, false, 33],
    ["Ravindra Jadeja", "All-Rounder", false, false, 8],
    ["Axar Patel", "All-Rounder", false, false, 20],
    ["Kuldeep Yadav", "Bowler", false, false, 23],
    ["Jasprit Bumrah", "Bowler", false, false, 93],
    ["Mohammed Siraj", "Bowler", false, false, 13],
    ["Arshdeep Singh", "Bowler", false, false, 2],
  ],
  Nepal: [
    ["Kushal Bhurtel", "Batter", false, false, 14],
    ["Aasif Sheikh", "Wicket-Keeper", false, true, 9],
    ["Rohit Paudel", "Batter", true, false, 11],
    ["Dipendra Singh Airee", "All-Rounder", false, false, 45],
    ["Kushal Malla", "Batter", false, false, 5],
    ["Sundeep Jora", "Batter", false, false, 21],
    ["Gulsan Jha", "All-Rounder", false, false, 15],
    ["Sompal Kami", "Bowler", false, false, 22],
    ["Karan KC", "Bowler", false, false, 33],
    ["Sandeep Lamichhane", "Bowler", false, false, 25],
    ["Abinash Bohara", "Bowler", false, false, 19],
    ["Lalit Rajbanshi", "Bowler", false, false, 12],
  ],
  Australia: [
    ["Travis Head", "Batter", false, false, 1],
    ["David Warner", "Batter", false, false, 31],
    ["Mitchell Marsh", "All-Rounder", true, false, 8],
    ["Glenn Maxwell", "All-Rounder", false, false, 32],
    ["Josh Inglis", "Wicket-Keeper", false, true, 48],
    ["Marcus Stoinis", "All-Rounder", false, false, 17],
    ["Tim David", "Batter", false, false, 74],
    ["Pat Cummins", "Bowler", false, false, 30],
    ["Mitchell Starc", "Bowler", false, false, 56],
    ["Adam Zampa", "Bowler", false, false, 88],
    ["Josh Hazlewood", "Bowler", false, false, 38],
    ["Nathan Ellis", "Bowler", false, false, 12],
  ],
  England: [
    ["Phil Salt", "Batter", false, false, 61],
    ["Jos Buttler", "Wicket-Keeper", true, true, 63],
    ["Ben Duckett", "Batter", false, false, 19],
    ["Harry Brook", "Batter", false, false, 88],
    ["Liam Livingstone", "All-Rounder", false, false, 23],
    ["Moeen Ali", "All-Rounder", false, false, 18],
    ["Sam Curran", "All-Rounder", false, false, 58],
    ["Chris Woakes", "All-Rounder", false, false, 24],
    ["Jofra Archer", "Bowler", false, false, 22],
    ["Adil Rashid", "Bowler", false, false, 95],
    ["Mark Wood", "Bowler", false, false, 33],
    ["Reece Topley", "Bowler", false, false, 28],
  ],
  Pakistan: [
    ["Babar Azam", "Batter", true, false, 56],
    ["Mohammad Rizwan", "Wicket-Keeper", false, true, 16],
    ["Fakhar Zaman", "Batter", false, false, 39],
    ["Saim Ayub", "Batter", false, false, 86],
    ["Iftikhar Ahmed", "All-Rounder", false, false, 95],
    ["Shadab Khan", "All-Rounder", false, false, 7],
    ["Imad Wasim", "All-Rounder", false, false, 10],
    ["Shaheen Afridi", "Bowler", false, false, 40],
    ["Naseem Shah", "Bowler", false, false, 71],
    ["Haris Rauf", "Bowler", false, false, 97],
    ["Mohammad Amir", "Bowler", false, false, 5],
    ["Abrar Ahmed", "Bowler", false, false, 90],
  ],
  "Sri Lanka": [
    ["Pathum Nissanka", "Batter", false, false, 18],
    ["Kusal Mendis", "Wicket-Keeper", false, true, 13],
    ["Kusal Perera", "Batter", false, false, 5],
    ["Charith Asalanka", "Batter", true, false, 72],
    ["Dhananjaya de Silva", "All-Rounder", false, false, 75],
    ["Wanindu Hasaranga", "All-Rounder", false, false, 49],
    ["Dasun Shanaka", "All-Rounder", false, false, 7],
    ["Maheesh Theekshana", "Bowler", false, false, 61],
    ["Matheesha Pathirana", "Bowler", false, false, 78],
    ["Dilshan Madushanka", "Bowler", false, false, 98],
    ["Nuwan Thushara", "Bowler", false, false, 53],
    ["Dunith Wellalage", "All-Rounder", false, false, 1],
  ],
  "South Africa": [
    ["Quinton de Kock", "Wicket-Keeper", false, true, 12],
    ["Temba Bavuma", "Batter", true, false, 11],
    ["Aiden Markram", "Batter", false, false, 4],
    ["Heinrich Klaasen", "Batter", false, false, 45],
    ["David Miller", "Batter", false, false, 10],
    ["Tristan Stubbs", "Batter", false, false, 30],
    ["Marco Jansen", "All-Rounder", false, false, 70],
    ["Keshav Maharaj", "Bowler", false, false, 16],
    ["Kagiso Rabada", "Bowler", false, false, 25],
    ["Anrich Nortje", "Bowler", false, false, 20],
    ["Lungi Ngidi", "Bowler", false, false, 22],
    ["Tabraiz Shamsi", "Bowler", false, false, 99],
  ],
  "New Zealand": [
    ["Devon Conway", "Batter", false, false, 88],
    ["Finn Allen", "Batter", false, false, 16],
    ["Kane Williamson", "Batter", true, false, 22],
    ["Daryl Mitchell", "All-Rounder", false, false, 75],
    ["Glenn Phillips", "Wicket-Keeper", false, true, 1],
    ["Mark Chapman", "Batter", false, false, 80],
    ["Mitchell Santner", "All-Rounder", false, false, 74],
    ["Rachin Ravindra", "All-Rounder", false, false, 4],
    ["Lockie Ferguson", "Bowler", false, false, 87],
    ["Trent Boult", "Bowler", false, false, 18],
    ["Tim Southee", "Bowler", false, false, 38],
    ["Ish Sodhi", "Bowler", false, false, 61],
  ],
  Bangladesh: [
    ["Litton Das", "Wicket-Keeper", false, true, 16],
    ["Najmul Hossain Shanto", "Batter", true, false, 99],
    ["Tanzid Hasan", "Batter", false, false, 31],
    ["Towhid Hridoy", "Batter", false, false, 77],
    ["Shakib Al Hasan", "All-Rounder", false, false, 75],
    ["Mahmudullah", "All-Rounder", false, false, 30],
    ["Mehidy Hasan Miraz", "All-Rounder", false, false, 53],
    ["Rishad Hossain", "Bowler", false, false, 90],
    ["Taskin Ahmed", "Bowler", false, false, 3],
    ["Mustafizur Rahman", "Bowler", false, false, 90],
    ["Shoriful Islam", "Bowler", false, false, 47],
    ["Jaker Ali", "Wicket-Keeper", false, false, 22],
  ],
  Afghanistan: [
    ["Rahmanullah Gurbaz", "Wicket-Keeper", false, true, 21],
    ["Ibrahim Zadran", "Batter", false, false, 15],
    ["Gulbadin Naib", "All-Rounder", false, false, 14],
    ["Azmatullah Omarzai", "All-Rounder", false, false, 56],
    ["Mohammad Nabi", "All-Rounder", false, false, 7],
    ["Hashmatullah Shahidi", "Batter", true, false, 50],
    ["Najibullah Zadran", "Batter", false, false, 1],
    ["Rashid Khan", "Bowler", false, false, 19],
    ["Mujeeb Ur Rahman", "Bowler", false, false, 88],
    ["Naveen-ul-Haq", "Bowler", false, false, 78],
    ["Fazalhaq Farooqi", "Bowler", false, false, 5],
    ["Noor Ahmad", "Bowler", false, false, 75],
  ],
  "United Arab Emirates": [
    ["Muhammad Waseem", "Batter", true, false, 44],
    ["Vriitya Aravind", "Wicket-Keeper", false, true, 7],
    ["Aryansh Sharma", "Batter", false, false, 17],
    ["Asif Khan", "Batter", false, false, 24],
    ["Basil Hameed", "All-Rounder", false, false, 10],
    ["Rohan Mustafa", "All-Rounder", false, false, 55],
    ["Aayan Afzal Khan", "All-Rounder", false, false, 19],
    ["Mohammad Jawadullah", "Bowler", false, false, 33],
    ["Junaid Siddique", "Bowler", false, false, 29],
    ["Zahoor Khan", "Bowler", false, false, 6],
    ["Karthik Meiyappan", "Bowler", false, false, 4],
    ["Alishan Sharafu", "Batter", false, false, 8],
  ],
  "United States": [
    ["Monank Patel", "Wicket-Keeper", true, true, 24],
    ["Steven Taylor", "Batter", false, false, 8],
    ["Andries Gous", "Batter", false, false, 21],
    ["Aaron Jones", "Batter", false, false, 11],
    ["Corey Anderson", "All-Rounder", false, false, 42],
    ["Nitish Kumar", "All-Rounder", false, false, 7],
    ["Harmeet Singh", "All-Rounder", false, false, 10],
    ["Jasdeep Singh", "Bowler", false, false, 14],
    ["Saurabh Netravalkar", "Bowler", false, false, 20],
    ["Ali Khan", "Bowler", false, false, 18],
    ["Nosthush Kenjige", "Bowler", false, false, 3],
    ["Shayan Jahangir", "Batter", false, false, 12],
  ],
  Oman: [
    ["Aqib Ilyas", "All-Rounder", true, false, 45],
    ["Kashyap Prajapati", "Batter", false, false, 7],
    ["Pratik Athavale", "Wicket-Keeper", false, true, 11],
    ["Shoaib Khan", "Batter", false, false, 21],
    ["Zeeshan Maqsood", "All-Rounder", false, false, 5],
    ["Ayaan Khan", "All-Rounder", false, false, 29],
    ["Mohammad Nadeem", "All-Rounder", false, false, 33],
    ["Mehran Khan", "Bowler", false, false, 8],
    ["Bilal Khan", "Bowler", false, false, 12],
    ["Kaleemullah", "Bowler", false, false, 1],
    ["Fayyaz Butt", "Bowler", false, false, 6],
    ["Naseem Khushi", "Wicket-Keeper", false, false, 10],
  ],
  Ireland: [
    ["Paul Stirling", "Batter", true, false, 1],
    ["Andrew Balbirnie", "Batter", false, false, 14],
    ["Lorcan Tucker", "Wicket-Keeper", false, true, 3],
    ["Harry Tector", "Batter", false, false, 13],
    ["Curtis Campher", "All-Rounder", false, false, 85],
    ["George Dockrell", "All-Rounder", false, false, 50],
    ["Gareth Delany", "All-Rounder", false, false, 21],
    ["Mark Adair", "Bowler", false, false, 32],
    ["Barry McCarthy", "Bowler", false, false, 26],
    ["Josh Little", "Bowler", false, false, 82],
    ["Craig Young", "Bowler", false, false, 41],
    ["Ben White", "Bowler", false, false, 7],
  ],
  Scotland: [
    ["George Munsey", "Batter", false, false, 93],
    ["Michael Jones", "Batter", false, false, 17],
    ["Brandon McMullen", "All-Rounder", false, false, 13],
    ["Richie Berrington", "Batter", true, false, 44],
    ["Matthew Cross", "Wicket-Keeper", false, true, 24],
    ["Michael Leask", "All-Rounder", false, false, 29],
    ["Chris Greaves", "All-Rounder", false, false, 51],
    ["Mark Watt", "Bowler", false, false, 8],
    ["Safyaan Sharif", "Bowler", false, false, 10],
    ["Brad Wheal", "Bowler", false, false, 45],
    ["Charlie Cassell", "Bowler", false, false, 34],
    ["Jack Jarvis", "All-Rounder", false, false, 22],
  ],
  Zimbabwe: [
    ["Craig Ervine", "Batter", true, false, 77],
    ["Brian Bennett", "Batter", false, false, 31],
    ["Sean Williams", "All-Rounder", false, false, 26],
    ["Sikandar Raza", "All-Rounder", false, false, 24],
    ["Ryan Burl", "All-Rounder", false, false, 54],
    ["Clive Madande", "Wicket-Keeper", false, true, 17],
    ["Wellington Masakadza", "Bowler", false, false, 9],
    ["Blessing Muzarabani", "Bowler", false, false, 23],
    ["Richard Ngarava", "Bowler", false, false, 40],
    ["Tendai Chatara", "Bowler", false, false, 13],
    ["Luke Jongwe", "All-Rounder", false, false, 21],
    ["Tadiwanashe Marumani", "Batter", false, false, 5],
  ],
  Netherlands: [
    ["Max O'Dowd", "Batter", false, false, 4],
    ["Vikramjit Singh", "Batter", false, false, 25],
    ["Scott Edwards", "Wicket-Keeper", true, true, 35],
    ["Bas de Leede", "All-Rounder", false, false, 17],
    ["Teja Nidamanuru", "Batter", false, false, 21],
    ["Sybrand Engelbrecht", "Batter", false, false, 8],
    ["Logan van Beek", "All-Rounder", false, false, 34],
    ["Roelof van der Merwe", "All-Rounder", false, false, 52],
    ["Fred Klaassen", "Bowler", false, false, 12],
    ["Paul van Meekeren", "Bowler", false, false, 47],
    ["Tim Pringle", "Bowler", false, false, 7],
    ["Aryan Dutt", "Bowler", false, false, 88],
  ],
  "West Indies": [
    ["Brandon King", "Batter", false, false, 53],
    ["Johnson Charles", "Batter", false, false, 19],
    ["Nicholas Pooran", "Wicket-Keeper", false, true, 29],
    ["Rovman Powell", "Batter", true, false, 52],
    ["Sherfane Rutherford", "Batter", false, false, 50],
    ["Andre Russell", "All-Rounder", false, false, 12],
    ["Romario Shepherd", "All-Rounder", false, false, 66],
    ["Jason Holder", "All-Rounder", false, false, 98],
    ["Alzarri Joseph", "Bowler", false, false, 8],
    ["Akeal Hosein", "Bowler", false, false, 22],
    ["Gudakesh Motie", "Bowler", false, false, 77],
    ["Obed McCoy", "Bowler", false, false, 61],
  ],
};

const battingStyleFor = (name) => (["Kushal Malla", "Rachin Ravindra", "Devon Conway", "Finn Allen"].includes(name) ? "Left-hand bat" : "Right-hand bat");

const dismissal = (kind, bowlerIdx, fielderIdx, bowlingLineup, bowlingTeamDocs) => {
  if (!kind) return {};
  const bowlerName = bowlingTeamDocs[bowlerIdx]?.name || "bowler";
  const fielderName = bowlingTeamDocs[fielderIdx]?.name || bowlerName;
  const texts = {
    bowled: `b ${bowlerName}`,
    lbw: `lbw b ${bowlerName}`,
    caught: `c ${fielderName} b ${bowlerName}`,
    runOut: `run out (${fielderName})`,
    stumped: `st ${fielderName} b ${bowlerName}`,
    hitWicket: `hit wicket b ${bowlerName}`,
  };
  return {
    kind,
    text: texts[kind] || kind,
    bowler: kind === "runOut" ? undefined : bowlingLineup[bowlerIdx],
    fielder: ["caught", "runOut", "stumped"].includes(kind) ? bowlingLineup[fielderIdx] : undefined,
  };
};

const splitRuns = (total, count) => {
  if (!count) return [];
  const base = Math.floor(total / count);
  const rows = Array.from({ length: count }, () => base);
  let rem = total - base * count;
  const pattern = [2, 1, 0, 1, 2, 1, 0, 2, 1, 1, 0, 2];
  let i = 0;
  while (rem > 0) {
    rows[i % count] += Math.min(pattern[i % pattern.length], rem);
    rem -= Math.min(pattern[i % pattern.length], rem);
    i += 1;
  }
  return rows;
};

const overBallLabels = (runs, balls) => {
  const values = [6, 4, 2, 3, 1, 1, 0, 2, 4, 1, 0, 6];
  const labels = [];
  let left = runs;
  for (let i = 0; i < balls; i += 1) {
    const remainingBalls = balls - i - 1;
    let pick = values[(runs + i) % values.length];
    if (left - pick < 0 || left - pick > remainingBalls * 6) pick = Math.min(left, remainingBalls ? 1 : left);
    labels.push(String(pick));
    left -= pick;
  }
  if (left > 0) labels[labels.length - 1] = String(Number(labels[labels.length - 1]) + left);
  return labels;
};

const buildInnings = ({
  number,
  battingTeam,
  bowlingTeam,
  battingLineup,
  bowlingLineup,
  battingDocs,
  bowlingDocs,
  spec,
}) => {
  const extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0, ...(spec.extras || {}) };
  const extraTotal = Object.values(extras).reduce((a, b) => a + b, 0);
  const batting = spec.batters.map((row, index) => ({
    player: battingLineup[row.i],
    position: index,
    runs: row.r,
    balls: row.b,
    fours: row.f4 || 0,
    sixes: row.f6 || 0,
    out: Boolean(row.how),
    dismissal: dismissal(row.how, row.bowler, row.fielder, bowlingLineup, bowlingDocs),
  }));
  const bowling = spec.bowlers.map((row) => ({
    player: bowlingLineup[row.i],
    balls: row.b,
    maidens: row.m || 0,
    runs: row.r,
    wickets: row.w || 0,
    wides: 0,
    noBalls: 0,
  }));
  const runs = batting.reduce((sum, b) => sum + b.runs, 0) + extraTotal;
  const wickets = batting.filter((b) => b.out).length;
  const balls = spec.balls;
  const oversCount = Math.ceil(balls / 6);
  const overRuns = splitRuns(runs, oversCount);

  // assign overs to bowlers based on their ball allocation
  const ranges = [];
  let cursor = 0;
  for (const row of spec.bowlers) {
    ranges.push({ start: cursor, end: cursor + row.b, i: row.i });
    cursor += row.b;
  }
  const overs = [];
  for (let o = 1; o <= oversCount; o += 1) {
    const ballIndex = (o - 1) * 6;
    const range = ranges.find((r) => ballIndex >= r.start && ballIndex < r.end) || ranges[ranges.length - 1];
    const ballsInOver = Math.min(6, balls - (o - 1) * 6);
    overs.push({
      number: o,
      runs: overRuns[o - 1] || 0,
      wickets: 0,
      conceded: overRuns[o - 1] || 0,
      balls: [],
      bowler: bowlingLineup[range?.i ?? 0],
      completed: o < oversCount || balls % 6 === 0,
    });
  }

  // scatter wickets
  if (wickets) {
    for (let w = 1; w <= wickets; w += 1) {
      const idx = Math.min(oversCount - 1, Math.max(0, Math.round((w * oversCount) / (wickets + 1)) - 1));
      overs[idx].wickets += 1;
    }
  }

  if (spec.currentOver?.length) {
    const last = overs[overs.length - 1];
    if (last) {
      last.balls = spec.currentOver.map((label, i) => ({
        over: last.number,
        ball: i + 1,
        runs: Number(label.replace(/\D/g, "")) || 0,
        label,
        isWicket: label === "W",
        at: new Date(),
      }));
      last.runs = last.balls.reduce((sum, b) => sum + b.runs, 0);
      last.conceded = last.runs;
      last.completed = false;
    }
  } else if (balls % 6 !== 0) {
    const last = overs[overs.length - 1];
    if (last) {
      last.balls = overBallLabels(last.runs, balls % 6).map((label, i) => ({
        over: last.number,
        ball: i + 1,
        runs: Number(label) || 0,
        label,
        isWicket: false,
        at: new Date(),
      }));
    }
  }

  const fow = [];
  let cumulative = extraTotal;
  batting
    .filter((b) => b.out)
    .forEach((b, index) => {
      cumulative += b.runs;
      fow.push({
        wicket: index + 1,
        runs: Math.min(runs, cumulative),
        balls: Math.round((balls * (index + 1)) / Math.max(1, wickets + 1)),
        over: `${Math.floor((balls * (index + 1)) / Math.max(1, wickets + 1) / 6)}.${Math.round((balls * (index + 1)) / Math.max(1, wickets + 1)) % 6}`,
        player: b.player,
        text: b.dismissal?.text || "",
      });
    });

  const striker = spec.striker !== undefined ? battingLineup[spec.striker] : undefined;
  const nonStriker = spec.nonStriker !== undefined ? battingLineup[spec.nonStriker] : undefined;
  const bowler = spec.bowler !== undefined ? bowlingLineup[spec.bowler] : undefined;

  const innings = {
    number,
    battingTeam,
    bowlingTeam,
    runs,
    wickets,
    balls,
    extras,
    batting,
    bowling,
    fow,
    overs,
    partnerships: [],
    striker,
    nonStriker,
    bowler,
    lastBowler: undefined,
    needsBowler: false,
    freeHit: false,
    target: spec.target ?? null,
    completed: Boolean(spec.completed),
    declared: false,
    startedAt: spec.startedAt || new Date(Date.now() - 2 * 60 * 60 * 1000),
    endedAt: spec.completed ? new Date() : undefined,
  };

  if (!innings.completed && striker && nonStriker) {
    const strikerRow = spec.batters.find((b) => b.i === spec.striker);
    const nonStrikerRow = spec.batters.find((b) => b.i === spec.nonStriker);
    innings.partnerships.push({
      playerA: striker,
      playerB: nonStriker,
      runs: (strikerRow?.r || 0) + (nonStrikerRow?.r || 0),
      balls: (strikerRow?.b || 0) + (nonStrikerRow?.b || 0),
      unbroken: true,
    });
  }

  return innings;
};

const seededVideo = (title, type, opts = {}) => ({
  title,
  description: opts.description || "From the Bethub cricket desk.",
  type,
  url: opts.url || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  publicId: `seed/videos/${slugify(title)}`,
  thumbnail: opts.thumbnail || UNS("photo-1531415074968-036ba1b575da"),
  duration: opts.duration || 34,
  bytes: opts.bytes || 4_200_000,
  format: "mp4",
  views: opts.views || 1200,
  likes: opts.likes || 84,
  isFeatured: Boolean(opts.isFeatured),
});

const main = async () => {
  const fresh = process.argv.includes("--fresh");
  await connectDatabase();
  await bootstrap();

  if (!fresh) {
    const existing = await Match.countDocuments();
    if (existing) {
      logger.warn(`Database already has ${existing} matches. Run "npm run seed:fresh" to rebuild the demo.`);
      await mongoose.disconnect();
      return;
    }
  } else {
    logger.warn("Clearing demo collections…");
    await Promise.all([
      Match.deleteMany({}),
      Ball.deleteMany({}),
      Video.deleteMany({}),
      ChatMessage.deleteMany({}),
      Team.deleteMany({}),
      Player.deleteMany({}),
      Country.deleteMany({}),
    ]);
  }

  // ── countries ────────────────────────────────────────────
  const countryDocs = {};
  for (const row of COUNTRIES) {
    const doc = await Country.create({
      name: row.name,
      code: row.code,
      color: row.color,
      flag: { url: row.flag, publicId: "" },
    });
    countryDocs[row.name] = doc;
  }

  // ── players & teams ─────────────────────────────────────
  const playerDocs = {};
  const teamDocs = {};
  let photoIndex = 1;
  for (const [teamName, rows] of Object.entries(squads)) {
    const country = countryDocs[teamName];
    const players = [];
    for (const [name, role, captain, keeper, jersey] of rows) {
      const doc = await Player.create({
        name,
        slug: `${slugify(name)}-${String(photoIndex).padStart(3, "0")}`,
        country: country._id,
        role,
        battingStyle: battingStyleFor(name),
        bowlingStyle:
          role === "Bowler" || role === "All-Rounder"
            ? name.includes("Kuldeep") || name.includes("Wellalage") || name.includes("Shamsi")
              ? "Left-arm wrist-spin"
              : "Right-arm fast"
            : "None",
        jerseyNumber: jersey,
        photo: { url: AVATAR(photoIndex), publicId: "" },
        isCaptain: captain,
        isWicketkeeper: keeper,
        isActive: true,
      });
      players.push(doc);
      photoIndex += 1;
    }
    const team = await Team.create({
      name: teamName,
      shortName: teamName === "New Zealand" ? "NZ" : teamName === "South Africa" ? "SA" : teamName === "Sri Lanka" ? "SL" : teamName.slice(0, 3).toUpperCase(),
      country: country._id,
      logo: { url: country.flag.url, publicId: "" },
      color: country.color,
      players: players.map((p) => p._id),
      captain: players.find((p) => p.isCaptain)?._id,
      wicketkeeper: players.find((p) => p.isWicketkeeper)?._id,
      homeGround: `${teamName} National Ground`,
    });
    playerDocs[teamName] = players;
    teamDocs[teamName] = team;
  }

  const makeMatch = async ({
    a,
    b,
    series,
    format = "T20",
    overs = 20,
    venue,
    city,
    startTime,
    status,
    tossWinner,
    tossDecision,
    inningsSpecs,
    currentInnings = 0,
    resultText,
    featured = false,
    stream,
    matchNumber,
  }) => {
    const teamA = teamDocs[a];
    const teamB = teamDocs[b];
    const lineupA = playerDocs[a].slice(0, 11).map((p, i) => ({
      player: p._id,
      order: i,
      isCaptain: p.isCaptain,
      isKeeper: p.isWicketkeeper,
    }));
    const lineupB = playerDocs[b].slice(0, 11).map((p, i) => ({
      player: p._id,
      order: i,
      isCaptain: p.isCaptain,
      isKeeper: p.isWicketkeeper,
    }));

    const innings = inningsSpecs.map((spec) => {
      const battingSlot = spec.battingSlot;
      const battingTeam = battingSlot === "A" ? teamA._id : teamB._id;
      const bowlingTeam = battingSlot === "A" ? teamB._id : teamA._id;
      return buildInnings({
        number: spec.number || 0,
        battingTeam,
        bowlingTeam,
        battingLineup: (battingSlot === "A" ? lineupA : lineupB).map((l) => l.player),
        bowlingLineup: (battingSlot === "A" ? lineupB : lineupA).map((l) => l.player),
        battingDocs: battingSlot === "A" ? playerDocs[a] : playerDocs[b],
        bowlingDocs: battingSlot === "A" ? playerDocs[b] : playerDocs[a],
        spec,
      });
    });

    const match = new Match({
      matchNumber: matchNumber || 1,
      title: `${teamA.shortName} vs ${teamB.shortName}`,
      series,
      format,
      overs,
      teamA: teamA._id,
      teamB: teamB._id,
      lineups: { A: lineupA, B: lineupB },
      venue,
      city,
      startTime,
      status,
      toss: {
        winner: tossWinner === "A" ? teamA._id : teamB._id,
        winnerSlot: tossWinner,
        decision: tossDecision,
        text: `${tossWinner === "A" ? teamA.name : teamB.name} won the toss and chose to ${tossDecision}`,
      },
      currentInnings,
      innings,
      target: innings[currentInnings]?.target || null,
      isFeatured: featured,
      views: 1000 + Math.floor(Math.random() * 8000),
      officials: {
        umpires: "A. Raza, M. Erasmus",
        referee: "R. Madugalle",
        scorer: "Bethub Live Desk",
      },
      stream: stream || {},
    });

    if (status === "finished") {
      const result = computeResult({
        teamA,
        teamB,
        overs,
        innings,
        lineups: { A: lineupA, B: lineupB },
      });
      match.result = result;
      const winningTeamName = String(result.winner) === String(teamA._id) ? a : b;
      const pool = innings.flatMap((inn) =>
        inn.batting
          .filter((bat) => String(bat.battingTeam) !== "")
          .map((bat) => bat)
      );
      const winnerPool = innings
        .filter((inn) => String(inn.battingTeam) === String(result.winner))
        .flatMap((inn) => inn.batting);
      const best = [...winnerPool].sort((x, y) => y.runs - x.runs)[0] || pool[0];
      if (best) match.playerOfMatch = best.player;
      void winningTeamName;
    }

    match.markModified("innings");
    await match.save();
    return match;
  };

  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  const streamBase = {
    mode: "hls",
    hlsUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    thumbnail: UNS("photo-1540747913346-19e32dc3e97e", 1400),
    title: "Bethub Live",
  };

  // ── live match 1 · Nepal vs India ────────────────────────
  const live1 = await makeMatch({
    a: "Nepal",
    b: "India",
    series: "Bethub Asia Cup 2026",
    venue: "Tribhuvan University Ground",
    city: "Kirtipur, Nepal",
    startTime: new Date(now - 65 * 60 * 1000),
    status: "live",
    tossWinner: "B",
    tossDecision: "bowl",
    featured: true,
    matchNumber: 4,
    inningsSpecs: [
      {
        battingSlot: "A",
        balls: 86,
        extras: { wides: 4, noBalls: 1, byes: 2, legByes: 2 },
        batters: [
          { i: 0, r: 42, b: 28, f4: 5, f6: 2, how: "caught", bowler: 9, fielder: 2 },
          { i: 1, r: 18, b: 16, f4: 2, f6: 0, how: "bowled", bowler: 10 },
          { i: 2, r: 31, b: 24, f4: 3, f6: 1 },
          { i: 3, r: 12, b: 10, f4: 1, f6: 0, how: "lbw", bowler: 8 },
          { i: 4, r: 6, b: 8, f4: 1, f6: 0 },
        ],
        bowlers: [
          { i: 9, b: 18, r: 24, w: 1 },
          { i: 10, b: 18, r: 29, w: 1 },
          { i: 8, b: 18, r: 20, w: 1 },
          { i: 5, b: 12, r: 17, w: 0 },
          { i: 6, b: 12, r: 14, w: 0 },
          { i: 7, b: 8, r: 10, w: 0 },
        ],
        striker: 2,
        nonStriker: 4,
        bowler: 7,
        currentOver: ["4", "4"],
      },
    ],
    stream: {
      ...streamBase,
      isLive: true,
      slug: "nepal-vs-india-live",
      playbackUrl: `${env.publicUrl.replace(/\/$/, "")}/live/nepal-vs-india-live`,
      streamKey: "demo-nep-ind-key",
      title: "Nepal vs India · LIVE from Kirtipur",
      startedAt: new Date(now - 55 * 60 * 1000),
      viewers: 1284,
      totalViews: 28140,
    },
  });

  // ── live match 2 · Australia vs England ──────────────────
  const live2 = await makeMatch({
    a: "Australia",
    b: "England",
    series: "Bethub Championship 2026",
    venue: "Melbourne Cricket Ground",
    city: "Melbourne, Australia",
    startTime: new Date(now - 100 * 60 * 1000),
    status: "live",
    tossWinner: "B",
    tossDecision: "bat",
    matchNumber: 7,
    currentInnings: 1,
    inningsSpecs: [
      {
        battingSlot: "B",
        balls: 120,
        completed: true,
        extras: { wides: 7, noBalls: 0, byes: 2, legByes: 0 },
        batters: [
          { i: 0, r: 44, b: 25, f4: 4, f6: 2, how: "caught", bowler: 8, fielder: 0 },
          { i: 1, r: 61, b: 38, f4: 6, f6: 2, how: "bowled", bowler: 9 },
          { i: 3, r: 28, b: 22, f4: 2, f6: 1, how: "caught", bowler: 10, fielder: 2 },
          { i: 4, r: 17, b: 14, f4: 1, f6: 1, how: "lbw", bowler: 8 },
          { i: 5, r: 9, b: 10, f4: 1, f6: 0, how: "caught", bowler: 8, fielder: 4 },
          { i: 6, r: 6, b: 7, f4: 0, f6: 0, how: "runOut", fielder: 3 },
          { i: 7, r: 2, b: 4, f4: 0, f6: 0 },
        ],
        bowlers: [
          { i: 8, b: 24, r: 39, w: 2 },
          { i: 9, b: 24, r: 33, w: 1 },
          { i: 10, b: 24, r: 31, w: 1 },
          { i: 7, b: 24, r: 29, w: 2 },
          { i: 3, b: 24, r: 42, w: 0 },
        ],
      },
      {
        battingSlot: "A",
        number: 1,
        balls: 94,
        target: 177,
        extras: { wides: 4, noBalls: 0, byes: 2, legByes: 0 },
        batters: [
          { i: 0, r: 58, b: 34, f4: 7, f6: 3, how: "caught", bowler: 8, fielder: 1 },
          { i: 1, r: 31, b: 28, f4: 3, f6: 0, how: "bowled", bowler: 7 },
          { i: 2, r: 38, b: 24, f4: 2, f6: 2 },
          { i: 3, r: 9, b: 8, f4: 0, f6: 1 },
        ],
        bowlers: [
          { i: 8, b: 18, r: 29, w: 1 },
          { i: 7, b: 18, r: 26, w: 1 },
          { i: 9, b: 24, r: 31, w: 0 },
          { i: 6, b: 18, r: 30, w: 0 },
          { i: 10, b: 16, r: 24, w: 0 },
        ],
        striker: 2,
        nonStriker: 3,
        bowler: 10,
        currentOver: ["6", "1", "4", "0"],
      },
    ],
    stream: {
      ...streamBase,
      isLive: true,
      slug: "australia-vs-england-live",
      playbackUrl: `${env.publicUrl.replace(/\/$/, "")}/live/australia-vs-england-live`,
      streamKey: "demo-aus-eng-key",
      title: "Australia vs England · LIVE from the MCG",
      startedAt: new Date(now - 90 * 60 * 1000),
      viewers: 842,
      totalViews: 19420,
    },
  });

  // ── finished matches ─────────────────────────────────────
  const finished1 = await makeMatch({
    a: "India",
    b: "Australia",
    series: "Bethub Championship 2026",
    venue: "Narendra Modi Stadium",
    city: "Ahmedabad, India",
    startTime: new Date(now - 2 * day),
    status: "finished",
    tossWinner: "B",
    tossDecision: "bat",
    matchNumber: 5,
    inningsSpecs: [
      {
        battingSlot: "B",
        balls: 120,
        completed: true,
        extras: { wides: 10, noBalls: 3, byes: 2, legByes: 2 },
        batters: [
          { i: 0, r: 38, b: 25, f4: 5, f6: 1, how: "caught", bowler: 9, fielder: 4 },
          { i: 1, r: 20, b: 18, f4: 3, f6: 0, how: "bowled", bowler: 10 },
          { i: 2, r: 40, b: 30, f4: 3, f6: 2, how: "lbw", bowler: 8 },
          { i: 3, r: 26, b: 20, f4: 2, f6: 2, how: "caught", bowler: 6, fielder: 2 },
          { i: 4, r: 10, b: 12, f4: 1, f6: 0, how: "runOut", fielder: 5 },
          { i: 5, r: 8, b: 8, f4: 0, f6: 0, how: "caught", bowler: 9, fielder: 7 },
          { i: 7, r: 2, b: 4, f4: 0, f6: 0, how: "bowled", bowler: 10 },
          { i: 8, r: 1, b: 3, f4: 0, f6: 0 },
        ],
        bowlers: [
          { i: 9, b: 24, r: 25, w: 2 },
          { i: 10, b: 24, r: 30, w: 1 },
          { i: 8, b: 24, r: 26, w: 2 },
          { i: 6, b: 24, r: 33, w: 1 },
          { i: 5, b: 24, r: 44, w: 1 },
        ],
      },
      {
        battingSlot: "A",
        number: 1,
        balls: 111,
        target: 163,
        completed: true,
        extras: { wides: 5, noBalls: 0, byes: 2, legByes: 0 },
        batters: [
          { i: 0, r: 52, b: 30, f4: 6, f6: 3, how: "caught", bowler: 8, fielder: 4 },
          { i: 1, r: 34, b: 26, f4: 4, f6: 1, how: "bowled", bowler: 9 },
          { i: 2, r: 48, b: 32, f4: 4, f6: 1 },
          { i: 3, r: 12, b: 9, f4: 1, f6: 0, how: "lbw", bowler: 10 },
          { i: 5, r: 5, b: 4, f4: 0, f6: 0, how: "runOut", fielder: 3 },
          { i: 4, r: 8, b: 10, f4: 0, f6: 0 },
        ],
        bowlers: [
          { i: 8, b: 24, r: 36, w: 1 },
          { i: 9, b: 24, r: 31, w: 1 },
          { i: 10, b: 18, r: 29, w: 1 },
          { i: 7, b: 24, r: 31, w: 1 },
          { i: 3, b: 12, r: 22, w: 0 },
          { i: 5, b: 9, r: 15, w: 0 },
        ],
      },
    ],
    stream: {
      ...streamBase,
      isLive: false,
      slug: "india-vs-australia-replay",
      playbackUrl: `${env.publicUrl.replace(/\/$/, "")}/live/india-vs-australia-replay`,
      recordingUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
      recordingBytes: 42_000_000,
      recordingDuration: 3120,
      endedAt: new Date(now - 2 * day + 3 * hour),
      totalViews: 47210,
      viewers: 0,
      title: "Full replay · India vs Australia",
    },
  });

  const finished2 = await makeMatch({
    a: "England",
    b: "Pakistan",
    series: "Bethub Championship 2026",
    venue: "Lord's",
    city: "London, England",
    startTime: new Date(now - 3 * day),
    status: "finished",
    tossWinner: "A",
    tossDecision: "bat",
    matchNumber: 3,
    inningsSpecs: [
      {
        battingSlot: "A",
        balls: 120,
        completed: true,
        extras: { wides: 4, noBalls: 1, byes: 1, legByes: 0 },
        batters: [
          { i: 0, r: 48, b: 27, f4: 5, f6: 3, how: "caught", bowler: 8, fielder: 3 },
          { i: 1, r: 55, b: 33, f4: 6, f6: 2, how: "bowled", bowler: 9 },
          { i: 3, r: 32, b: 24, f4: 2, f6: 2, how: "caught", bowler: 10, fielder: 1 },
          { i: 4, r: 18, b: 12, f4: 1, f6: 1, how: "lbw", bowler: 5 },
          { i: 5, r: 12, b: 10, f4: 1, f6: 0, how: "caught", bowler: 8, fielder: 0 },
          { i: 6, r: 8, b: 8, f4: 0, f6: 0 },
          { i: 7, r: 2, b: 6, f4: 0, f6: 0 },
        ],
        bowlers: [
          { i: 8, b: 24, r: 34, w: 2 },
          { i: 9, b: 24, r: 31, w: 1 },
          { i: 10, b: 24, r: 38, w: 1 },
          { i: 7, b: 24, r: 34, w: 0 },
          { i: 5, b: 24, r: 37, w: 1 },
        ],
      },
      {
        battingSlot: "B",
        number: 1,
        balls: 120,
        target: 182,
        completed: true,
        extras: { wides: 6, noBalls: 1, byes: 3, legByes: 2 },
        batters: [
          { i: 0, r: 44, b: 32, f4: 4, f6: 2, how: "caught", bowler: 8, fielder: 1 },
          { i: 1, r: 31, b: 27, f4: 3, f6: 0, how: "bowled", bowler: 7 },
          { i: 2, r: 22, b: 18, f4: 2, f6: 1, how: "caught", bowler: 9, fielder: 3 },
          { i: 3, r: 15, b: 14, f4: 2, f6: 0, how: "lbw", bowler: 6 },
          { i: 4, r: 12, b: 9, f4: 1, f6: 1, how: "caught", bowler: 10, fielder: 4 },
          { i: 5, r: 9, b: 8, f4: 1, f6: 0, how: "runOut", fielder: 5 },
          { i: 6, r: 6, b: 6, f4: 0, f6: 0, how: "bowled", bowler: 8 },
          { i: 7, r: 4, b: 3, f4: 1, f6: 0, how: "caught", bowler: 9, fielder: 0 },
          { i: 8, r: 2, b: 2, f4: 0, f6: 0 },
          { i: 9, r: 0, b: 1, f4: 0, f6: 0, how: "bowled", bowler: 10 },
        ],
        bowlers: [
          { i: 8, b: 24, r: 28, w: 2 },
          { i: 7, b: 24, r: 26, w: 1 },
          { i: 9, b: 24, r: 32, w: 2 },
          { i: 6, b: 24, r: 33, w: 0 },
          { i: 10, b: 24, r: 29, w: 2 },
        ],
      },
    ],
  });

  const finished3 = await makeMatch({
    a: "Nepal",
    b: "Sri Lanka",
    series: "Bethub Asia Cup 2026",
    venue: "TU Cricket Ground",
    city: "Kirtipur, Nepal",
    startTime: new Date(now - 4 * day),
    status: "finished",
    tossWinner: "B",
    tossDecision: "bat",
    matchNumber: 3,
    inningsSpecs: [
      {
        battingSlot: "B",
        balls: 120,
        completed: true,
        extras: { wides: 4, noBalls: 1, byes: 1, legByes: 1 },
        batters: [
          { i: 0, r: 38, b: 29, f4: 4, f6: 1, how: "caught", bowler: 8, fielder: 1 },
          { i: 1, r: 27, b: 22, f4: 3, f6: 0, how: "bowled", bowler: 9 },
          { i: 2, r: 21, b: 18, f4: 2, f6: 1, how: "caught", bowler: 10, fielder: 4 },
          { i: 3, r: 25, b: 20, f4: 2, f6: 1, how: "lbw", bowler: 3 },
          { i: 4, r: 12, b: 12, f4: 1, f6: 0, how: "runOut", fielder: 6 },
          { i: 5, r: 9, b: 8, f4: 1, f6: 0, how: "caught", bowler: 9, fielder: 0 },
          { i: 6, r: 6, b: 7, f4: 0, f6: 0, how: "bowled", bowler: 10 },
          { i: 7, r: 3, b: 3, f4: 0, f6: 0, how: "lbw", bowler: 7 },
          { i: 9, r: 1, b: 1, f4: 0, f6: 0 },
        ],
        bowlers: [
          { i: 8, b: 24, r: 32, w: 1 },
          { i: 9, b: 24, r: 27, w: 2 },
          { i: 10, b: 24, r: 25, w: 2 },
          { i: 3, b: 24, r: 29, w: 1 },
          { i: 7, b: 24, r: 29, w: 1 },
        ],
      },
      {
        battingSlot: "A",
        number: 1,
        balls: 115,
        target: 150,
        completed: true,
        extras: { wides: 3, noBalls: 0, byes: 1, legByes: 1 },
        batters: [
          { i: 0, r: 45, b: 33, f4: 5, f6: 2, how: "caught", bowler: 8, fielder: 1 },
          { i: 1, r: 28, b: 24, f4: 3, f6: 0, how: "bowled", bowler: 9 },
          { i: 2, r: 39, b: 30, f4: 3, f6: 2, how: "caught", bowler: 10, fielder: 3 },
          { i: 3, r: 18, b: 14, f4: 1, f6: 1, how: "lbw", bowler: 5 },
          { i: 4, r: 10, b: 8, f4: 1, f6: 0, how: "runOut", fielder: 4 },
          { i: 5, r: 5, b: 4, f4: 0, f6: 0, how: "caught", bowler: 6, fielder: 2 },
          { i: 6, r: 3, b: 2, f4: 0, f6: 0 },
        ],
        bowlers: [
          { i: 8, b: 24, r: 29, w: 1 },
          { i: 9, b: 24, r: 31, w: 1 },
          { i: 10, b: 24, r: 33, w: 1 },
          { i: 5, b: 24, r: 27, w: 1 },
          { i: 6, b: 19, r: 27, w: 2 },
        ],
      },
    ],
  });

  const finished4 = await makeMatch({
    a: "South Africa",
    b: "New Zealand",
    series: "Bethub Championship 2026",
    venue: "Newlands",
    city: "Cape Town, South Africa",
    startTime: new Date(now - 5 * day),
    status: "finished",
    tossWinner: "A",
    tossDecision: "bat",
    matchNumber: 2,
    inningsSpecs: [
      {
        battingSlot: "A",
        balls: 120,
        completed: true,
        extras: { wides: 5, noBalls: 1, byes: 2, legByes: 1 },
        batters: [
          { i: 0, r: 42, b: 30, f4: 4, f6: 2, how: "caught", bowler: 8, fielder: 1 },
          { i: 1, r: 28, b: 25, f4: 2, f6: 1, how: "bowled", bowler: 9 },
          { i: 2, r: 35, b: 26, f4: 3, f6: 2, how: "lbw", bowler: 10 },
          { i: 3, r: 22, b: 16, f4: 1, f6: 2, how: "caught", bowler: 7, fielder: 4 },
          { i: 4, r: 12, b: 12, f4: 1, f6: 0, how: "runOut", fielder: 5 },
          { i: 5, r: 8, b: 7, f4: 1, f6: 0, how: "caught", bowler: 8, fielder: 0 },
          { i: 6, r: 2, b: 4, f4: 0, f6: 0 },
        ],
        bowlers: [
          { i: 8, b: 24, r: 30, w: 1 },
          { i: 9, b: 24, r: 28, w: 1 },
          { i: 10, b: 24, r: 33, w: 1 },
          { i: 7, b: 24, r: 32, w: 1 },
          { i: 6, b: 24, r: 26, w: 1 },
        ],
      },
      {
        battingSlot: "B",
        number: 1,
        balls: 118,
        target: 159,
        completed: true,
        extras: { wides: 4, noBalls: 0, byes: 2, legByes: 2 },
        batters: [
          { i: 0, r: 38, b: 30, f4: 3, f6: 2, how: "caught", bowler: 8, fielder: 1 },
          { i: 1, r: 24, b: 16, f4: 2, f6: 2, how: "bowled", bowler: 9 },
          { i: 2, r: 46, b: 36, f4: 4, f6: 1 },
          { i: 3, r: 22, b: 18, f4: 1, f6: 1, how: "caught", bowler: 10, fielder: 4 },
          { i: 4, r: 14, b: 11, f4: 1, f6: 1, how: "lbw", bowler: 5 },
          { i: 5, r: 6, b: 5, f4: 0, f6: 0, how: "runOut", fielder: 3 },
          { i: 6, r: 3, b: 2, f4: 0, f6: 0 },
          { i: 8, r: 0, b: 1, f4: 0, f6: 0, how: "runOut", fielder: 2 },
        ],
        bowlers: [
          { i: 8, b: 24, r: 31, w: 1 },
          { i: 9, b: 24, r: 28, w: 1 },
          { i: 10, b: 24, r: 32, w: 1 },
          { i: 7, b: 24, r: 30, w: 1 },
          { i: 5, b: 22, r: 30, w: 2 },
        ],
      },
    ],
  });

  const finished5 = await makeMatch({
    a: "India",
    b: "England",
    series: "Bethub Championship 2026",
    venue: "Eden Gardens",
    city: "Kolkata, India",
    startTime: new Date(now - 6 * day),
    status: "finished",
    tossWinner: "B",
    tossDecision: "bat",
    matchNumber: 1,
    inningsSpecs: [
      {
        battingSlot: "B",
        balls: 120,
        completed: true,
        extras: { wides: 9, noBalls: 2, byes: 4, legByes: 4 },
        batters: [
          { i: 0, r: 30, b: 24, f4: 3, f6: 1, how: "caught", bowler: 9, fielder: 4 },
          { i: 1, r: 38, b: 30, f4: 4, f6: 1, how: "bowled", bowler: 10 },
          { i: 3, r: 26, b: 22, f4: 2, f6: 1, how: "caught", bowler: 8, fielder: 5 },
          { i: 4, r: 14, b: 12, f4: 1, f6: 1, how: "lbw", bowler: 7 },
          { i: 5, r: 10, b: 9, f4: 1, f6: 0, how: "runOut", fielder: 2 },
          { i: 6, r: 8, b: 7, f4: 0, f6: 0, how: "caught", bowler: 9, fielder: 0 },
          { i: 7, r: 6, b: 6, f4: 1, f6: 0, how: "bowled", bowler: 10 },
          { i: 8, r: 2, b: 3, f4: 0, f6: 0, how: "caught", bowler: 8, fielder: 7 },
          { i: 9, r: 1, b: 7, f4: 0, f6: 0 },
        ],
        bowlers: [
          { i: 9, b: 24, r: 29, w: 2 },
          { i: 10, b: 24, r: 28, w: 2 },
          { i: 8, b: 24, r: 30, w: 2 },
          { i: 6, b: 24, r: 32, w: 1 },
          { i: 5, b: 24, r: 31, w: 1 },
        ],
      },
      {
        battingSlot: "A",
        number: 1,
        balls: 107,
        target: 155,
        completed: true,
        extras: { wides: 3, noBalls: 0, byes: 2, legByes: 1 },
        batters: [
          { i: 0, r: 61, b: 38, f4: 7, f6: 3, how: "caught", bowler: 8, fielder: 1 },
          { i: 1, r: 42, b: 31, f4: 4, f6: 2, how: "bowled", bowler: 9 },
          { i: 2, r: 35, b: 25, f4: 3, f6: 1 },
          { i: 3, r: 8, b: 6, f4: 1, f6: 0, how: "lbw", bowler: 10 },
          { i: 4, r: 5, b: 7, f4: 0, f6: 0 },
        ],
        bowlers: [
          { i: 8, b: 24, r: 34, w: 1 },
          { i: 7, b: 24, r: 29, w: 1 },
          { i: 9, b: 24, r: 31, w: 0 },
          { i: 10, b: 24, r: 33, w: 1 },
          { i: 6, b: 11, r: 24, w: 0 },
        ],
      },
    ],
  });

  // ── upcoming ────────────────────────────────────────────
  const upcoming = [
    {
      a: "Pakistan",
      b: "Sri Lanka",
      series: "Bethub Asia Cup 2026",
      venue: "Gaddafi Stadium",
      city: "Lahore, Pakistan",
      startTime: new Date(now + 1 * day + 3 * hour),
      matchNumber: 5,
    },
    {
      a: "India",
      b: "South Africa",
      series: "Bethub Championship 2026",
      venue: "Wankhede Stadium",
      city: "Mumbai, India",
      startTime: new Date(now + 2 * day + 5 * hour),
      matchNumber: 8,
    },
    {
      a: "England",
      b: "New Zealand",
      series: "Bethub Championship 2026",
      venue: "The Oval",
      city: "London, England",
      startTime: new Date(now + 3 * day + 2 * hour),
      matchNumber: 9,
    },
    {
      a: "Nepal",
      b: "Pakistan",
      series: "Bethub Asia Cup 2026",
      venue: "TU Cricket Ground",
      city: "Kirtipur, Nepal",
      startTime: new Date(now + 4 * day + 4 * hour),
      matchNumber: 6,
    },
  ];

  for (const row of upcoming) {
    await makeMatch({
      ...row,
      format: "T20",
      status: "upcoming",
      tossWinner: "A",
      tossDecision: "bat",
      inningsSpecs: [],
    });
  }

  // ── videos / shorts ─────────────────────────────────────
  const thumbs = [
    UNS("photo-1531415074968-036ba1b575da"),
    UNS("photo-1540747913346-19e32dc3e97e"),
    UNS("photo-1593341646782-e0b495cff86d"),
    UNS("photo-1624526267942-ab0f4c3d2c1a"),
    UNS("photo-1516233758813-a38d024919c5"),
    UNS("photo-1579952363873-27f3bade9f55"),
    UNS("photo-1546608235-3310a2494cdf"),
    UNS("photo-1571019613454-1cb2f99b2d8b"),
  ];
  const sampleVideos = [
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
  ];
  const shortsData = [
    ["Rohit's no-look six that broke the internet", 28, 840000],
    ["Kushal Bhurtel's fearless start in Kirtipur", 34, 260000],
    ["Bumrah's unplayable yorker from last night", 19, 1200000],
    ["Every boundary from Nepal's powerplay", 46, 410000],
    ["Maxwell reverse-sweep masterclass", 24, 680000],
    ["The best catches of the week", 58, 930000],
    ["Shaheen's fiery first over", 31, 510000],
    ["MCG erupts: Marsh goes big", 22, 380000],
  ];
  for (let i = 0; i < shortsData.length; i += 1) {
    const [title, duration, views] = shortsData[i];
    await Video.create(
      seededVideo(title, "short", {
        duration,
        views,
        thumbnail: thumbs[i % thumbs.length],
        url: sampleVideos[i % sampleVideos.length],
        likes: Math.round(views / 1000),
      })
    );
  }
  const longData = [
    ["Nepal vs India · Full match replay", 3120, live1],
    ["Australia vs England · Full match replay", 2980, live2],
    ["Bethub Championship · Week 1 highlights", 620, finished1],
    ["India vs Australia · Classic chase, 2026", 840, finished1],
  ];
  for (let i = 0; i < longData.length; i += 1) {
    const [title, duration, matchDoc] = longData[i];
    await Video.create({
      ...seededVideo(title, i < 2 ? "long" : "highlight", {
        duration,
        views: 120000 + i * 42000,
        thumbnail: thumbs[(i + 3) % thumbs.length],
        url: sampleVideos[(i + 1) % sampleVideos.length],
        isFeatured: i === 0,
      }),
      match: matchDoc?._id,
    });
  }

  // ── live chat ───────────────────────────────────────────
  const chatSeed = [
    ["Aarav", "Nepal 118/3 — this is our best powerplay of the tournament 🔥", "#00e28a"],
    ["Bibek", "Paudel needs to bat through. 160+ is game on!", "#38bdf8"],
    ["Riya", "That six from Bhurtel was HUGE 😮", "#f472b6"],
    ["Sahil", "Bumrah's yorker, wow. Nothing you can do about that.", "#facc15"],
    ["Maya", "Kirtipur is absolutely rocking tonight 💚", "#a78bfa"],
  ];
  for (const [name, body, color] of chatSeed) {
    await ChatMessage.create({ match: live1._id, user: name, body, avatarColor: color });
  }
  await ChatMessage.create({
    match: live2._id,
    user: "Josh",
    body: "Marsh is timing everything from the middle. England need a wicket now.",
    avatarColor: "#38bdf8",
  });

  logger.ok("Demo data seeded successfully");
  logger.info("Admin login →", env.admin.email, "/", env.admin.password);
  logger.info(`Live links → ${env.publicUrl.replace(/\/$/, "")}/live/nepal-vs-india-live`);
  logger.info(`            ${env.publicUrl.replace(/\/$/, "")}/live/australia-vs-england-live`);
  await mongoose.disconnect();
};

main().catch(async (error) => {
  logger.error("Seed failed:", error.message);
  logger.error(error.stack);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
