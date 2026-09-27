# SheryMeet SDK - Production Guide

> **Note:** Commands marked with `(root)` run from project root `/sherymeet/`.  
> Commands marked with `(sdk)` run from `/sherymeet/packages/shery-meet-sdk/`.

---

## Pre-Deployment Checklist

### 1. Update Version

```bash
# (sdk) - Run from packages/shery-meet-sdk/
cd packages/shery-meet-sdk

# Patch release (1.0.0 → 1.0.1)
npm version patch

# Minor release (1.0.0 → 1.1.0)
npm version minor

# Major release (1.0.0 → 2.0.0)
npm version major
```

### 2. Update Base URL

In `packages/shery-meet-sdk/src/shery-meet.ts`, ensure the default URL is correct (line ~81):

```typescript
return typeof window !== "undefined" ? window.location.origin : "https://sherymeet.pugly.in"; // ← Your production domain
```

### 3. Build the SDK

```bash
# (root) - Recommended: Run from project root
npm run build:sdk

# OR (sdk) - Run from SDK directory
cd packages/shery-meet-sdk
npm install
npm run build
```

### 4. Build Everything for Production

```bash
# (root) - Builds SDK + Next.js app
npm run build
```

---

## Publishing to npm

### 1. Navigate to SDK Directory

```bash
# (root)
cd packages/shery-meet-sdk
```

### 2. Login to npm

```bash
# (sdk)
npm login
```

### 3. Publish

```bash
# (sdk) - First time (public package)
npm publish --access public

# (sdk) - Subsequent releases
npm publish
```

### 4. Go Back to Root

```bash
# (sdk)
cd ../..
```

---

## Complete Release Workflow

```bash
# Start from project root
cd /path/to/sherymeet

# 1. Navigate to SDK
cd packages/shery-meet-sdk

# 2. Install dependencies (if needed)
npm install

# 3. Update version
npm version patch -m "Release %s"

# 4. Build SDK
npm run build

# 5. Go back to root
cd ../..

# 6. Copy built SDK to public (or use build:sdk)
npm run build:sdk

# 7. Build full app
npm run build:next

# 8. Commit everything
git add -A
git commit -m "chore: release SDK v1.0.1"

# 9. Publish SDK to npm
cd packages/shery-meet-sdk
npm publish
cd ../..

# 10. Push to git
git push origin main --tags

# 11. Deploy to your hosting (Vercel, etc.)
```

---

## Available npm Scripts

### From Project Root (`/sherymeet/`)

| Command              | Description                         |
| -------------------- | ----------------------------------- |
| `npm run build:sdk`  | Build SDK and copy to `public/sdk/` |
| `npm run build`      | Build SDK + Next.js app             |
| `npm run build:next` | Build only Next.js (skip SDK)       |
| `npm run dev`        | Start dev server                    |

### From SDK Directory (`/sherymeet/packages/shery-meet-sdk/`)

| Command             | Description                |
| ------------------- | -------------------------- |
| `npm run build`     | Build SDK (ESM, CJS, IIFE) |
| `npm run dev`       | Watch mode for development |
| `npm run typecheck` | Run TypeScript type check  |
| `npm run clean`     | Remove dist folder         |

---

## Directory Structure

```
sherymeet/                          # Project root
├── package.json                    # Root package.json
├── public/
│   └── sdk/
│       └── shery-meet.js          # Built SDK (served at /sdk/shery-meet.js)
└── packages/
    └── shery-meet-sdk/            # SDK package
        ├── package.json           # SDK package.json
        ├── src/
        │   ├── index.ts
        │   ├── types.ts
        │   └── shery-meet.ts
        └── dist/                  # Built files (git-ignored)
            ├── index.js           # ESM
            ├── index.cjs          # CommonJS
            └── index.global.js    # Browser IIFE
```

---

## CDN Access (After Publishing)

```html
<!-- unpkg -->
<script src="https://unpkg.com/sherymeet-sdk@1.0.0/dist/index.global.js"></script>

<!-- jsdelivr -->
<script src="https://cdn.jsdelivr.net/npm/sherymeet-sdk@1.0.0/dist/index.global.js"></script>

<!-- Your own server -->
<script src="https://sherymeet.pugly.in/sdk/shery-meet.js"></script>
```

---

## Environment Variables

### Main App (.env in project root)

```env
NEXT_PUBLIC_LIVEKIT_URL=wss://your-livekit-server.com
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
NEXT_PUBLIC_APP_URL=https://sherymeet.pugly.in
```

---

## Security Checklist

- [ ] Tokens generated server-side only
- [ ] CORS configured if SDK hosted separately
- [ ] CSP headers allow your domain for embedders
- [ ] No secrets in client-side code

---

## Troubleshooting

### SDK not loading

```javascript
// Check if SDK loaded
console.log(window.SheryMeet); // Should exist
console.log(SheryMeet.VERSION); // Should print version
```

### Debug mode

```javascript
const meet = new SheryMeet({
  container: "#meeting",
  debug: true, // Logs all postMessage traffic
});
```

### Build errors

```bash
# (sdk) Clean and rebuild
cd packages/shery-meet-sdk
npm run clean
npm install
npm run build
```
