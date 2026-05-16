import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Socrates Transcript Extractor',
    description: 'Extract readable transcripts from YouTube videos.',
    permissions: ['activeTab', 'tabs', 'storage', 'clipboardWrite'],
    host_permissions: ['*://youtube.com/*', '*://*.youtube.com/*'],
    action: {
      default_title: 'Socrates Transcript',
    },
  },
});
