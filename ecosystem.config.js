module.exports = {
  apps: [
    {
      name: 'mmt-server',
      script: 'tsx src/index.ts',
      max_memory_restart: '300M',
    },
  ],
};
