import path from 'path';
import got, { type StreamOptions, type Response as GotResponse } from 'got';
import type { Response, Request } from 'express';
import fs, { createWriteStream } from 'fs';

import { PROXIES, CACHE_DIR, TMP_DIR, REPOSITORIES } from '../config.ts';
import { ProxyAgent } from 'proxy-agent';
import type { TServer } from '../../types';
import { extractFileInfo } from '../utils.ts';
import { logger } from '../logger.ts';

interface DownloadEntry {
  responses: Set<Response>;
  request: Request;
  srv: TServer;
  tmpPath: string;
  relativePath: string;
  fileName: string;
  url: string;
  headersSent: boolean;
  statusCode: number;
  responseHeaders: unknown;
}

export class GotDownloader {
  private pickedServer = new Map<string, number>();
  private activeDownloads = new Map<string, DownloadEntry>();

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

  getOptions = (
    srv: TServer,
    method: 'get' | 'head' = 'get',
    signal?: AbortSignal
  ) => {
    const options: StreamOptions = { method, signal };
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

  checkServer = (url: string, srv: TServer, signal?: AbortSignal) => {
    const options = this.getOptions(srv, 'head', signal);
    return got.head(srv.url + url, options);
  };

  getSupportedServer = async (url: string) => {
    const serverIndex = this.pickedServer.get(url);
    if (serverIndex !== undefined) {
      return REPOSITORIES[serverIndex];
    }

    const controller = new AbortController();
    const { signal } = controller;

    const requests = REPOSITORIES.map(async (srv, index) => {
      try {
        await this.checkServer(url, srv, signal);
        // Abort all other requests as soon as we get the first success
        controller.abort();
        this.pickedServer.set(url, index);
        return srv;
      } catch {
        // If the request was aborted, or failed (network error, timeout, etc.), return null
        return null;
      }
    });

    try {
      return await Promise.race(requests);
    } catch {
      return null;
    }
  };

  head = async ({
    url,
    srv,
    response,
  }: {
    url: string;
    srv: TServer;
    response: Response;
  }) => {
    try {
      const result = await got.head(
        srv.url + url,
        this.getOptions(srv, 'head')
      );
      response.set(result.headers);
      if (!response.headersSent) {
        response.sendStatus(result.statusCode);
      }
    } catch (error: unknown) {
      if (!response.headersSent) {
        response.sendStatus(
          +((error as { statusCode?: number }).statusCode ?? 404)
        );
      }
    }
  };

  download = ({
    url,
    srv,
    request,
    response,
  }: {
    url: string;
    srv: TServer;
    request: Request;
    response: Response;
  }) => {
    const { fileName, relativePath } = extractFileInfo(url);
    const tmpPath = path.join(TMP_DIR, fileName);

    // Check if download for this URL is already in progress
    const existing = this.activeDownloads.get(url);
    if (existing) {
      // Send headers if already received
      if (existing.headersSent && !response.headersSent) {
        response.status(existing.statusCode);
        response.set(existing.responseHeaders as Record<string, string>);
      }

      // Read file first, then add to responses to prevent interleaving
      const addToResponses = () => {
        existing.responses.add(response);
        // Remove response on client disconnect
        request.on('close', () => {
          existing.responses.delete(response);
        });
      };

      // Send file buffer to the new response
      if (fs.existsSync(existing.tmpPath)) {
        const fileStream = fs.createReadStream(existing.tmpPath);
        fileStream.pipe(response, { end: false });
        fileStream.on('end', addToResponses);
        fileStream.on('error', () => {
          if (!response.destroyed) response.destroy();
          addToResponses();
        });
      } else {
        addToResponses();
      }

      logger.info(`🔗 [${srv.name}] ${url}`);
      return;
    }

    // Start new download
    const entry: DownloadEntry = {
      responses: new Set([response]),
      request,
      srv,
      tmpPath,
      relativePath,
      fileName,
      url,
      headersSent: false,
      statusCode: 200,
      responseHeaders: {},
    };
    this.activeDownloads.set(url, entry);

    const stream = got.stream(srv.url + url, this.getOptions(srv));
    const fileWriterStream = createWriteStream(tmpPath);

    // Pipe to all waiting responses
    const pipeToResponses = (chunk: Buffer) => {
      for (const res of entry.responses) {
        if (!res.destroyed) {
          res.write(chunk);
        }
      }
      fileWriterStream.write(chunk);
    };

    stream.on('data', (chunk: Buffer) => {
      pipeToResponses(chunk);
    });

    stream.once('downloadProgress', ({ total }) => {
      if (total) {
        logger.info(`⏳ [${srv.name}] ${url}`);
      }
    });

    stream.on('error', (err) => {
      logger.error(`❌ ${srv.url + url}`);
      logger.error(`⛔️ ${err.message}`);
      // Destroy all waiting responses
      for (const res of entry.responses) {
        if (!res.destroyed) {
          res.destroy(err);
        }
      }
      fileWriterStream.destroy();
      this.activeDownloads.delete(url);
    });

    stream.on('end', () => {
      fileWriterStream.end();
      // End all waiting responses
      for (const res of entry.responses) {
        if (!res.destroyed) {
          res.end();
        }
      }
      this.activeDownloads.delete(url);
      this.pickedServer.delete(url);
    });

    stream.on('response', (gotResponse: GotResponse) => {
      entry.headersSent = true;
      entry.statusCode = gotResponse.statusCode;
      entry.responseHeaders = gotResponse.headers;

      // Set headers on all responses
      for (const res of entry.responses) {
        if (!res.headersSent) {
          res.status(gotResponse.statusCode);
          res.set(gotResponse.headers);
        }
      }

      gotResponse.on('end', () => {
        if (
          gotResponse.statusCode &&
          gotResponse.statusCode >= 200 &&
          gotResponse.statusCode < 300
        ) {
          logger.info(`✅ [${srv.name}] ${url}`);
          const destPath = path.join(
            CACHE_DIR,
            srv.name,
            relativePath,
            fileName
          );
          this.copyFileToCache(tmpPath, destPath);
          if (request.headers['alias-url']) {
            const info = extractFileInfo(
              request.headers['alias-url'] as string
            );
            const aliasPath = path.join(
              CACHE_DIR,
              srv.name,
              info.relativePath,
              info.fileName
            );
            this.copyFileToCache(destPath, aliasPath, false);
          }
        }
      });
    });

    // Cleanup on client disconnect
    request.on('close', () => {
      entry.responses.delete(response);
      this.pickedServer.delete(url);
    });
  };

  copyFileToCache = (source: string, dest: string, moveFile = true) => {
    const { relativePath: destDir } = extractFileInfo(dest);
    if (fs.existsSync(source) ? fs.statSync(source).size > 0 : false) {
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      if (moveFile) {
        fs.renameSync(source, dest);
      } else {
        fs.copyFileSync(source, dest);
      }
    }
  };
}
