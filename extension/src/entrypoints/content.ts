export default defineContentScript({
  matches: ['*://*/*'],
  runAt: 'document_idle',
  main() {
    console.log('Content script loaded');
  },
});
