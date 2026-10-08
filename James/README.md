# James — Electron Desktop

Electron desktop wrapper for the James local AI assistant.

## Build & Run

**Prerequisites:** Node.js + npm

```bash
cd James
npm install
npm run electron:dev      # development (starts frontend dev server + Electron)
npm run electron:build    # release build
```

## Architecture

- **`main.js`** — Electron main process. Creates BrowserWindow pointing to the
  frontend Vite dev server (`http://localhost:5173`) in development, or the built
  `frontend/dist/index.html` in production.
- **`preload.js`** — Context bridge exposing `electronAPI` to the renderer:
  backend URL, path opening, backend status events.

The frontend source lives in `../frontend/` and is bundled into `frontend/dist` for production.

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
