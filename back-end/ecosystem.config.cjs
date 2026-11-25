/* global module */
// pm2 cho VPS ít RAM: `pm2 start ecosystem.config.cjs` (chạy trong thư mục back-end, sau `npm run build`).
module.exports = {
  apps: [
    {
      name: 'gia-thinh-api',
      script: 'dist/server.js',
      // Một process: rate limit đăng nhập lưu trong bộ nhớ, chạy cluster sẽ đếm sai.
      exec_mode: 'fork',
      instances: 1,
      node_args: '--max-old-space-size=256',
      max_memory_restart: '400M',
      kill_timeout: 12000,
      env: {
        NODE_ENV: 'production',
        // Giảm phân mảnh bộ nhớ của sharp/libvips trên glibc.
        MALLOC_ARENA_MAX: '2',
      },
    },
  ],
};
