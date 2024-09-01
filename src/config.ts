import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { IConfig } from '../types';

const config = yaml.load(
  fs.existsSync('config.local.yml')
    ? fs.readFileSync('config.local.yml', 'utf8')
    : fs.readFileSync('config.yml', 'utf8')
) as IConfig;

const {
  REPOSITORIES,
  PROXIES,
  IGNORE_FILES = [],
  VALID_FILE_TYPES = [],
} = config;

const PORT = config.PORT ?? 8008;
const CACHE_DIR = path.resolve(config.CACHE_DIR, '__MMT_CACHE__');
const TMP_DIR = path.resolve(config.CACHE_DIR, '__MMT_TMP__');
const DEFAULT_PATH = config.DEFAULT_PATH ?? 'v1';
const VERBOSE = config.LOG_REQUESTS ?? false;

export {
  PORT,
  PROXIES,
  VERBOSE,
  TMP_DIR,
  CACHE_DIR,
  DEFAULT_PATH,
  IGNORE_FILES,
  REPOSITORIES,
  VALID_FILE_TYPES,
};
