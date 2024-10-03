import { RequestHandler } from 'express';
import got from 'got';

const gradleApi = 'https://plugins.gradle.org/api/gradle/4.10/plugin/use';

export const LegacyGradlePluginsHandler: RequestHandler = (req, res, next) => {
  const url = req.originalUrl ?? req.url;
  if (!url.includes('.gradle.plugin/')) {
    next();
  }

  if (req.method !== 'HEAD' && req.method !== 'GET') {
    return res.sendStatus(403);
  }

  try {
    const basePath = /^\/[^/]*(?=\/)/.exec(url)?.[0];
    const fileName = /[^/]+$/.exec(url)?.[0];
    const version = /[^/]+$/.exec(url.replace(`/${fileName}`, ''))?.[0];
    const packageId = fileName?.replace(/\.gradle\.plugin.*$/, '');
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
