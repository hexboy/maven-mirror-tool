import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import minimist from 'minimist';

const config = yaml.load(
  fs.existsSync('config.local.yml')
    ? fs.readFileSync('config.local.yml', 'utf8')
    : fs.readFileSync('config.yml', 'utf8')
) as IConfig;
const args = minimist(process.argv);

const {
  REPOSITORIES,
  PROXIES,
  IGNORE_FILES = [],
  VALID_FILE_TYPES = [],
} = config;

const PORT = args.port || config.PORT || 8008;
const CACHE_DIR = path.resolve(
  args['cache-dir'] || config.CACHE_DIR,
  '__MMT_CACHE__'
);
const DEFAULT_PATH = args.path || config.DEFAULT_PATH || 'v1';
const VERBOSE = args.verbose || config.LOG_REQUESTS || false;

export {
  PORT,
  PROXIES,
  VERBOSE,
  CACHE_DIR,
  DEFAULT_PATH,
  IGNORE_FILES,
  REPOSITORIES,
  VALID_FILE_TYPES,
};
