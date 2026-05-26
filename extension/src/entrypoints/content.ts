import { TranscriptController } from './content/controller';

export default defineContentScript({
  matches: ['*://youtube.com/*', '*://*.youtube.com/*'],
  runAt: 'document_idle',
  main() {
    const controller = new TranscriptController();
    controller.start();
  },
});
