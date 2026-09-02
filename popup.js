document.addEventListener('DOMContentLoaded', () => {
    const linkListContainer = document.getElementById('link-list-container');
    const rescanBtn = document.getElementById('rescan-btn');
    let currentTabId = null;

    // Disable right-click everywhere in the popup EXCEPT inside .link-url,
    // so users can still use the browser's native "Copy link" if they prefer.
    // (This was claimed in the README but not actually implemented before.)
    document.addEventListener('contextmenu', (e) => {
        if (!e.target.closest('.link-url')) {
            e.preventDefault();
        }
    });

    function renderLinks(linksByExtension) {
        linkListContainer.innerHTML = '';

        if (!linksByExtension || Object.keys(linksByExtension).length === 0) {
            linkListContainer.innerHTML = `<p class="empty-text">No downloadable links found.</p>`;
            return;
        }

        for (const ext in linksByExtension) {
            const links = linksByExtension[ext];
            if (!links || links.length === 0) continue;

            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = `${ext.toUpperCase()} Files (${links.length})`;
            details.appendChild(summary);

            const contentDiv = document.createElement('div');
            contentDiv.className = 'links-accordion-content';
            links.forEach((link) => contentDiv.appendChild(createLinkBox(link)));
            details.appendChild(contentDiv);

            linkListContainer.appendChild(details);
        }
    }

    // Load links for the CURRENTLY ACTIVE tab only (fixes the old bug where
    // storage used one global key shared across every tab).
    function loadLinksForCurrentTab() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs && tabs[0];
            if (!tab) {
                linkListContainer.innerHTML = `<p class="empty-text">No active tab found.</p>`;
                return;
            }
            currentTabId = tab.id;

            if (!tab.url || !tab.url.startsWith('http')) {
                linkListContainer.innerHTML = `<p class="empty-text">This page can't be scanned.</p>`;
                rescanBtn.disabled = true;
                return;
            }

            const key = 'links_' + currentTabId;
            chrome.storage.local.get(key, (data) => {
                if (chrome.runtime.lastError) {
                    linkListContainer.innerHTML = `<p class="empty-text">Error loading links.</p>`;
                    return;
                }
                renderLinks(data[key]);
            });
        });
    }

    // Manual rescan: asks the background script to scan again right now.
    // Useful for lazy-loaded / infinite-scroll pages where new links appear
    // after the automatic scan already ran.
    rescanBtn.addEventListener('click', () => {
        if (currentTabId == null) return;
        rescanBtn.disabled = true;
        const originalLabel = rescanBtn.textContent;
        rescanBtn.textContent = '...';
        linkListContainer.innerHTML = `<p class="loading-text">Searching for links...</p>`;

        chrome.runtime.sendMessage({ action: 'rescan', tabId: currentTabId }, (response) => {
            rescanBtn.disabled = false;
            rescanBtn.textContent = originalLabel;
            if (chrome.runtime.lastError || !response || !response.ok) {
                linkListContainer.innerHTML = `<p class="empty-text">Could not scan this page.</p>`;
                return;
            }
            renderLinks(response.links);
        });
    });

    // Live-refresh if the MutationObserver in the page finds new links
    // while the popup happens to be open.
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || currentTabId == null) return;
        const key = 'links_' + currentTabId;
        if (changes[key]) {
            renderLinks(changes[key].newValue);
        }
    });

    loadLinksForCurrentTab();
});

function createLinkBox(link) {
    const linkBox = document.createElement('div');
    linkBox.className = 'link-box';

    const linkUrl = document.createElement('div');
    linkUrl.className = 'link-url';
    linkUrl.textContent = link;

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = 'Copy';
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(link).then(() => {
            copyBtn.textContent = 'Copied!';
            copyBtn.classList.add('copied');
            setTimeout(() => {
                copyBtn.textContent = 'Copy';
                copyBtn.classList.remove('copied');
            }, 2000);
        });
    });

    linkBox.appendChild(linkUrl);
    linkBox.appendChild(copyBtn);
    return linkBox;
}
