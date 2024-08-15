module.exports = {
  apps: [
    {
      name: 'mmt-server',
      script: 'tsx src/index.ts --port=${PORT}',
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
