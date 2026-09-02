// ---- storage key helper: links are stored PER TAB, not in one shared key ----
function storageKeyForTab(tabId) {
  return 'links_' + tabId;
}

// Merge a fresh batch of links into whatever is already stored for a tab,
// then update the badge. Used by the MutationObserver-driven dynamic updates,
// where each batch is incremental (not a full-page replacement).
function mergeLinksIntoStorage(tabId, newLinks) {
  const key = storageKeyForTab(tabId);
  chrome.storage.local.get(key, (data) => {
    const merged = Object.assign({}, data[key] || {});
    for (const ext in newLinks) {
      if (!merged[ext]) merged[ext] = [];
      for (const url of newLinks[ext]) {
        if (!merged[ext].includes(url)) merged[ext].push(url);
      }
    }
    chrome.storage.local.set({ [key]: merged }, () => {
      const totalLinks = Object.values(merged).reduce((sum, arr) => sum + arr.length, 0);
      if (totalLinks > 0) {
        chrome.action.setBadgeText({ text: totalLinks > 99 ? '99+' : totalLinks.toString(), tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#007BFF' });
      } else {
        chrome.action.setBadgeText({ text: '', tabId: tabId });
      }
    });
  });
}

// Full scan (replaces whatever was stored - used for the initial/manual scan,
// which already aggregates every frame in one shot).
function runLinkScanner(tabId, callback) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab || !tab.url || !tab.url.startsWith('http')) {
      if (callback) callback({ ok: false, reason: 'not-a-scannable-tab' });
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId: tabId, allFrames: true },
      func: scrapeAndWatchLinks,
    }).then((injectionResults) => {
      const merged = {};
      for (const frameResult of injectionResults) {
        const frameLinks = frameResult && frameResult.result;
        if (!frameLinks) continue;
        for (const ext in frameLinks) {
          if (!merged[ext]) merged[ext] = [];
          for (const url of frameLinks[ext]) {
            if (!merged[ext].includes(url)) merged[ext].push(url);
          }
        }
      }

      const totalLinks = Object.values(merged).reduce((sum, arr) => sum + arr.length, 0);
      const key = storageKeyForTab(tabId);
      chrome.storage.local.set({ [key]: merged });

      if (totalLinks > 0) {
        chrome.action.setBadgeText({ text: totalLinks > 99 ? '99+' : totalLinks.toString(), tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: '#007BFF' });
      } else {
        chrome.action.setBadgeText({ text: '', tabId: tabId });
      }

      if (callback) callback({ ok: true, links: merged, totalLinks });
    }).catch((err) => {
      console.error('1LinkClick: injection failed -', err && err.message);
      if (callback) callback({ ok: false, reason: err && err.message });
    });
  });
}

// Listener 1: Fires when a new page is fully loaded.
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) {
    runLinkScanner(details.tabId);
  }
}, { url: [{ schemes: ['http', 'https'] }] });

// Listener 2: Fires on client-side navigation (SPAs). Debounced per-tab,
// since some SPAs fire several history-state changes back-to-back.
const historyDebounceTimers = {};
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  if (details.frameId !== 0) return;
  const tabId = details.tabId;
  if (historyDebounceTimers[tabId]) clearTimeout(historyDebounceTimers[tabId]);
  historyDebounceTimers[tabId] = setTimeout(() => {
    delete historyDebounceTimers[tabId];
    runLinkScanner(tabId);
  }, 500);
}, { url: [{ schemes: ['http', 'https'] }] });

// Listener 3: manual "rescan" request from the popup, and incremental
// updates pushed by the in-page MutationObserver as content loads lazily.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.action === 'rescan' && typeof message.tabId === 'number') {
    runLinkScanner(message.tabId, (result) => sendResponse(result));
    return true; // keep channel open for async sendResponse
  }
  if (message && message.action === 'dynamic-scan-result' && sender.tab && typeof sender.tab.id === 'number') {
    mergeLinksIntoStorage(sender.tab.id, message.links || {});
  }
});

// Listener 4: clean up storage + pending timers when a tab closes.
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.remove(storageKeyForTab(tabId));
  if (historyDebounceTimers[tabId]) {
    clearTimeout(historyDebounceTimers[tabId]);
    delete historyDebounceTimers[tabId];
  }
});

