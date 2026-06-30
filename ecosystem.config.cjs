module.exports = {
  apps: [
    {
      name: 'mmt-server',
      script: 'src/index.ts',
      interpreter: 'node',
      max_memory_restart: '300M',
      env_production: {
        NODE_ENV: 'production',
      },
      env_development: {
        NODE_ENV: 'development',
      },
    },
  ],
};
