import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import morgan from 'morgan';
import express from 'express';

import { PORT, TMP_DIR, VERBOSE, CACHE_DIR, DEFAULT_PATH } from './config';
import { printServedEndpoints } from './utils';

import { CacheRequestHandler } from './handlers/cache-handler';
import { ValidateRequestHandler } from './handlers/validate-request-handler';
import { LegacyGradlePluginsHandler } from './handlers/gradle-plugins-handler';

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
app.get('*', ValidateRequestHandler);
app.get('*', LegacyGradlePluginsHandler);
app.get('*', CacheRequestHandler);
app.listen(PORT, () => {
  console.log('add this ⬇️  in build.gradle');
  console.log(
    chalk.green(
      `maven { url "http://127.0.0.1:${PORT}/${DEFAULT_PATH}"; allowInsecureProtocol true }`
    )
  );
  console.log('\nadd this ⬇️  in build.gradle.kts');
  console.log(
    chalk.green(
      `maven { url = uri("http://127.0.0.1:${PORT}/${DEFAULT_PATH}"); isAllowInsecureProtocol = true }`
    )
  );

  printServedEndpoints(PORT, DEFAULT_PATH);
});

// help:
// replace google() with maven { url "http://127.0.0.1:8005/v1" }
