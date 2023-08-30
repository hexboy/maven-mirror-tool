import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import yaml from 'js-yaml';
import morgan from 'morgan';
import minimist from 'minimist';
import { exec } from 'child_process';
import express, { RequestHandler } from 'express';

const config = yaml.load(
  fs.existsSync('config.local.yml')
    ? fs.readFileSync('config.local.yml', 'utf8')
    : fs.readFileSync('config.yml', 'utf8')
) as IConfig;
const args = minimist(process.argv);

const { SERVERS, PROXIES, IGNORE_FILES = [], VALID_FILE_TYPES = [] } = config;

const port = args.port || config.PORT || 8008;
const cacheDir = args['cache-dir'] || config.CACHE_DIR;
const defaultPath = args.path || config.DEFAULT_PATH || 'v1';
const verbose = args.verbose || config.LOG_REQUESTS || false;

const cacheBaseDir = path.resolve(cacheDir, '__MMSLM_CACHE__');

if (!fs.existsSync(path.resolve(cacheBaseDir, '_tmp_'))) {
  fs.mkdirSync(path.resolve(cacheBaseDir, '_tmp_'), { recursive: true });
}

const getCachedPath = (filePath: string) => {
  const srv = SERVERS.find((s) => {
    const fPath = path.join(cacheBaseDir, s.code, filePath);
    if (fs.existsSync(fPath) ? fs.statSync(fPath).size : 0) {
      console.log(`📦 [${s.code}]`, filePath);
      return true;
    }
    return false;
  });
  return srv ? path.join(cacheBaseDir, srv.code, filePath) : null;
};

const download = async (url: string, outputDir: string, srv: TServer) => {
  const fileName = url.split('/').pop() || '';
  const fileType = fileName.slice(fileName.lastIndexOf('.'));
  const tmpPath = path.resolve(cacheBaseDir, '_tmp_', fileName);
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
        return resolve(srv.code);
      } else {
        return resolve(null);
      }
    });
  });
};

const downloadFile = async (url: string, res: any) => {
  if (IGNORE_FILES.find((str) => url.includes(str))) {
    console.log('❌ [404]', url);
    return res.sendStatus(404);
  }
  for await (const srv of SERVERS) {
    const fileName = url.split('/').pop() || '';
    const outputDir = path
      .join(cacheBaseDir, srv.code, url)
      .replace(fileName, '');
    const downloadedFrom = await download(url, outputDir, srv);
    if (downloadedFrom) {
      console.log(`✅ [${downloadedFrom}]`, url);
      return res.sendFile(path.join(outputDir, fileName));
    }
  }
  console.log('❌ [403]', url);
  return res.sendStatus(403);
};

const cacheRequestHandler: RequestHandler = (req, res, next) => {
  const url = (req.originalUrl || req.url).replace(/^\/\w+\//, '/');
  if (req.method === 'HEAD') {
    return res.sendStatus(200);
  }
  if (req.method !== 'GET') {
    return res.sendStatus(403);
  }

  const fileName = url.split('/').pop() || '';
  const fileType = fileName.slice(fileName.lastIndexOf('.'));

  if (!VALID_FILE_TYPES.includes(fileType)) {
    console.log('♻️', url);
    return next();
  }

  const cachedPath = getCachedPath(url);
  if (cachedPath) {
    return res.sendFile(cachedPath);
  }
  console.log(req.method, url);
  if (IGNORE_FILES.find((str) => url.includes(str))) {
    console.log('❌ [404]', url);
    return res.status(404);
  }
  return downloadFile(url, res);
};

const app = express();
if (verbose) {
  app.use(morgan('combined'));
}
app.get('*', cacheRequestHandler);
app.listen(port, () => {
  console.log(`Serving! http://0.0.0.0:${port}/${defaultPath}\n`);
  console.log('add this ⬇️  in build.gradle');
  console.log(
    chalk.green(
      `maven { url "http://127.0.0.1:${port}/${defaultPath}"; allowInsecureProtocol true }`
    )
  );
  console.log('\nadd this ⬇️  in build.gradle.kts');
  console.log(
    chalk.green(
      `maven { url = uri("http://127.0.0.1:${port}/${defaultPath}")\nisAllowInsecureProtocol = true }`
    )
  );
});

// help:
// replace google() with maven { url "http://127.0.0.1:8005/v1" }
