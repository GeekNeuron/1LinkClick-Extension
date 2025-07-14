// This function contains the core logic for scanning the page.
function runLinkScanner(tabId) {
  // Ensure we don't run on chrome:// or other restricted pages.
  chrome.tabs.get(tabId, (tab) => {
    // Stop if there's an error or it's not a valid web page
    if (chrome.runtime.lastError || !tab || !tab.url || !tab.url.startsWith('http')) {
      return;
    }

    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: scrapeAndGroupLinks,
    }).then(injectionResults => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError.message);
        return;
      }
      for (const frameResult of injectionResults) {
        if (frameResult.result) {
          const linksByExtension = frameResult.result;
          const totalLinks = Object.values(linksByExtension).reduce((sum, arr) => sum + arr.length, 0);

          // Store the grouped links for the popup to use.
          chrome.storage.local.set({ links: linksByExtension });

          // Set the badge counter on the extension icon.
          if (totalLinks > 0) {
            chrome.action.setBadgeText({ text: totalLinks.toString(), tabId: tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#007BFF' });
          } else {
            // Clear the badge if no links are found.
            chrome.action.setBadgeText({ text: '', tabId: tabId });
          }
        }
      }
    });
  });
}

// Listener 1: Fires when a new page is fully loaded.
chrome.webNavigation.onCompleted.addListener((details) => {
  // We only care about the main page, not iframes within it.
  if (details.frameId === 0) {
    runLinkScanner(details.tabId);
  }
}, { url: [{ schemes: ['http', 'https'] }] });

// Listener 2: Fires on client-side navigation in modern web apps (e.g., YouTube, GitHub).
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
  // We only care about the main page, not iframes within it.
  if (details.frameId === 0) {
    runLinkScanner(details.tabId);
  }
}, { url: [{ schemes: ['http', 'https'] }] });


// This function is injected into the web page to find links.
function scrapeAndGroupLinks() {
  const links = Array.from(document.querySelectorAll('a[href]'));
  const groupedLinks = {};
  const knownExtensions = [
      'mp4', 'mkv', 'webm', 'mov', 'avi',
      'mp3', 'wav', 'ogg', 'flac',
      'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp',
      'js', 'json', 'css', 'xml',
      'pdf', 'zip', 'rar', 'tar', 'gz', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'
  ];

  links.forEach(link => {
    try {
      // Resolve relative URLs to absolute URLs
      const url = new URL(link.href, document.baseURI);
      const pathname = url.pathname;
      const extension = pathname.split('.').pop().toLowerCase();

      if (knownExtensions.includes(extension)) {
        if (!groupedLinks[extension]) {
          groupedLinks[extension] = [];
        }
        // Avoid adding duplicate links for the same extension type
        if (!groupedLinks[extension].includes(url.href)) {
          groupedLinks[extension].push(url.href);
        }
      }
    } catch (e) {
      // Ignore invalid URLs that can't be parsed.
    }
  });

  return groupedLinks;
}
