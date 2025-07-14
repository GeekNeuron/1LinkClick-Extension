chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Run when a page is fully loaded and has a URL
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
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

          // Store the grouped links
          chrome.storage.local.set({ links: linksByExtension });

          // Set the badge counter on the extension icon
          if (totalLinks > 0) {
            chrome.action.setBadgeText({ text: totalLinks.toString(), tabId: tabId });
            chrome.action.setBadgeBackgroundColor({ color: '#007BFF' }); // A modern blue color
          } else {
            chrome.action.setBadgeText({ text: '', tabId: tabId });
          }
        }
      }
    });
  }
});

// This function will be injected into the web page
function scrapeAndGroupLinks() {
  const links = Array.from(document.querySelectorAll('a[href]'));
  const groupedLinks = {};
  const knownExtensions = [
      'mp4', 'mkv', 'webm', 'mov', 'avi', // video
      'mp3', 'wav', 'ogg', 'flac', // music
      'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', // image
      'js', 'json', 'css', 'xml', // script
      'pdf', 'zip', 'rar', 'tar', 'gz', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx' // document/archive
  ];

  links.forEach(link => {
    try {
      const url = new URL(link.href, document.baseURI);
      const pathname = url.pathname;
      const extension = pathname.split('.').pop().toLowerCase();

      // Only consider known downloadable extensions
      if (knownExtensions.includes(extension)) {
        if (!groupedLinks[extension]) {
          groupedLinks[extension] = [];
        }
        // Avoid duplicates
        if (!groupedLinks[extension].includes(url.href)) {
          groupedLinks[extension].push(url.href);
        }
      }
    } catch (e) {
      // Ignore invalid URLs
    }
  });

  return groupedLinks;
}
