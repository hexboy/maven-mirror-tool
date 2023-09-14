import fs from 'fs';
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
