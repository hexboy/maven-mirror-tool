const Level = {
  Warn: 'w',
  Info: 'i',
  Error: 'e',
} as const;
type Level = (typeof Level)[keyof typeof Level];

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

// Local wall-clock time with its UTC offset, e.g. 2026/07/01 14:32:05.123
const formatLocalTimestamp = (date: Date) => {
  return (
    `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
  );
};

const write = (level: Level, message: string, ...args: unknown[]) => {
  const line = `${formatLocalTimestamp(new Date())} [${level.toUpperCase()}] ${message}`;
  if (level === Level.Error) {
    console.error(line, ...args);
  } else if (level === Level.Warn) {
    console.warn(line, ...args);
  } else {
    console.log(line, ...args);
  }
};

export const logger = {
  info: (message: string, ...args: unknown[]) =>
    write(Level.Info, message, ...args),
  warn: (message: string, ...args: unknown[]) =>
    write(Level.Warn, message, ...args),
  error: (message: string, ...args: unknown[]) =>
    write(Level.Error, message, ...args),
};
