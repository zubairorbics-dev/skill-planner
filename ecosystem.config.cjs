/**
 * PM2 ecosystem — staging / production
 *
 * Usage:
 *   npm ci && npm run build
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
module.exports = {
  apps: [
    {
      name: 'skill-planner',
      script: 'npx',
      args: 'tsx server.ts',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3035,
      },
      // Optional: override secrets here only if not using .env
      // Prefer keeping secrets in .env (dotenv loads them in server.ts)
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};
