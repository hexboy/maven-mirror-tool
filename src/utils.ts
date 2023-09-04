import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
const exec = promisify(require('child_process').exec);

import { PROXIES, CACHE_DIR, IGNORE_FILES, REPOSITORIES } from './config';

type TDownloadRes = null | {
  fileName: string;
  serverName: string;
  filePath: string;
};

export const getCachedPath = (filePath: string) => {
  const srv = REPOSITORIES.find((s) => {
    const fPath = path.join(CACHE_DIR, s.name, filePath);
    if (fs.existsSync(fPath) ? fs.statSync(fPath).size : 0) {
      console.log(`📦 [${s.name}]`, filePath);
      return true;
    }
    return false;
  });
  return srv ? path.join(CACHE_DIR, srv.name, filePath) : null;
};

const activeDownloads: {
  [K: string]: {
    subscribers: ((value: TDownloadRes | PromiseLike<TDownloadRes>) => void)[];
  };
} = {};

const download = async (url: string, srv: TServer): Promise<TDownloadRes> => {
  const fileName = url.split('/').pop() || '';
  const outputDir = path.join(CACHE_DIR, srv.name, url).replace(fileName, '');
  const fileType = fileName.slice(fileName.lastIndexOf('.'));
  const tmpPath = path.resolve(CACHE_DIR, '_tmp_', fileName);
  if (srv.fileTypes && !srv.fileTypes.includes(fileType)) {
    return null;
  }
  const proxy = srv.proxy && srv.proxy in PROXIES ? PROXIES[srv.proxy] : null;
  const cmd = `curl ${
    proxy ? `-x "${proxy.protocol}://${proxy.host}:${proxy.port}" ` : ''
  } ${
    srv.auth ? `-u "${srv.auth.username}:${srv.auth.password}" ` : ''
  }--connect-timeout 3 ${
    fileType === '.jar' || fileType === '.aar' ? '--max-time 1000 ' : ''
  }--max-redirs 3 -L -f -o ${tmpPath} ${srv.url + url}`;

  try {
    await exec(cmd);
    if (fs.existsSync(tmpPath) ? fs.statSync(tmpPath).size : 0) {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.renameSync(tmpPath, path.join(outputDir, fileName));
      return {
        fileName,
        serverName: srv.name,
        filePath: path.join(outputDir, fileName),
      };
    } else {
      return null;
    }
  } catch (error) {
    return null;
  }
};

const attachToDownloader = async (url: string): Promise<TDownloadRes> =>
  new Promise((resolve, reject) => {
    activeDownloads[url].subscribers.push(resolve);
  });

const downloadMultiServer = async (url: string) => {
  if (!(url in activeDownloads)) {
    activeDownloads[url] = { subscribers: [] };
    for await (const srv of REPOSITORIES) {
      const result = await download(url, srv);
      if (result) {
        activeDownloads[url].subscribers.forEach((sub) => sub(result));
        delete activeDownloads[url];
        return;
      }
    }
    activeDownloads[url].subscribers.forEach((sub) => sub(null));
    delete activeDownloads[url];
  }
};

export const downloadFile = async (url: string, res: any) => {
  if (IGNORE_FILES.find((str) => url.includes(str))) {
    console.log('❌ [404]', url);
    return res.sendStatus(404);
  }

  downloadMultiServer(url);

  const downloadRes = await attachToDownloader(url);
  if (downloadRes) {
    console.log(`✅ [${downloadRes.serverName}]`, url);
    return res.sendFile(downloadRes.filePath);
  }
  console.log('❌ [403]', url);
  return res.sendStatus(403);
};
