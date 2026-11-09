const stamp = () => new Date().toISOString().slice(11, 23);
const paint = (color, text) => `\x1b[${color}m${text}\x1b[0m`;

const write = (level, color, args) => {
  console.log(`${paint("90", stamp())} ${paint(color, level.padEnd(5))}`, ...args);
};

export const logger = {
  info: (...args) => write("info", "36", args),
  ok: (...args) => write("ok", "32", args),
  warn: (...args) => write("warn", "33", args),
  error: (...args) => write("error", "31", args),
  socket: (...args) => write("ws", "35", args),
};

export default logger;
