import { RequestHandler } from 'express';
import got from 'got';
import { extractFileInfo, getCachedServer } from '../utils';

const gradleApi = 'https://plugins.gradle.org/api/gradle/4.10/plugin/use';

export const LegacyGradlePluginsHandler: RequestHandler = (req, res, next) => {
  const url = req.originalUrl ?? req.url;
  if (!url.includes('.gradle.plugin/')) {
    return next();
  }

  const server = getCachedServer(url.replace(/^\/\w+\//, '/'));
  if (server) {
    return next();
  }

  try {
    const { fileName, relativePath } = extractFileInfo(url);
    const basePath = /^\/[^/]*(?=\/)/.exec(relativePath)?.[0];
    const version = /[^/]+$/.exec(relativePath)?.[0];
    const packageId = fileName.replace(/\.gradle\.plugin.*$/, '');
    const endpoint = `${gradleApi}/${packageId}/${version}`;
    got
      .get(endpoint)
      .then((result) => {
        const info = JSON.parse(result.body) as {
          id: string;
          version: string;
          implementation: {
            gav: string;
            repo: string;
          };
          implementationType: string;
          legacy: boolean;
        };
        const newId =
          /(?<=:).+(?=:)/.exec(info.implementation.gav)?.[0] ?? 'new-id';
        const newFileName = /[^/]+$/.exec(
          url.replaceAll(`${info.id}.gradle.plugin`, newId)
        )?.[0];
        const newUrl = `${basePath}/${/^[\w.]+(?=:)/.exec(info.implementation.gav)?.[0]?.replaceAll('.', '/')}/${newId}/${version}/${newFileName}`;
        console.log('🔀 [301]', url);
        req.headers['alias-url'] = url.replace(/^\/\w+\//, '/');
        req.url = newUrl;
        next();
      })
      .catch(() => {
        next();
      });
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    error;
    next();
  }
};
