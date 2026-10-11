// Enhancements only: the prep room still runs without service workers or persistence APIs.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js', {scope: './'}).then(async registration => {
    await navigator.serviceWorker.ready;
    const status = document.getElementById('offlineStatus');
    const updateStatus = () => { status.textContent = registration.waiting ? 'An app update is ready. After your round, close all app windows and reopen to install it.' : 'Offline app ready on this device. Your saved rounds remain local.'; };
    updateStatus();
    registration.addEventListener('updatefound', () => {
      registration.installing?.addEventListener('statechange', updateStatus);
    });
  }).catch(() => { document.getElementById('offlineStatus').textContent = 'Offline setup did not finish. Reopen online before relying on offline use.'; });
}
document.getElementById('continueRound').addEventListener('click', () => {
  navigator.storage?.persist?.().catch(() => {});
});
// Switching apps can delay repainting; elapsed time always comes from the saved clock deadline.
window.addEventListener('pageshow', () => tick());
