document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get('links', (data) => {
        if (data.links) {
            displayLinks(data.links);
        } else {
            document.querySelector('.main-content').innerHTML = '<p>No downloadable links found on this page.</p>';
        }
    });

    document.addEventListener('contextmenu', event => event.preventDefault());
});

function displayLinks(links) {
    for (const category in links) {
        const container = document.querySelector(`#${category}-links .link-container`);
        if (links[category].length > 0) {
            document.querySelector(`#${category}-links`).style.display = 'block';
            links[category].forEach(link => {
                const linkBox = document.createElement('div');
                linkBox.className = 'link-box';

                const linkUrl = document.createElement('div');
                linkUrl.className = 'link-url';
                linkUrl.textContent = link;

                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-btn';
                copyBtn.textContent = 'Copy';
                copyBtn.addEventListener('click', () => {
                    navigator.clipboard.writeText(link).then(() => {
                        copyBtn.textContent = 'Copied!';
                        setTimeout(() => {
                            copyBtn.textContent = 'Copy';
                        }, 2000);
                    });
                });

                linkBox.appendChild(linkUrl);
                linkBox.appendChild(copyBtn);
                container.appendChild(linkBox);
            });
        } else {
            document.querySelector(`#${category}-links`).style.display = 'none';
        }
    }
}
