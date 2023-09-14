import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import morgan from 'morgan';
import express, { RequestHandler } from 'express';

import {
  PORT,
  TMP_DIR,
  VERBOSE,
  CACHE_DIR,
  DEFAULT_PATH,
  IGNORE_FILES,
  VALID_FILE_TYPES,
} from './config';
import { getCachedServer } from './utils';
import { GotDownloader } from './downloader/got';

const downloader = new GotDownloader();

const cacheRequestHandler: RequestHandler = (req, res, next) => {
  const url = (req.originalUrl || req.url).replace(/^\/\w+\//, '/');
  if (req.method !== 'HEAD' && req.method !== 'GET') {
    return res.sendStatus(403);
  }

  const fileName = url.split('/').pop() || '';
  const fileType = fileName.slice(fileName.lastIndexOf('.'));

  if (!VALID_FILE_TYPES.includes(fileType)) {
    console.log('♻️', url);
    return next();
  }

  if (IGNORE_FILES.find((str) => url.includes(str))) {
    console.log('❌ [404]', url);
    return res.status(404);
  }

  const server = getCachedServer(url);
  if (server) {
    const cachedPath = path.join(CACHE_DIR, server.name, url);
    console.log(`📦 [${server.name}]`, url);
    return res.sendFile(cachedPath);
  }

  console.log(req.method, url);

  downloader
    .getSupportedServer(url)
    .then((srv) => {
      if (srv) {
        if (req.method === 'HEAD') {
          downloader.head(url, srv, res);
        } else {
          downloader.download(url, srv, res);
        }
      } else {
        res.sendStatus(403);
      }
    })
    .catch(() => res.sendStatus(403));
};

// init cache dir
if (!fs.existsSync(path.resolve(CACHE_DIR))) {
  fs.mkdirSync(path.resolve(CACHE_DIR), { recursive: true });
}

// init temp dir
if (!fs.existsSync(path.resolve(TMP_DIR))) {
  fs.mkdirSync(path.resolve(TMP_DIR), { recursive: true });
}

const app = express();
if (VERBOSE) {
  app.use(morgan('combined'));
}
app.get('*', cacheRequestHandler);
app.listen(PORT, () => {
  console.log(`Serving! http://0.0.0.0:${PORT}/${DEFAULT_PATH}\n`);
  console.log('add this ⬇️  in build.gradle');
  console.log(
    chalk.green(
      `maven { url "http://127.0.0.1:${PORT}/${DEFAULT_PATH}"; allowInsecureProtocol true }`
    )
  );
  console.log('\nadd this ⬇️  in build.gradle.kts');
  console.log(
    chalk.green(
      `maven { url = uri("http://127.0.0.1:${PORT}/${DEFAULT_PATH}")\nisAllowInsecureProtocol = true }`
    )
  );
});

// help:
// replace google() with maven { url "http://127.0.0.1:8005/v1" }
