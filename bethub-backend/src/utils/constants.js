export const ROLES = ["Batter", "Bowler", "All-Rounder", "Wicket-Keeper"];
export const BATTING_STYLES = ["Right-hand bat", "Left-hand bat"];
export const BOWLING_STYLES = [
  "None",
  "Right-arm fast",
  "Right-arm fast-medium",
  "Right-arm medium",
  "Right-arm offbreak",
  "Right-arm legbreak",
  "Left-arm fast",
  "Left-arm medium",
  "Left-arm orthodox",
  "Left-arm wrist-spin",
];
export const FORMATS = ["T10", "T20", "ODI", "Test", "Custom"];
export const MATCH_STATUS = ["upcoming", "live", "innings-break", "finished", "abandoned"];
export const WICKET_TYPES = [
  "bowled",
  "caught",
  "lbw",
  "runOut",
  "stumped",
  "hitWicket",
  "retired",
  "obstructing",
  "timedOut",
  "handledBall",
  "hitTheBallTwice",
];
export const EXTRA_TYPES = ["wide", "noBall", "bye", "legBye", "penalty"];
export const VIDEO_TYPES = ["short", "long", "highlight", "replay"];
export const DEFAULT_OVER_COUNTS = { T10: 10, T20: 20, ODI: 50, Test: 90, Custom: 20 };
export const STREAM_MODES = ["hls", "embed", "camera"];
