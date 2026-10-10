async function setCors(tabId, on) {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [tabId],
    addRules: on ? [{
      id: tabId, priority: 1,
      action: { type: 'modifyHeaders', responseHeaders: [{ header: 'access-control-allow-origin', operation: 'set', value: '*' }] },
      condition: { tabIds: [tabId], resourceTypes: ['media'] }
    }] : []
  });
}

function badge(tabId, text) {
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#c0392b' });
  chrome.action.setBadgeText({ tabId, text });
  setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }), 3000);
}

async function toggleOn(tab) {
  if (!tab || !tab.id) return;
  try {
    const target = { tabId: tab.id, allFrames: true };
    await chrome.scripting.executeScript({ target, files: ['content.js'] });
    const res = await chrome.scripting.executeScript({ target, func: () => (window.__p3dToggle ? window.__p3dToggle() : 'none') });
    const st = res.map(r => r.result);
    if (!st.includes('on')) setCors(tab.id, false).catch(() => {});
    if (!st.includes('on') && !st.includes('off')) badge(tab.id, '?');   // nessun video trovato in nessun frame
  } catch (e) { badge(tab.id, 'x'); }   // pagine di sistema (chrome://, Web Store) non consentite
}

chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m && m.cmd === 'cors' && sender.tab) { setCors(sender.tab.id, m.on !== false).then(() => reply(true), () => reply(false)); return true; }
});
chrome.tabs.onRemoved.addListener(id => { setCors(id, false).catch(() => {}); });
chrome.action.onClicked.addListener(toggleOn);
chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd !== 'toggle-3d') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  toggleOn(tab);
});
