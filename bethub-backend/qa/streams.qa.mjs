import fs from "node:fs";

const base = "http://localhost:5000/api";
let token = "";
const videoPath = process.env.BETHUB_TEST_VIDEO || "C:\\Windows\\Temp\\opencode\\bethub-test.mp4";

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
    throw error;
  }
  return data;
}

async function uploadRecording(id, filePath) {
  const buffer = fs.readFileSync(filePath);
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: "video/mp4" }), "qa-recording.mp4");
  form.append("duration", "5");
  form.append("title", "QA replay");
  const res = await fetch(`${base}/streams/${id}/recording/finish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`recording finish -> ${res.status}: ${data.message}`);
  return data;
}

const check = (label, condition, detail = "") => {
  if (!condition) throw new Error(`FAIL: ${label}${detail ? `\n${detail}` : ""}`);
  console.log(`PASS: ${label}`);
};

token = (await api("/auth/login", {
  method: "POST",
  auth: false,
  body: { email: "admin@bethub.com", password: "Bethub@123" },
})).token;
const teams = (await api("/teams?limit=20")).teams;
const teamA = teams.find((t) => t.shortName === "NEP");
const teamB = teams.find((t) => t.shortName === "SL");

// Clean previous QA fixtures.
const recent = await api("/matches?limit=150");
for (const leftover of recent.matches.filter((m) => m.series === "Bethub QA Streams")) {
  if (leftover.stream?.isLive) await api(`/streams/${leftover._id}/end-live`, { method: "POST", body: {} }).catch(() => {});
  await api(`/streams/${leftover._id}/recording/cancel`, { method: "POST", body: {} }).catch(() => {});
  await api(`/matches/${leftover._id}/reset`, { method: "POST", body: { confirm: true } }).catch(() => {});
  await api(`/matches/${leftover._id}`, { method: "DELETE" }).catch(() => {});
}

const created = await api("/matches", {
  method: "POST",
  body: {
    teamA: teamA._id,
    teamB: teamB._id,
    series: "Bethub QA Streams",
    format: "T10",
    venue: "QA Broadcast Studio",
    toss: { winnerSlot: "A", decision: "bat" },
  },
});
const id = created.match._id;
let createdVideoId = "";
try {
  const live = await api(`/streams/${id}/go-live`, {
    method: "POST",
    body: { mode: "hls", hlsUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8", title: "QA live feed" },
  });
  check("go live returns stream and public link", live.stream.isLive === true && live.stream.playbackUrl.includes("/live/"));
  check("go live creates unique slug", Boolean(live.stream.slug));
  check("go live exposes stream key for admin", Boolean(live.stream.streamKey));
  check("go live stores HLS url", live.match.stream.hlsUrl.includes("m3u8"));

  const qr = await api(`/streams/${id}/qr`);
  check("QR endpoint returns playback URL", qr.url === live.stream.playbackUrl);
  check("QR endpoint returns data image", qr.qr.startsWith("data:image/png;base64,"));

  const recording = await api(`/streams/${id}/recording/start`, { method: "POST", body: {} });
  check("recording starts", recording.stream.recording === true);

  const finished = await uploadRecording(id, videoPath);
  createdVideoId = finished.video._id;
  check("recording uploads to Cloudinary", finished.stream.recording === false && finished.stream.recordingUrl.includes("cloudinary"));
  check("recording creates replay video", finished.video.type === "replay" && finished.video.match === id);

  const bySlug = await api(`/streams/by-slug/${live.stream.slug}`, { auth: false });
  check("public live link resolves by slug", String(bySlug.match._id) === String(id));
  check("public live link includes TURN config", Boolean(bySlug.turn));

  const veg = await api(`/streams/${id}/recording/start`, { method: "POST", body: {} });
  check("recording can restart", veg.stream.recording === true);
  const cancelled = await api(`/streams/${id}/recording/cancel`, { method: "POST", body: {} });
  check("recording cancel clears flag", cancelled.stream.recording === false);

  const ended = await api(`/streams/${id}/end-live`, { method: "POST", body: {} });
  check("end live stops stream", ended.stream.isLive === false && Boolean(ended.stream.endedAt));

  const bySlugAfter = await api(`/streams/by-slug/${live.stream.slug}`, { auth: false });
  check("finished live link still resolves replay", String(bySlugAfter.match._id) === String(id) && Boolean(bySlugAfter.match.stream.recordingUrl));

  const startedAgain = await api(`/streams/${id}/go-live`, {
    method: "POST",
    body: { mode: "embed", embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ", title: "QA embed" },
  });
  check("embed mode goes live", startedAgain.stream.isLive === true && startedAgain.match.stream.mode === "embed");
  await api(`/streams/${id}/end-live`, { method: "POST", body: {} });

  const removed = await api(`/streams/${id}/recording`, { method: "DELETE" });
  check("recording can be removed", !removed.stream.recordingUrl);
} finally {
  if (createdVideoId) await api(`/media/videos/${createdVideoId}`, { method: "DELETE" }).catch(() => {});
  if (id) {
    await api(`/streams/${id}/recording/cancel`, { method: "POST", body: {} }).catch(() => {});
    await api(`/streams/${id}/end-live`, { method: "POST", body: {} }).catch(() => {});
    await api(`/matches/${id}/reset`, { method: "POST", body: { confirm: true } }).catch(() => {});
    await api(`/matches/${id}`, { method: "DELETE" }).catch(() => {});
    console.log("PASS: QA stream fixture cleaned up");
  }
}

console.log("\nAll stream QA checks passed.");
