# DrivePool — Full Codebase Audit

I've read every file in your project. Here's everything I found, organized by severity.

---

## 🐛 Bugs (Things That Are Broken)

### 1. README Lies About the Tech Stack

> [!CAUTION]
> The README says **"Python · FastAPI · SQLite"** but the backend is actually **Node.js · Express · MongoDB (Mongoose)**. The README also references `pip install -r backend/requirements.txt`, `generate_secrets.py`, and `uvicorn` — none of which exist.

**Files:** [README.md](file:///d:/Projects/drive-pool1/README.md#L150-L156), [package.json](file:///d:/Projects/drive-pool1/backend/package.json)

The step `02` on the landing page also says _"Run generate_secrets.py"_ — should be `generate_secrets.js`.

**File:** [page.tsx](file:///d:/Projects/drive-pool1/frontend/app/page.tsx#L389)

---

### 2. Missing `/api/files/:fileId/thumbnail` Endpoint

The frontend references `/api/files/${file.id}/thumbnail` in multiple places:

- [dashboard/page.tsx:L272](file:///d:/Projects/drive-pool1/frontend/app/dashboard/page.tsx#L272) — Overview recent files
- [FileList.tsx:L71](file:///d:/Projects/drive-pool1/frontend/components/FileList.tsx#L71) — Grid card thumbnails
- [FileRow.tsx:L113](file:///d:/Projects/drive-pool1/frontend/components/FileRow.tsx#L113) — List row thumbnails

But **no such route exists** in the backend. The file routes only define `/download` and `/view`. Every thumbnail `<img>` silently fails via `onError`, so `has_thumbnail` files never actually show their preview.

---

### 3. Hardcoded Dark-Only Colors in Legacy Components

Several components use hardcoded hex colors instead of the theme CSS variables (`var(--dp-*)`), so **they look terrible in light mode**:

| Component | Hardcoded colors used |
|---|---|
| [FileList.tsx](file:///d:/Projects/drive-pool1/frontend/components/FileList.tsx) | `#21212b`, `#15151a`, `#0c0c10`, `#555568`, `#e8e8f0`, `#2e2e3d`, `#1a1a21` |
| [FileRow.tsx](file:///d:/Projects/drive-pool1/frontend/components/FileRow.tsx) | `#21212b`, `#555568`, `#e8e8f0`, `#18181e`, `#0c0c10`, `#8888a4` |
| [UploadZone.tsx](file:///d:/Projects/drive-pool1/frontend/components/UploadZone.tsx) | `#21212b`, `#15151a`, `#555568`, `#8888a4`, `#1a1a21`, `#18181e` |
| [StorageBar.tsx](file:///d:/Projects/drive-pool1/frontend/components/StorageBar.tsx) | `#21212b`, `#15151a`, `#555568`, `#8888a4` |
| [AccountCard.tsx](file:///d:/Projects/drive-pool1/frontend/components/AccountCard.tsx) | `#21212b`, `#15151a`, `#121217`, `#555568`, `#8888a4`, `#e8e8f0` |

These components use `bg-indigo-500` for progress bars while the rest of the app uses `bg-orange-500` — **visual inconsistency**.

---

### 4. Theme Flash (FOUC) on Page Load

[ThemeContext.tsx](file:///d:/Projects/drive-pool1/frontend/contexts/ThemeContext.tsx#L13): The initial state is hardcoded to `"dark"`. On first render, the page renders dark, then the `useEffect` reads `localStorage` and potentially switches to light — causing a visual flash. This should be handled with a blocking `<script>` in the `<html>` tag or `suppressHydrationWarning`.

---

### 5. `FileItem.id` Type Mismatch

[useFiles.ts](file:///d:/Projects/drive-pool1/frontend/hooks/useFiles.ts#L6): `id` is typed as `number`, but the backend returns MongoDB `_id` as a **string** (`f._id.toString()` in [filesController.js:L30](file:///d:/Projects/drive-pool1/backend/src/controllers/filesController.js#L30)). This means TypeScript lies about the type. It works at runtime because JS is loosely typed, but it could cause subtle identity comparison bugs.

---

### 6. Fernet Encryption: Double Padding

[authService.js:L30-L36](file:///d:/Projects/drive-pool1/backend/src/services/authService.js#L30-L36): Manual PKCS7 padding is applied, then `cipher.update(padded)` + `cipher.final()` is called. But `cipher.final()` **also applies PKCS7 padding** by default in Node.js. This means the plaintext gets double-padded. The encrypt/decrypt pair still works because `decipher.final()` strips one layer and the manual unpad strips the other — but the output is **not Fernet-compatible** despite the comment claiming it is.

---

### 7. Profile Avatar: Wrong Content-Type

[profileController.js:L78](file:///d:/Projects/drive-pool1/backend/src/controllers/profileController.js#L78): `getAvatar` always responds with `Content-Type: image/jpeg`, even if the user uploaded a PNG or WebP. The `mimeType` from the upload is never saved to the Profile model.

---

### 8. `disconnectAccount` Doesn't Fully Clean Up

[accountsController.js:L52-L58](file:///d:/Projects/drive-pool1/backend/src/controllers/accountsController.js#L52-L58): When disconnecting, the account document is kept with `isConnected: false`. But files are deleted and tokens wiped. If the user later *connects a different Google account* to the same `accountIndex`, the old `email` remains until OAuth callback overwrites it — there's a window where stale email is shown.

---

### 9. `MONGO_URI` Imported Twice (Different Sources)

[config/index.js:L5](file:///d:/Projects/drive-pool1/backend/src/config/index.js#L5) exports `MONGO_URI` from env with a default.
[db/index.js:L3](file:///d:/Projects/drive-pool1/backend/src/db/index.js#L3) reads `MONGO_URI` directly from `process.env` **without** a default.

If `MONGO_URI` is not set in the environment, `db/index.js` gets `undefined` while `config/index.js` gets the default `mongodb://localhost:27017/drivepool`. The `connectDB()` call would fail with a cryptic Mongoose error.

---

### 10. `syncFilesFromDrives` Sequential Processing

[driveService.js:L554](file:///d:/Projects/drive-pool1/backend/src/services/driveService.js#L554): Sync iterates accounts sequentially with `for...of`. With many accounts, sync can take a very long time. This is especially problematic for the startup sync which blocks token warming benefits.

---

### 11. `useFiles` Polling Bug

[useFiles.ts:L31-L34](file:///d:/Projects/drive-pool1/frontend/hooks/useFiles.ts#L31-L34): The `useEffect` calls `refreshFiles()` immediately, then sets a `setTimeout` for 4 seconds — but it **never repeats**. It's a one-shot delayed refresh, not a polling mechanism. If you intended periodic polling, you'd need `setInterval`.

---

## 🔒 Security Issues

### 12. No Confirmation Before Account Disconnect

[settings/page.tsx](file:///d:/Projects/drive-pool1/frontend/app/dashboard/settings/page.tsx#L21): `handleDisconnect` fires immediately on click — no confirmation dialog. A misclick permanently deletes all local file records for that account.

---

### 13. `Content-Disposition` Header Injection

[filesController.js:L112](file:///d:/Projects/drive-pool1/backend/src/controllers/filesController.js#L112): File names are interpolated directly into the `Content-Disposition` header without sanitization:
```js
res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
```
A filename containing `"` or newlines could inject headers. Should use RFC 5987 encoding.

---

### 14. Shared Folder Query Injection

[driveService.js:L429](file:///d:/Projects/drive-pool1/backend/src/services/driveService.js#L429):
```js
q: `'${folderId}' in parents and trashed = false`
```
The `folderId` comes from `req.params` and is injected directly into the Google Drive API query string without sanitization. A crafted `folderId` with `'` characters could manipulate the query.

---

### 15. Rate Limiter Doesn't Cover OAuth Routes

Only `/api/auth/login` has `loginLimiter`. The OAuth endpoints (`/new`, `/:accountIndex`, `/callback`) have no rate limiting. An attacker could flood the OAuth flow to create unlimited placeholder accounts.

---

### 16. No File Size Limit on Avatar Upload

[profile.js:L12](file:///d:/Projects/drive-pool1/backend/src/routes/profile.js#L12): The profile route uses `multer.memoryStorage()` with **no `limits`** config. A malicious user could upload a multi-gigabyte "avatar" and OOM the Node process. The files route has a `500 MB` limit, but the profile route has none.

---

### 17. `express-async-errors` May Mask Errors

The package monkey-patches Express routes to catch async errors. However, async generator functions (like `streamFile`) are **not** covered. If `streamFile` throws partway through writing chunks, the error handler won't catch it and the response may hang.

---

## 🛠️ Improvements

### Architecture & Backend

| # | Issue | What I'd Do |
|---|-------|-------------|
| 18 | **No input validation framework** | Add `zod` or `joi` schemas for all request bodies and params. Currently validation is ad-hoc string checks. |
| 19 | **No graceful shutdown** | Add `SIGTERM`/`SIGINT` handlers to close Mongoose connection and HTTP server. Docker sends `SIGTERM` on stop. |
| 20 | **No request timeout** | Large downloads have no timeout. A slow client can hold a connection open indefinitely. Add a `timeout` middleware. |
| 21 | **`setInterval` leak** | `startPeriodicSync` creates an interval that's never cleared. On multiple `bootstrap()` calls (e.g., in tests), intervals stack. |
| 22 | **Upload fully buffered in RAM** | The 500MB memory upload means a single upload can consume 500MB+ of heap. Consider streaming to disk (`multer.diskStorage`) and then streaming to Google Drive. |
| 23 | **No CSRF protection** | Cookies are `httpOnly` but there's no CSRF token. Any malicious page could POST to `/api/auth/login` if the user is on `localhost`. `sameSite: "lax"` mitigates POST, but only in modern browsers. |

### Frontend

| # | Issue | What I'd Do |
|---|-------|-------------|
| 24 | **No Error Boundaries** | If any dashboard component throws, the entire app crashes. Wrap each route in a React Error Boundary. |
| 25 | **No loading skeletons** | Data-dependent pages show nothing while loading, then pop in. Skeleton loaders would look much more polished. |
| 26 | **Duplicated `formatBytes` function** | Defined 7+ times across different files. Extract to a shared `utils/format.ts`. |
| 27 | **Duplicated `FileTypeIcon` component** | 3+ different implementations across files, settings, shared, and trash pages. Extract to a shared component. |
| 28 | **No accessibility (a11y)** | No `aria-label` attributes on icon-only buttons. No keyboard navigation for modals. No focus traps in modals/dialogs. The confirm dialog and profile modal can't be dismissed with Escape (only for PreviewModal). |
| 29 | **No `<title>` per page** | Every dashboard sub-page shows the same "DrivePool" title. Should use `metadata` or `document.title` for each route (e.g., "Files — DrivePool", "Analytics — DrivePool"). |
| 30 | **Stats page: Recharts SSR warnings** | `recharts` doesn't support SSR. Since these are `"use client"` components it usually works, but there may be hydration warnings. Consider dynamic importing with `ssr: false`. |
| 31 | **Drag panel linearGradient ID conflicts** | [files/page.tsx](file:///d:/Projects/drive-pool1/frontend/app/dashboard/files/page.tsx): `FolderDropPanel` uses hardcoded SVG gradient IDs (`fp-back`, `fp-front`) that will conflict if multiple instances render. Similarly `FolderIcon` uses `fg-${size}` which collides when same size renders. |
| 32 | **No `next/font` usage** | The landing page and dashboard use browser default fonts. Should use `next/font` with a modern typeface (Inter, Geist) for a more polished look. |
| 33 | **Landing page not responsive on very small screens** | The hero floating icons section doesn't wrap gracefully below ~375px. The stats bar can overflow. |

### DevOps / Config

| # | Issue | What I'd Do |
|---|-------|-------------|
| 34 | **`.env` file in backend** | There's a `.env` file (1291 bytes) in the backend directory. Since the README says "No .env needed", it may contain secrets that could accidentally be committed. Check `.gitignore` covers it. |
| 35 | **Root `docker-compose.yml` vs `backend/docker-compose.yml`** | Two docker-compose files exist. The backend one (971 bytes) is likely stale/duplicate. This could confuse users. |
| 36 | **`credentials.json` in config/** | A `credentials.json` (431 bytes) exists in the tracked config directory. Even though `.gitignore` should exclude it, it's small enough to be a placeholder — verify it doesn't contain real client secrets. |
| 37 | **Frontend Dockerfile uses `npx next start`** | Should be `node_modules/.bin/next start` or add `next` as a production dependency. Using `npx` adds unnecessary startup latency and may download a different version. |

---

## Priority Ranking

| Priority | Items |
|----------|-------|
| 🔴 **Fix Now** | #1 (README mismatch), #2 (missing thumbnail endpoint), #3 (hardcoded colors break light mode), #9 (MONGO_URI mismatch), #13 (header injection) |
| 🟡 **Fix Soon** | #4 (theme flash), #5 (type mismatch), #6 (double padding), #7 (avatar MIME), #14 (query injection), #16 (no avatar size limit), #12 (no disconnect confirm) |
| 🟢 **Improve** | #10 (parallel sync), #11 (polling bug), #15 (rate limit OAuth), #18-33 (all improvements) |
| ⚪ **Nice to have** | #34-37 (DevOps cleanup) |

---

Let me know which of these you'd like me to fix first, or if you want me to tackle everything systematically!
