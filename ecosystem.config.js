module.exports = {
  apps: [
    {
      name: 'mmt-server',
      script: 'node',
      args: 'src/index.ts',
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
    },
  ],
};
