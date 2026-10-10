async function toggleOn(tab) {
  if (!tab || !tab.id) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content.js'] });
    await chrome.tabs.sendMessage(tab.id, { cmd: 'toggle' });
  } catch (e) { /* pagine di sistema (chrome://, Web Store) non consentite */ }
}
chrome.action.onClicked.addListener(toggleOn);
chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'toggle-3d') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  toggleOn(tab);
});
