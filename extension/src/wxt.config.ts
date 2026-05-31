import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({
    oxc: false,
    build: {
      minify: 'esbuild',
    },
    server: {
      port: 3007,
      strictPort: true,
    },
    esbuild: {
      charset: 'ascii',
    },
  }),
  dev: {
    server: {
      port: 3007,
    },
  },
  manifest: {
    name: 'Socrates Transcript Extractor',
    description: 'Extract readable transcripts from YouTube videos.',
    permissions: ['activeTab', 'tabs', 'storage', 'clipboardWrite'],
    host_permissions: ['*://youtube.com/*', '*://*.youtube.com/*'],
    action: {
      default_title: 'Socrates Transcript',
    },
    web_accessible_resources: [
      {
        resources: ['inject.js'],
        matches: ['*://*.youtube.com/*'],
      },
    ],
  },
});
