import { RequestHandler } from 'express';

import { IGNORE_FILES, VALID_FILE_TYPES } from '../config';
import { extractFileInfo } from '../utils';

export const ValidateRequestHandler: RequestHandler = (req, res, next) => {
  const url = req.url.replace(/^\/\w+\//, '/');
  if (req.method !== 'HEAD' && req.method !== 'GET') {
    return res.sendStatus(403);
  }

  const { fileExtension } = extractFileInfo(url);

  if (!VALID_FILE_TYPES.includes('.' + fileExtension)) {
    console.log('♻️', url);
    return res.status(404);
  }

  if (IGNORE_FILES.find((str) => url.includes(str))) {
    console.log('❌ [404]', url);
    return res.status(404);
  }

  console.log(req.method, url);

  next();
};
