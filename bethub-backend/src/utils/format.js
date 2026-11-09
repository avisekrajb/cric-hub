export const ballsToOvers = (balls = 0) => {
  const safe = Number(balls) || 0;
  return `${Math.floor(safe / 6)}.${safe % 6}`;
};

export const oversToBalls = (overs = 0) => {
  const [whole, part] = String(overs).split(".");
  return (Number(whole) || 0) * 6 + (Number(part) || 0);
};

export const runRate = (runs = 0, balls = 0) => {
  if (!balls) return 0;
  return Number(((runs / balls) * 6).toFixed(2));
};

export const requiredRunRate = (runsNeeded = 0, ballsLeft = 0) => {
  if (!ballsLeft) return 0;
  return Number(((runsNeeded / ballsLeft) * 6).toFixed(2));
};

export const oversText = (balls = 0) => `${Math.floor(balls / 6)}.${balls % 6} ov`;

export const dismissalText = ({ kind, bowler, fielder, keeper }) => {
  const b = bowler?.name || "bowler";
  const f = fielder?.name || "fielder";
  const k = keeper?.name || fielder?.name || "keeper";
  switch (kind) {
    case "bowled":
      return `b ${b}`;
    case "caught":
      return `c ${f} b ${b}`;
    case "lbw":
      return `lbw b ${b}`;
    case "runOut":
      return `run out (${f})`;
    case "stumped":
      return `st ${k} b ${b}`;
    case "hitWicket":
      return `hit wicket b ${b}`;
    case "retired":
      return "retired";
    case "obstructing":
      return "obstructing the field";
    case "timedOut":
      return "timed out";
    case "handledBall":
      return "handled the ball";
    case "hitTheBallTwice":
      return "hit the ball twice";
    default:
      return kind || "out";
  }
};
