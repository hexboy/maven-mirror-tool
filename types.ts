type TProxy = {
  protocol: 'http' | 'https' | 'socks5';
  host: string;
  port: number;
};

type TServer = {
  code: string;
  url: string;
  fileTypes?: string[];
  proxy?: string;
  auth?: {
    username: string;
    password: string;
  };
};

interface IConfig {
  PORT: number;
  CACHE_DIR: string;
  SERVERS: TServer[];
  DEFAULT_PATH: string;
  LOG_REQUESTS?: boolean;
  IGNORE_FILES?: string[];
  VALID_FILE_TYPES?: string[];
  PROXIES: { [K: string]: TProxy };
}
