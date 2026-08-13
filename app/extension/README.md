# World Downloader Studio download capture

A Manifest V3 browser extension that offers a browser download to World Downloader
Studio before the browser takes it. The application then opens its own **Start
download** dialog, and nothing transfers until somebody confirms it there.

## Installing it

This extension ships **unpacked, or as a plain ZIP**. It is deliberately not
distributed as a `.crx`.

A `.crx` package carries a signature, and producing one requires generating and
keeping an extension private key. Code signing of every kind is permanently out
of scope for this project, so no signing key is ever created, stored or used
here. A ZIP of this directory is a ZIP; it is never renamed to `.crx` and it is
never described as one.

### Chrome, Edge and other Chromium browsers

1. Open `chrome://extensions` (or `edge://extensions`).
2. Switch **Developer mode** on.
3. Choose **Load unpacked** and select this `extension` directory.

To hand the same directory to somebody else, compress it first — on Windows,
`Compress-Archive -Path .\extension\* -DestinationPath .\download-capture.zip` —
and they unpack it and load it the same way.

## Pairing it with the application

1. In World Downloader Studio, open the **Downloads** tab.
2. Start the capture receiver if it is not already listening. The tab shows the
   exact loopback address and a pairing token.
3. Open this extension's **Settings**, paste both, and press **Test the
   connection**.
4. Switch **Capture downloads and hand them to the application** on.

The token is regenerated every time the receiver starts, so a token that has
stopped working means the receiver was restarted — copy the new one.

## What it sends, and where

One JSON document, to one address: the loopback receiver you configured. It
carries the download's URL, its referrer, the filename the browser suggested,
the MIME type the server declared and the size the server declared. It carries
no cookies, no credentials, no page content and no browsing history.

`credentials: 'omit'` is set on the request, redirects are refused outright, and
the only host permission this extension asks for is `http://127.0.0.1/*`. It can
reach nothing else.

## What happens when the application is not listening

The handover is posted **before** the browser's own download is cancelled. If the
receiver does not answer, the browser download is left running and the popup
records why. A receiver that is switched off costs you an interruption, never a
file.

## Files

| File | What it is |
| --- | --- |
| `manifest.json` | The Manifest V3 declaration: two permissions, one loopback host permission. |
| `background.js` | The capture service worker. Decides, posts, then stands the browser down. |
| `config.js` | Stored configuration, its defaults, its validation and the capture rules. |
| `options.html` / `options.js` | The pairing and capture-rule settings. |
| `popup.html` / `popup.js` | Live connection status and what happened recently. |
| `shared.css` | The styling for both surfaces. Bundled locally, in light and dark. |
