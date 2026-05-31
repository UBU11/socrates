export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    console.info('Extension installed.', {
      id: browser.runtime.id,
    });
  });
});
