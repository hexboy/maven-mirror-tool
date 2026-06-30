import fs from 'fs';
import os from 'os';
import path from 'path';

import { CACHE_DIR, REPOSITORIES } from './config';
import { logger } from './logger';

export const getCachedServer = (filePath: string) => {
  const srv = REPOSITORIES.find((s) => {
    const fPath = path.join(CACHE_DIR, s.name, filePath);
    if (fs.existsSync(fPath) ? fs.statSync(fPath).size : 0) {
      return true;
    }
    return false;
  });
  return srv;
};

export const printServedEndpoints = (
  port: number | string,
  urlPath: string
) => {
  try {
    const interfaces = os.networkInterfaces();
    const list = Object.keys(interfaces)
      .map((name) =>
        (interfaces[name] ?? []).filter((item) => item.family === 'IPv4')
      )
      .filter((l) => l.length > 0)
      .flat();
    const localInterface = list.find((item) => item.internal);
    const networkInterface = list.find((item) => !item.internal);
    console.log('\n🚀 Serving!');
    console.log('--------------------------------------------');
    console.log(`Local: http://0.0.0.0:${port}/${urlPath}`);
    if (localInterface) {
      console.log(`Local: http://${localInterface.address}:${port}/${urlPath}`);
    }
    if (networkInterface) {
      console.log(
        `Network: http://${networkInterface.address}:${port}/${urlPath}`
      );
    }
    console.log('--------------------------------------------');

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e: unknown) {
    console.log('\n🚀 Serving!');
    console.log('--------------------------------------------');
    console.log(`Local: http://0.0.0.0:${port}/${urlPath}`);
    console.log(`Local: http://127.0.0.1:${port}/${urlPath}`);
    console.log('--------------------------------------------');
  }
};

// Eviction only cares about day-level age, so skip the metadata write
// when the file was already touched recently in this window.
const TOUCH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

// Bump mtime so eviction tracks last-served time, not last-downloaded time
// (sendFile() never touches the file, so a frequently-served cache hit would
// otherwise look just as stale as one nobody has asked for in months).
export const touchFile = (filePath: string) => {
  try {
    const { mtimeMs } = fs.statSync(filePath);
    if (Date.now() - mtimeMs < TOUCH_THRESHOLD_MS) {
      return;
    }
    const now = new Date();
    fs.utimesSync(filePath, now, now);
  } catch {
    // best-effort; a missed touch just makes the file evict a bit early
  }
};

export const evictExpiredCacheFiles = (
  cacheDir: string,
  ttlDays: number
): void => {
  const maxAgeMs = ttlDays * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - maxAgeMs;
  let removed = 0;

  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(entryPath);
        continue;
      }
      const { mtimeMs } = fs.statSync(entryPath);
      if (mtimeMs < cutoff) {
        fs.unlinkSync(entryPath);
        removed += 1;
      }
    }
  };

  walk(cacheDir);
  if (removed > 0) {
    logger.info(`🧹 evicted ${removed} cached file(s) older than ${ttlDays}d`);
  }
};

export const extractFileInfo = (url: string) => {
  // Use a dummy base so relative/absolute paths both parse, then strip the query string
  const pathname = new URL(url, 'http://localhost').pathname;

  const fileName = path.basename(pathname);
  const relativePath = path.dirname(pathname);
  const fileExtension = path.extname(fileName).replace(/^\./, '');

  return { fileName, relativePath, fileExtension };
};
