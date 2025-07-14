chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      function: scrapeLinks,
    }).then(injectionResults => {
      for (const frameResult of injectionResults) {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError.message);
          return;
        }
        if (frameResult.result) {
          chrome.storage.local.set({ links: frameResult.result });
        }
      }
    });
  }
});

function scrapeLinks() {
  const links = Array.from(document.querySelectorAll('a'));
  const downloadableExtensions = {
      video: ['mp4', 'mkv', 'avi', 'mov', 'webm'],
      music: ['mp3', 'wav', 'ogg', 'flac'],
      image: ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'],
      script: ['js', 'json', 'xml', 'css'],
  };

  const categorizedLinks = {
      video: [],
      music: [],
      image: [],
      script: [],
      other: [],
  };

  links.forEach(link => {
      const url = link.href;
      if (!url) return;

      const extension = url.split('.').pop().toLowerCase();
      let categorized = false;

      for (const category in downloadableExtensions) {
          if (downloadableExtensions[category].includes(extension)) {
              categorizedLinks[category].push(url);
              categorized = true;
              break;
          }
      }

      if (!categorized && url.startsWith('http')) {
          categorizedLinks.other.push(url);
      }
  });

  return categorizedLinks;
}
