document.addEventListener('DOMContentLoaded', () => {
    const linkListContainer = document.getElementById('link-list-container');

    chrome.storage.local.get('links', (data) => {
        if (chrome.runtime.lastError) {
            console.error('Error reading from storage:', chrome.runtime.lastError);
            linkListContainer.innerHTML = `<p class="empty-text">Error loading links.</p>`;
            return;
        }

        const linksByExtension = data.links;

        if (!linksByExtension || Object.keys(linksByExtension).length === 0) {
            linkListContainer.innerHTML = `<p class="empty-text">No downloadable links found.</p>`;
            return;
        }

        // Clear loading text
        linkListContainer.innerHTML = '';

        // Create a collapsible section for each extension type
        for (const ext in linksByExtension) {
            const links = linksByExtension[ext];
            if (links.length === 0) continue;

            // <details> element for the accordion
            const details = document.createElement('details');

            // <summary> element for the header
            const summary = document.createElement('summary');
            summary.textContent = `${ext.toUpperCase()} Files (${links.length})`;
            details.appendChild(summary);

            // Container for the links inside the accordion
            const contentDiv = document.createElement('div');
            contentDiv.className = 'links-accordion-content';

            links.forEach(link => {
                const linkBox = createLinkBox(link);
                contentDiv.appendChild(linkBox);
            });

            details.appendChild(contentDiv);
            linkListContainer.appendChild(details);
        }
    });
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
        e.stopPropagation(); // prevent details from closing
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
