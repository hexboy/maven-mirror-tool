import path from "path";
import got, { GotOptions, HTTPError } from "got";
import type { Response } from "express";
import fs, { createWriteStream } from "fs";
import { HttpsAgent } from "agentkeepalive";
("agentkeepalive");

import { PROXIES, CACHE_DIR, TMP_DIR, REPOSITORIES } from "../config";
import { ProxyAgent } from "proxy-agent";
import { logger } from "../utils";

console.log("fdsfsfd");
export class GotDownloader {
  db: {
    [K: string]: {
      serverIndex: number;
    };
  } = {};

  agentsMap: {
    [K: string]: {
      agent: ProxyAgent | null;
    };
  } = {};

  getAgent = (srv: TServer) => {
    const proxy = srv.proxy && srv.proxy in PROXIES ? PROXIES[srv.proxy] : null;
    if (proxy) {
      return new ProxyAgent({
        httpAgent: new HttpsAgent(),
        httpsAgent: new HttpsAgent(),
        getProxyForUrl: () =>
          proxy.auth
            ? `${proxy.protocol}://${proxy.auth.username}:${proxy.auth.password}@${proxy.host}:${proxy.port}`
            : `${proxy.protocol}://${proxy.host}:${proxy.port}`,
      });
    }
    return null;
  };

  getOptions = (srv: TServer, method: "get" | "head" = "get") => {
    const options: GotOptions<typeof method> = { method };
    var agent: ProxyAgent | null;
    if (this.agentsMap[srv.name] != null) {
      agent = this.agentsMap[srv.name].agent;
    } else {
      agent = this.getAgent(srv);
      this.agentsMap[srv.name] = { agent: agent };
    }
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
      ).toString("base64")}`;
    }

    if (method === "head") {
      options.timeout = { request: 5000 };
    }

    return options;
  };

  checkServer = (url: string, srv: TServer) => {
    const options = this.getOptions(srv, "head");

    return got.head(srv.url + url, options).catch((error) => {
      if (error instanceof HTTPError && error.response.statusCode == 404)
        return null;
      logger.error(`hit ${url} with ${srv.url + url} ${error}`);
      return null;
    });
  };

  getMatchUrlWithServer = (url: string): TServer | null => {
    for (const element of REPOSITORIES) {
      if (element.paths == null || element.paths.length == 0) continue;
      for (const path of element.paths) {
        if (url.includes(path)) return element;
      }
    }
    return null;
  };

  getSupportedServer = async (url: string) => {
    var matched: TServer | null = this.getMatchUrlWithServer(url);
    if (matched != null) {
      return matched;
    }
    if (this.db[url]?.serverIndex) {
      return REPOSITORIES[this.db[url].serverIndex];
    }
    const gotPromises = REPOSITORIES.map((srv) => this.checkServer(url, srv));
    return Promise.any(
      gotPromises.map((req, index) =>
        req.then((resp) => {
          if (resp == null) return Promise.reject();
          return index;
        })
      )
    )
      .then((index) => {
        return REPOSITORIES[index];
      })
      .catch((e) => {
        logger.error(`hit exception ${e}`);
      });
  };

  head = (url: string, srv: TServer, res: Response) => {
    return got
      .head(srv.url + url, this.getOptions(srv, "head"))
      .then((r) => {
        res.set(r.headers);
        res.sendStatus(r.statusCode);
      })
      .catch((e) => {
        console.log(`X [${e}]: s=${e.response.statusCode}:${srv.url}${url}`);
        res.sendStatus(e.response.statusCode);
      });
  };

  download = (url: string, srv: TServer, res: Response) => {
    const fileName = url.split("/").pop() || "";
    const tmpPath = path.resolve(TMP_DIR, fileName);
    const outputDir = path.join(CACHE_DIR, srv.name, url).replace(fileName, "");
    const stream = got.stream(srv.url + url, this.getOptions(srv));
    stream.on("error", (e, _body?, _res?) => {
      console.log(`X [${e}]: s=${e.response.statusCode}:${srv.url}${url}`);
      res.sendStatus(e.response?.statusCode)
    });
    const fileWriterStream = createWriteStream(tmpPath);
    stream.pipe(fileWriterStream).on("finish", () => {
      console.log(`✅ [${srv.name}]`, url);
      this.moveToCache(fileName, outputDir);
      delete this.db[url];
    });

    stream.pipe(res).on("error", (error: any, _body?: any) => {
      console.error(error);
    });
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
