# 20-10

A pastel-themed photo booth and gallery built with vanilla HTML, CSS, JavaScript, and a small Vercel API.

## Features

- Camera capture with a short photo-booth countdown.
- Hand tracking and heart-gesture interactions.
- Swipeable photo gallery with chronological ordering.
- GitHub-backed photo storage in `photos/` (when the Vercel API is configured).
- Second-precision filenames in Vietnam time to reduce upload collisions.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | Main photo-booth page |
| `gallery.html` | Gallery page |
| `css/` | Site styles |
| `js/` | Camera, gestures, gallery and UI modules |
| `api/photos.js` | Serverless photo listing and consent-triggered upload endpoint |
| `photos/` | Publicly stored gallery images |
| `tests/photoFilename.test.mjs` | Timestamp and gallery sorting regression checks |
| `vercel.json` | Vercel deployment configuration |

## Local preview

Serve the project root with a static HTTP server, for example:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`. The static interface can be previewed locally; GitHub-backed photo listing and uploads require a compatible serverless deployment.

## Run tests

With Node.js installed, run:

```sh
node tests/photoFilename.test.mjs
```

The test covers Vietnam-local timestamps, midnight rollover, legacy image sorting, and filenames for captures taken seconds apart.

## Deploying the photo API

The project includes a Vercel serverless function at `api/photos.js`. Configure the following **server-side environment variables** in your deployment settings:

- `GITHUB_TOKEN`: token with the required repository Contents access (read/write for uploads).
- `GITHUB_REPOSITORY`: target repository, e.g. `hlounhh/20-10`.
- `GITHUB_BRANCH`: storage branch (the current default is `main`).

Never put the token in client-side JavaScript or commit it to the repository. The photo endpoint is **not an authenticated upload service**; configure Vercel Firewall/rate limiting before sharing publicly.

## Privacy and safety

Images committed to a **public GitHub repository are publicly accessible**. Only share photos with the permission of everyone pictured. Do not upload sensitive or private images; removing an image later may not erase previously cached copies or Git history.

## Contributing

Please describe the problem or improvement clearly in an issue and keep pull requests focused. When changing photo filenames or gallery ordering, run the regression test above.