// ---------------------------------------------------------------------------
// Injected into the page (and, with allFrames:true, every reachable frame).
// Does an initial full scan (returned synchronously to the caller), then -
// once per page - installs a MutationObserver (covering the main document
// AND any Shadow DOM subtrees it finds) that re-scans after a quiet period
// and pushes incremental results back to the background script. This is
// what catches lazy-loaded / infinite-scroll content that appears AFTER
// the initial scan already ran.
// ---------------------------------------------------------------------------
function scrapeAndWatchLinks() {
  const KNOWN_EXTENSIONS = [
    'mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'm3u8',
    'mp3', 'wav', 'ogg', 'flac', 'm4a',
    'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp',
    'js', 'json', 'css', 'xml',
    'pdf', 'zip', 'rar', 'tar', 'gz', '7z',
    'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
    'apk', 'iso', 'exe'
  ];
  const EXT_ANYWHERE_RE = new RegExp('\\.(' + KNOWN_EXTENSIONS.join('|') + ')(?:[/?#&]|$)', 'i');
  const LAZY_LOAD_ATTRS = ['data-src', 'data-href', 'data-download', 'data-url', 'data-file'];
  const MEDIA_TAGS = ['VIDEO', 'AUDIO', 'SOURCE', 'IMG', 'EMBED', 'TRACK'];

  function extensionFromUrl(rawUrl) {
    let url;
    try {
      url = new URL(rawUrl, document.baseURI);
    } catch (e) {
      return null;
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const pathExt = url.pathname.split('.').pop().toLowerCase();
    if (KNOWN_EXTENSIONS.includes(pathExt)) return { ext: pathExt, href: url.href };
    const match = url.href.match(EXT_ANYWHERE_RE);
    if (match) return { ext: match[1].toLowerCase(), href: url.href };
    return null;
  }

  function scrape() {
    const groupedLinks = {};
    const seen = new Set();
    const shadowRootsFound = [];

    function addCandidate(rawUrl) {
      if (!rawUrl) return;
      const found = extensionFromUrl(rawUrl);
      if (!found) return;
      const dedupeKey = found.ext + '::' + found.href;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      if (!groupedLinks[found.ext]) groupedLinks[found.ext] = [];
      groupedLinks[found.ext].push(found.href);
    }

    function processElement(el) {
      if (el.tagName === 'A' && el.hasAttribute('href')) {
        addCandidate(el.getAttribute('href'));
      }
      if (MEDIA_TAGS.includes(el.tagName) && el.hasAttribute('src')) {
        addCandidate(el.getAttribute('src'));
      }
      if (el.tagName === 'OBJECT' && el.hasAttribute('data')) {
        addCandidate(el.getAttribute('data'));
      }
      for (const attr of LAZY_LOAD_ATTRS) {
        if (el.hasAttribute && el.hasAttribute(attr)) {
          addCandidate(el.getAttribute(attr));
        }
      }
    }

    function walk(root) {
      const all = root.querySelectorAll('*');
      for (const el of all) {
        processElement(el);
        if (el.shadowRoot) {
          shadowRootsFound.push(el.shadowRoot);
          walk(el.shadowRoot);
        }
      }
    }

    walk(document);
    return { groupedLinks, shadowRootsFound };
  }

  function sendDynamicUpdate(links) {
    if (Object.keys(links).length === 0) return;
    try {
      chrome.runtime.sendMessage({ action: 'dynamic-scan-result', links: links });
    } catch (e) {
      // extension context invalidated (e.g. extension was reloaded) - nothing we can do
    }
  }

  // Track which roots already have an observer, per-page (survives repeated
  // re-injection on SPA navigation so we never install duplicate observers).
  const observedRoots = window.__1lc_observedRoots__ || (window.__1lc_observedRoots__ = new WeakSet());

  function observeRoot(root) {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    let debounceTimer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const result = scrape();
        result.shadowRootsFound.forEach(observeRoot); // watch any newly-appeared shadow roots too
        sendDynamicUpdate(result.groupedLinks);
      }, 800); // wait for a quiet period so bursts of DOM changes trigger one scan, not dozens
    });
    const target = root === document ? document.documentElement : root;
    observer.observe(target, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href', 'src', 'data-src', 'data-href', 'data-download', 'data-url', 'data-file'],
    });
  }

  const initial = scrape();

  if (!window.__1lc_watcherInstalled__) {
    window.__1lc_watcherInstalled__ = true;
    observeRoot(document);
    initial.shadowRootsFound.forEach(observeRoot);
  }

  return initial.groupedLinks;
}
