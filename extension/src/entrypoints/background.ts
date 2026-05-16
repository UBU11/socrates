export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.info('Socrates Transcript Extractor installed.', {
      id: browser.runtime.id,
    });
  });
});
