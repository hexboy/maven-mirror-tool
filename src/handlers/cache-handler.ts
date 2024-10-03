import path from 'path';
import { RequestHandler } from 'express';

import { GotDownloader } from '../downloader/got';
import { CACHE_DIR } from '../config';
import { getCachedServer } from '../utils';

const downloader = new GotDownloader();

export const CacheRequestHandler: RequestHandler = (req, res) => {
  const url = req.url.replace(/^\/\w+\//, '/');

  const server = getCachedServer(url);
  if (server) {
    const cachedPath = path.join(CACHE_DIR, server.name, url);
    console.log(`📦 [${server.name}]`, url);
    return res.sendFile(cachedPath);
  }

  downloader
    .getSupportedServer(url)
    .then((srv) => {
      if (srv) {
        if (req.method === 'HEAD') {
          downloader.head({ url, srv, res });
        } else {
          downloader.download({ url, srv, res, req });
        }
      } else {
        if (!res.headersSent) {
          res.sendStatus(403);
        }
      }
    })
    .catch(() => {
      if (!res.headersSent) {
        res.sendStatus(403);
      }
    });
};
