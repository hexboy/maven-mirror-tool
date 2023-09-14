import path from 'path';
import got, { GotOptions } from 'got';
import type { Response } from 'express';
import fs, { createWriteStream } from 'fs';

import { PROXIES, CACHE_DIR, TMP_DIR, REPOSITORIES } from '../config';
import { ProxyAgent } from 'proxy-agent';

export class GotDownloader {
  db: {
    [K: string]: {
      serverIndex: number;
    };
  } = {};

  getAgent = (srv: TServer) => {
    const proxy = srv.proxy && srv.proxy in PROXIES ? PROXIES[srv.proxy] : null;
    if (proxy) {
      return new ProxyAgent({
        getProxyForUrl: () =>
          proxy.auth
            ? `${proxy.protocol}://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`
            : `${proxy.protocol}://${proxy.host}:${proxy.port}`,
      });
    }
    return null;
  };

  getOptions = (srv: TServer, method: 'get' | 'head' = 'get') => {
    const options: GotOptions<typeof method> = { method };
    const agent = this.getAgent(srv);
    if (agent) {
      options.agent = {
        http: agent,
        https: agent,
      };
    }

    if (srv.auth) {
      options.headers = {};
      options.headers.authorization = `Basic ${Buffer.from(
        `${srv.auth.username}:${srv.auth.password}`
      ).toString('base64')}`;
    }

    if (method === 'head') {
      options.timeout = { request: 5000 };
    }

    return options;
  };

  checkServer = (url: string, srv: TServer) => {
    const options = this.getOptions(srv, 'head');
    return got.head(srv.url + url, options);
  };

  getSupportedServer = async (url: string) => {
    if (this.db[url]?.serverIndex) {
      return REPOSITORIES[this.db[url].serverIndex];
    }
    const gotPromises = REPOSITORIES.map((srv) => this.checkServer(url, srv));
    return Promise.any(gotPromises.map((req, index) => req.then(() => index)))
      .then((index) => {
        // cancel all got requests
        gotPromises.forEach((req) => req.cancel());
        this.db[url] = {
          serverIndex: index,
        };
        return REPOSITORIES[index];
      })
      .catch(() => null);
  };

  head = (url: string, srv: TServer, res: Response) => {
    return got
      .head(srv.url + url, this.getOptions(srv, 'head'))
      .then((r) => {
        res.set(r.headers);
        res.sendStatus(r.statusCode);
      })
      .catch((r) => {
        res.sendStatus(r.statusCode);
      });
  };

  download = (url: string, srv: TServer, res: Response) => {
    const fileName = url.split('/').pop() || '';
    const tmpPath = path.resolve(TMP_DIR, fileName);
    const outputDir = path.join(CACHE_DIR, srv.name, url).replace(fileName, '');
    const stream = got.stream(srv.url + url, this.getOptions(srv));
    const fileWriterStream = createWriteStream(tmpPath);
    stream.pipe(fileWriterStream).on('finish', () => {
      console.log(`✅ [${srv.name}]`, url);
      this.moveToCache(fileName, outputDir);
      delete this.db[url];
    });

    stream.pipe(res).on('error', console.error);
  };

  moveToCache = (fileName: string, outputDir: string) => {
    const tmpPath = path.resolve(TMP_DIR, fileName);
    if (fs.existsSync(tmpPath) ? fs.statSync(tmpPath).size : 0) {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.renameSync(tmpPath, path.join(outputDir, fileName));
    }
  };
}
