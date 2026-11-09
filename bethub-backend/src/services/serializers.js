import { ballsToOvers } from "../utils/format.js";

const pickMedia = (media) => (media?.url ? { url: media.url } : { url: "" });

export const playerMini = (player) => {
  if (!player) return null;
  if (typeof player === "string") return { _id: player, name: "Player" };
  return {
    _id: player._id,
    name: player.name,
    role: player.role,
    photo: pickMedia(player.photo),
    country: player.country
      ? {
          _id: player.country._id,
          name: player.country.name,
          code: player.country.code,
          flag: pickMedia(player.country.flag),
        }
      : undefined,
  };
};

export const teamMini = (team) => {
  if (!team) return null;
  if (typeof team === "string") return { _id: team, name: "Team" };
  return {
    _id: team._id,
    name: team.name,
    shortName: team.shortName,
    logo: pickMedia(team.logo),
    color: team.color,
    country: team.country
      ? {
          _id: team.country._id,
          name: team.country.name,
          code: team.country.code,
          flag: pickMedia(team.country.flag),
        }
      : undefined,
  };
};

export const streamMini = (stream = {}) => ({
  isLive: Boolean(stream.isLive),
  mode: stream.mode || "",
  title: stream.title || "",
  playbackUrl: stream.playbackUrl || "",
  slug: stream.slug || "",
  viewers: stream.viewers || 0,
  totalViews: stream.totalViews || 0,
  recording: Boolean(stream.recording),
  thumbnail: stream.thumbnail || "",
  recordingUrl: stream.recordingUrl || "",
  startedAt: stream.startedAt || null,
  endedAt: stream.endedAt || null,
});

export const matchSummary = (match) => {
  if (!match) return null;
  return {
    _id: match._id,
    matchNumber: match.matchNumber,
    title: match.title,
    series: match.series,
    format: match.format,
    overs: match.overs,
    status: match.status,
    startTime: match.startTime,
    venue: match.venue,
    city: match.city,
    isFeatured: match.isFeatured,
    views: match.views || 0,
    teamA: teamMini(match.teamA),
    teamB: teamMini(match.teamB),
    innings: (match.innings || []).map((inn) => ({
      number: inn.number,
      runs: inn.runs,
      wickets: inn.wickets,
      balls: inn.balls,
      overs: ballsToOvers(inn.balls),
      battingTeam: teamMini(inn.battingTeam),
      bowlingTeam: teamMini(inn.bowlingTeam),
      target: inn.target,
      completed: inn.completed,
      striker: playerMini(inn.striker),
      nonStriker: playerMini(inn.nonStriker),
      bowler: playerMini(inn.bowler),
    })),
    currentInnings: match.currentInnings,
    target: match.target,
    result: match.result,
    toss: match.toss,
    stream: streamMini(match.stream),
    updatedAt: match.updatedAt,
  };
};

export const matchDetail = (match) => {
  if (!match) return null;
  const json = typeof match.toObject === "function" ? match.toObject({ virtuals: true }) : match;
  delete json.undoStack;
  if (json.stream) delete json.stream.streamKey;
  json.innings = (json.innings || []).map((inn) => {
    if (!Array.isArray(inn.overs)) return inn;
    return {
      ...inn,
      oversDetail: inn.overs,
      overs: ballsToOvers(inn.balls),
    };
  });
  return json;
};

export const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatar: user.avatar,
});

export const MATCH_POPULATE = [
  { path: "teamA", populate: { path: "country" } },
  { path: "teamB", populate: { path: "country" } },
  { path: "lineups.A.player", populate: { path: "country" } },
  { path: "lineups.B.player", populate: { path: "country" } },
  { path: "innings.battingTeam", populate: { path: "country" } },
  { path: "innings.bowlingTeam", populate: { path: "country" } },
  { path: "innings.batting.player", populate: { path: "country" } },
  { path: "innings.bowling.player", populate: { path: "country" } },
  { path: "innings.striker", populate: { path: "country" } },
  { path: "innings.nonStriker", populate: { path: "country" } },
  { path: "innings.bowler", populate: { path: "country" } },
  { path: "innings.lastBowler", populate: { path: "country" } },
  { path: "innings.batting.dismissal.bowler" },
  { path: "innings.batting.dismissal.fielder" },
  { path: "innings.fow.player" },
  { path: "innings.partnerships.playerA" },
  { path: "innings.partnerships.playerB" },
  { path: "innings.overs.bowler" },
  { path: "playerOfMatch", populate: { path: "country" } },
];
