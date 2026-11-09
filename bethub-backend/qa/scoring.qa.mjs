const base = "http://localhost:5000/api";
let token = "";
const idOf = (value) => String(value?._id || value || "");

async function api(path, { method = "GET", body, auth = true } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(`${method} ${path} -> ${res.status}: ${data.message || JSON.stringify(data)}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

const check = (label, condition, detail = "") => {
  if (!condition) throw new Error(`FAIL: ${label}${detail ? `\n${detail}` : ""}`);
  console.log(`PASS: ${label}`);
};

const cleanup = async () => {
  try {
    const recent = await api("/matches?limit=150");
    const leftovers = recent.matches.filter((m) => m.series === "Bethub QA Automation");
    for (const m of leftovers) {
      if (["live", "innings-break"].includes(m.status)) {
        await api(`/matches/${m._id}/reset`, { method: "POST", body: { confirm: true } });
      }
      await api(`/matches/${m._id}`, { method: "DELETE" });
      console.log(`Cleaned up QA match ${m._id}`);
    }
  } catch (error) {
    console.error("Cleanup warning:", error.message);
  }
};

const login = await api("/auth/login", {
  method: "POST",
  auth: false,
  body: { email: "admin@bethub.com", password: "Bethub@123" },
});
token = login.token;
check("admin login returns token", Boolean(token));
await cleanup();

let id = "";
try {
  const teams = await api("/teams?limit=20");
  check("teams available", teams.teams.length >= 2, JSON.stringify(teams.teams?.map((t) => t.name)));
  const teamA = teams.teams.find((t) => t.shortName === "NEP");
  const teamB = teams.teams.find((t) => t.shortName === "IND");

  const created = await api("/matches", {
    method: "POST",
    body: {
      teamA: teamA._id,
      teamB: teamB._id,
      series: "Bethub QA Automation",
      format: "T10",
      overs: 1,
      venue: "QA Oval",
      city: "Test City",
      startTime: new Date(Date.now() + 60000).toISOString(),
      toss: { winnerSlot: "A", decision: "bat" },
      title: "QA NEP vs IND",
    },
  });
  id = created.match._id;
  check("match created with default lineups", created.match.lineups.A.length >= 2 && created.match.lineups.B.length >= 2);
  console.log(`Match ${id} created`);

  let started = (await api(`/matches/${id}/start`, { method: "POST" })).match;
  check("match starts and first innings exists", started.status === "live" && started.innings.length === 1);
  const first = started.innings[0];
  check("first innings has striker, non-striker and bowler", Boolean(first.striker && first.nonStriker && first.bowler));
  const openingStriker = idOf(first.striker);
  const openingNonStriker = idOf(first.nonStriker);
  console.log(`Opening pair ${openingStriker} / ${openingNonStriker}, bowler ${idOf(first.bowler)}`);

  let response = await api(`/matches/${id}/ball`, { method: "POST", body: { batRuns: 1 } });
  let match = response.match;
  check("single rotates strike", idOf(match.innings[0].striker) === openingNonStriker && idOf(match.innings[0].nonStriker) === openingStriker);
  check("single credits run to striker", match.innings[0].batting.find((b) => idOf(b.player) === openingStriker).runs === 1);

  response = await api(`/matches/${id}/ball`, { method: "POST", body: { batRuns: 4 } });
  match = response.match;
  check("boundary stays on strike", idOf(match.innings[0].striker) === openingNonStriker);

  match = (await api(`/matches/${id}/undo`, { method: "POST" })).match;
  check("undo removes last delivery", match.innings[0].batting.find((b) => idOf(b.player) === openingStriker).runs === 1 && match.innings[0].batting.find((b) => idOf(b.player) === openingNonStriker).runs === 0 && match.innings[0].balls === 1);

  response = await api(`/matches/${id}/ball`, { method: "POST", body: { batRuns: 0, extra: { type: "wide", runs: 1 } } });
  match = response.match;
  check("wide adds a run without legal ball", match.innings[0].runs === 2 && match.innings[0].balls === 1);
  check("wide does not rotate strike", idOf(match.innings[0].striker) === openingNonStriker);

  response = await api(`/matches/${id}/ball`, { method: "POST", body: { batRuns: 6, extra: { type: "noBall", runs: 1 } } });
  match = response.match;
  check("no-ball + six scores 7 and no legal ball", match.innings[0].runs === 9 && match.innings[0].balls === 1);
  check("free hit armed after no-ball", match.innings[0].freeHit === true);

  response = await api(`/matches/${id}/ball`, { method: "POST", body: { batRuns: 3 } });
  match = response.match;
  check("legal delivery clears free hit", match.innings[0].freeHit === false);
  check("odd runs rotate strike", idOf(match.innings[0].striker) === openingStriker && idOf(match.innings[0].nonStriker) === openingNonStriker);

  response = await api(`/matches/${id}/ball`, {
    method: "POST",
    body: { batRuns: 0, wicket: { type: "bowled", outBatsman: "nonStriker" } },
  });
  match = response.match;
  check("wicket increments wickets", match.innings[0].wickets === 1);
  check("wicket replaces dismissed batter", idOf(match.innings[0].striker) !== idOf(match.innings[0].nonStriker) && idOf(match.innings[0].nonStriker) !== openingStriker);
  const wicketFed = (await api(`/matches/${id}/balls?limit=20`)).balls.find((b) => b.wicket?.isWicket);
  check("wicket ball saved with dismissal", Boolean(wicketFed?.wicket?.type));

  const beforeSwap = idOf(match.innings[0].striker);
  match = (await api(`/matches/${id}/swap-strike`, { method: "POST" })).match;
  check("manual strike swap works", idOf(match.innings[0].striker) !== beforeSwap);
  match = (await api(`/matches/${id}/swap-strike`, { method: "POST" })).match;
  check("second swap restores strike", idOf(match.innings[0].striker) === beforeSwap);

  const commentary = await api(`/matches/${id}/commentary`, { method: "POST", body: { text: "QA commentary marker" } });
  check("manual commentary added", commentary.commentary === "QA commentary marker");

  const remaining = 6 - Number(match.innings[0].balls);
  for (let i = 0; i < remaining; i += 1) {
    response = await api(`/matches/${id}/ball`, { method: "POST", body: { batRuns: 0 } });
    match = response.match;
  }
  check("one-over first innings auto-closes", match.innings[0].completed === true);
  check("second innings auto-created with target", match.innings.length === 2 && match.innings[1].target === match.innings[0].runs + 1);
  check("match still live during chase", match.status === "live" && match.currentInnings === 1);

  const finished = (await api(`/matches/${id}/finish`, { method: "POST", body: {} })).match;
  check("finish publishes result", finished.status === "finished" && Boolean(finished.result?.text));
  check("player of the match selected", Boolean(finished.playerOfMatch));
  check("innings marked complete", finished.innings.every((inn) => inn.completed));

  const reset = (await api(`/matches/${id}/reset`, { method: "POST", body: { confirm: true } })).match;
  check("reset returns match to upcoming", reset.status === "upcoming" && reset.innings.length === 0);
  const ballsAfterReset = await api(`/matches/${id}/balls?limit=20`);
  check("reset deletes ball feed", ballsAfterReset.balls.length === 0);
} finally {
  if (id) {
    await api(`/matches/${id}`, { method: "DELETE" }).catch(() => {});
    console.log("PASS: QA match deleted");
  }
}

console.log("\nAll scoring QA checks passed.");
