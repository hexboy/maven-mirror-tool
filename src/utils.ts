import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';

import { PROXIES, CACHE_DIR, IGNORE_FILES, REPOSITORIES } from './config';

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

export const download = async (
  url: string,
  outputDir: string,
  srv: TServer
) => {
  const fileName = url.split('/').pop() || '';
  const fileType = fileName.slice(fileName.lastIndexOf('.'));
  const tmpPath = path.resolve(CACHE_DIR, '_tmp_', fileName);
  return new Promise((resolve, reject) => {
    if (srv.fileTypes && !srv.fileTypes.includes(fileType)) {
      return resolve(null);
    }
    const proxy = srv.proxy && srv.proxy in PROXIES ? PROXIES[srv.proxy] : null;
    const cmd = `curl ${
      proxy ? `-x "${proxy.protocol}://${proxy.host}:${proxy.port}" ` : ''
    } ${
      srv.auth ? `-u "${srv.auth.username}:${srv.auth.password}" ` : ''
    }--connect-timeout 3 ${
      fileType === '.jar' || fileType === '.aar' ? '--max-time 1000 ' : ''
    }--max-redirs 3 -L -f -o ${tmpPath} ${srv.url + url}`;
    exec(cmd, (error: any, stdout: any, stderr: any) => {
      if (error) {
        return resolve(null);
      } else if (fs.existsSync(tmpPath) ? fs.statSync(tmpPath).size : 0) {
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        fs.renameSync(tmpPath, path.join(outputDir, fileName));
        return resolve(srv.name);
      } else {
        return resolve(null);
      }
    });
  });
};

export const downloadFile = async (url: string, res: any) => {
  if (IGNORE_FILES.find((str) => url.includes(str))) {
    console.log('❌ [404]', url);
    return res.sendStatus(404);
  }
  for await (const srv of REPOSITORIES) {
    const fileName = url.split('/').pop() || '';
    const outputDir = path.join(CACHE_DIR, srv.name, url).replace(fileName, '');
    const downloadedFrom = await download(url, outputDir, srv);
    if (downloadedFrom) {
      console.log(`✅ [${downloadedFrom}]`, url);
      return res.sendFile(path.join(outputDir, fileName));
    }
  }
  console.log('❌ [403]', url);
  return res.sendStatus(403);
};
