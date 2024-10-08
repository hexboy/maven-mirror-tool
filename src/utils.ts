import fs from 'fs';
import os from 'os';
import path from 'path';

import { CACHE_DIR, REPOSITORIES } from './config';

export const getCachedServer = (filePath: string) => {
  const srv = REPOSITORIES.find((s) => {
    const fPath = path.join(CACHE_DIR, s.name, filePath);
    if (fs.existsSync(fPath) ? fs.statSync(fPath).size : 0) {
      return true;
    }
    return false;
  });
  return srv;
};

export const printServedEndpoints = (
  port: number | string,
  urlPath: string
) => {
  try {
    const interfaces = os.networkInterfaces();
    const list = Object.keys(interfaces)
      .map((name) =>
        (interfaces[name] ?? []).filter((item) => item.family === 'IPv4')
      )
      .filter((l) => l.length > 0)
      .flat();
    const localInterface = list.find((item) => item.internal);
    const networkInterface = list.find((item) => !item.internal);
    console.log('\n🚀 Serving!');
    console.log('--------------------------------------------');
    console.log(`Local: http://0.0.0.0:${port}/${urlPath}`);
    if (localInterface) {
      console.log(`Local: http://${localInterface.address}:${port}/${urlPath}`);
    }
    if (networkInterface) {
      console.log(
        `Network: http://${networkInterface.address}:${port}/${urlPath}`
      );
    }
    console.log('--------------------------------------------');

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e: unknown) {
    console.log('\n🚀 Serving!');
    console.log('--------------------------------------------');
    console.log(`Local: http://0.0.0.0:${port}/${urlPath}`);
    console.log(`Local: http://127.0.0.1:${port}/${urlPath}`);
    console.log('--------------------------------------------');
  }
};

export const extractFileInfo = (url: string) => {
  // Split the pathname into segments
  const segments = url.split('/');

  // Get the last segment (filename)
  const filename = segments[segments.length - 1].replace(/\?.*$/, '');

  // Extract the file extension
  const fileExtension = filename.split('.').pop();

  // Construct the relative path (excluding the filename)
  const relativePath = segments.slice(0, -1).join('/');

  // Create the output object
  const fileInfo = {
    fileName: filename,
    relativePath: relativePath,
    fileExtension: fileExtension,
  } as {
    fileName: string;
    relativePath: string;
    fileExtension: string;
  };

  return fileInfo;
};
