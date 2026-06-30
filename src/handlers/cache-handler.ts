import path from 'path';
import { RequestHandler } from 'express';

import { GotDownloader } from '../downloader/got';
import { CACHE_DIR } from '../config';
import { getCachedServer, touchFile } from '../utils';
import { logger } from '../logger';

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
