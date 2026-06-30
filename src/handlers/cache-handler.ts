import path from 'path';
import type { RequestHandler } from 'express';

import { GotDownloader } from '../downloader/got.ts';
import { CACHE_DIR } from '../config.ts';
import { getCachedServer, touchFile } from '../utils.ts';
import { logger } from '../logger.ts';

const downloader = new GotDownloader();

export const CacheRequestHandler: RequestHandler = (request, response) => {
  const url = request.url.replace(/^\/\w+\//, '/');

  const server = getCachedServer(url);
  if (server) {
    const cachedPath = path.join(CACHE_DIR, server.name, url);
    logger.info(`📦 [${server.name}] ${url}`);
    touchFile(cachedPath);
    return response.sendFile(cachedPath);
  }

  downloader
    .getSupportedServer(url)
    .then((srv) => {
      if (srv) {
        if (request.method === 'HEAD') {
          return downloader.head({ url, srv, response });
        } else {
          downloader.download({ url, srv, response, request });
        }
      } else {
        if (!response.headersSent) {
          response.sendStatus(403);
        }
      }
    })
    .catch(() => {
      if (!response.headersSent) {
        response.sendStatus(403);
      }
    });
};
