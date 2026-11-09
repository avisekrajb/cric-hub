import { emitAll, emitGlobal, emitMatch, notify } from "./emit.js";
import { matchDetail, matchSummary } from "../services/serializers.js";

const matchId = (match) => String(match._id);

export const broadcastMatch = (match, extra = {}) => {
  if (!match) return null;
  const detail = matchDetail(match);
  const summary = matchSummary(match);
  emitMatch(matchId(match), "match:update", { match: detail, ...extra });
  emitGlobal("score:update", { match: summary, ...extra });
  emitGlobal("stats:dirty", { matchId: matchId(match), at: new Date().toISOString() });
  return { detail, summary };
};

export const broadcastStream = (match) => {
  if (!match) return null;
  const summary = matchSummary(match);
  emitAll("stream:update", { matchId: matchId(match), stream: summary.stream, match: summary });
  emitGlobal("stats:dirty", { matchId: matchId(match), at: new Date().toISOString() });
  return summary;
};

export const announce = (payload) => notify(payload);

export default { broadcastMatch, broadcastStream, announce };
