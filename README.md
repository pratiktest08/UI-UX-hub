# PL India UI Research Hub — Hosting Guide

## 🚀 Deploy to Vercel (Free, 5 minutes)

### Step 1 — Upload to GitHub
1. Go to github.com → New Repository → Name: `plindia-hub`
2. Upload ALL files from this folder:
   - `api/claude.js`
   - `public/index.html`
   - `vercel.json`
   - `package.json`

### Step 2 — Connect Vercel
1. Go to vercel.com → Sign up with GitHub
2. Click "New Project" → Import `plindia-hub`
3. Click "Deploy" (no settings needed)

### Step 3 — Add API Key as Secret
1. In Vercel dashboard → Your project → Settings → Environment Variables
2. Add:
   - Name:  `ANTHROPIC_API_KEY`
   - Value: `sk-ant-your-key-here`
3. Click Save → Redeploy

### ✅ Done! Your app is live at: https://plindia-hub.vercel.app

---

## 🔧 What's Inside

### api/claude.js
- Serverless function that proxies Anthropic API calls
- Reads API key from environment (secure — never exposed to browser)
- Handles CORS automatically

### public/index.html
- Full app: Chat AI + Compare + Roadmap + Monitor
- Uses /api/claude proxy when hosted
- Falls back to direct API call locally

---

## 📱 Features

| Feature | Status |
|---------|--------|
| AI Chat — analyze any UI pattern | ✅ Working |
| Monitor Feed — track broker updates | ✅ Working |
| Compare — 2 brokers side by side | ✅ New |
| Roadmap — drag & drop kanban | ✅ New |
| Export PDF — report download | ✅ New |
| AI Scan — auto-fetch updates | ✅ Working |

---

## 💻 Run Locally (without hosting)
1. Open `public/index.html` in Chrome
2. Enter your API key in the top bar
3. Click Connect → start using

Note: Local mode calls Anthropic directly from browser.
This works but is not secure for sharing.
