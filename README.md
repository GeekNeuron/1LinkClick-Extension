# 1LinkClick Extension

An extension to automatically discover and categorize downloadable links on web pages.

---

## 🚀 About The Project

**1LinkClick** is a browser extension designed to simplify the process of finding and managing download links. It automatically scans all links on a web page in the background and categorizes them by file type (Video, Music, Image, Script, etc.) in a sleek and user-friendly popup. With this tool, you no longer need to manually search through source code or make multiple clicks to find the link you're looking for.

## ✨ Features

* **🔍 Automatic Scanning:** Links are identified as soon as the page fully loads.
* **📂 Smart Categorization:** Links are sorted into distinct categories for quicker access.
* **🎨 Modern UI:** A beautiful design featuring an animated background, rounded corners, and clean icons.
* **📋 One-Click Copy:** Each link has a dedicated copy button to quickly send it to your clipboard.
* **↔️ Horizontal Scrolling:** Long links are easy to view and scroll through.
* **🔒 Right-Click Disabled:** To prevent accidental interactions, the right-click context menu is disabled within the popup (except for the link fields).

## 📸 Screenshots

<div align="center">
  <img src="https://i.imgur.com/screenshot-placeholder.png" alt="Screenshot of 1LinkClick Popup" width="400"/>
  <p><i>A view of the extension popup displaying categorized links.</i></p>
</div>

## 🛠️ Installation

To install this extension manually (sideloading) in Chromium-based browsers (like Google Chrome, Microsoft Edge, Opera, etc.), follow these steps:

1.  **Download the Project:**
    First, download the project from GitHub:
    ```bash
    git clone https://github.com/GeekNeuron/1LinkClick.git
    ```
    Alternatively, download the ZIP file from the main project page and extract it.

2.  **Open the Extensions Page:**
    Open a new tab in your browser and navigate to `chrome://extensions`.

3.  **Enable Developer Mode:**
    In the top right corner of the page, toggle the "Developer mode" switch to on.

4.  **Load the Extension:**
    Click the "Load unpacked" button and select the folder where you extracted the `1LinkClick` project.

5.  **Done!**
    The extension is now successfully installed, and its icon will appear in your browser's toolbar. You can now visit any web page, click the extension icon, and use its features.

## ⚙️ How It Works

This extension consists of two primary scripts:

* **`background.js`**: This script listens for browser events. As soon as a tab is fully loaded, it injects a content script into that page.
* **Injected Content Script**: This script finds all `<a>` tags on the page, extracts their `href` attributes, and categorizes them based on file extensions into predefined groups (video, music, image, etc.). The results are then sent to the extension's local `storage`.
* **`popup.js`**: When the user clicks the extension icon, this script runs, reads the data saved in `storage`, and dynamically displays it within the `popup.html` structure.

## ❤️ Developer

Created with ❤️ by **GeekNeuron**

[![GitHub](https://img.shields.io/badge/GitHub-GeekNeuron-181717?style=for-the-badge&logo=github)](https://github.com/GeekNeuron)
