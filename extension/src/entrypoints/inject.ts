export default defineUnlistedScript(() => {
  try {
    const playerResponse = (window as any).ytInitialPlayerResponse;
    if (playerResponse) {
      window.postMessage(
        {
          type: 'SOCRATES_PLAYER_RESPONSE_EXTRACTED',
          payload: playerResponse,
        },
        '*',
      );
    }
  } catch (e) {
    console.error('[Socrates Inject] Failed to read transcript URL from page context:', e);
  }
});
