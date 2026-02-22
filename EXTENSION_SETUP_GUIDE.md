# DSA Tracker Chrome Extension - Complete Setup Guide

## Overview

A modern, production-ready Chrome extension that automatically detects when you solve problems on LeetCode or Codeforces and lets you log them to your DSA Tracker app with a single click.

**Features:**
- ✅ Auto-detects solved problems (LeetCode & Codeforces)
- ✅ Pre-fills problem details automatically
- ✅ Modern, impressive UI/UX design
- ✅ Dark mode support
- ✅ Smooth animations and transitions
- ✅ Form validation and error handling
- ✅ Glassmorphism design inspired by modern SaaS products
- ✅ Complete logging and debugging

---

## File Structure

```
dsa-tracker-extension/
├── manifest.json          ← Extension configuration
├── popup.html             ← Popup UI (HTML)
├── popup.js               ← Popup logic (JavaScript)
├── styles.css             ← Styling (Modern design system)
├── contentScript.js       ← Problem detection script
├── background.js          ← Service worker
└── icons/
    ├── icon16.png        (16x16 PNG)
    └── icon128.png       (128x128 PNG)
```

---

## Step 1: Create Extension Folder

```bash
# Create a new folder for the extension
mkdir dsa-tracker-extension
cd dsa-tracker-extension
```

---

## Step 2: Create All Files

You have **6 main files** to create. For each file:

1. Create the file with the exact name
2. Copy the code from the corresponding file
3. Save it in your extension folder

### Files to Create:

#### 1. `manifest.json`
- **Copy from:** manifest.json provided
- **Action:** Create file and paste code exactly as shown

#### 2. `popup.html`
- **Copy from:** popup.html provided
- **Action:** Create file and paste code exactly as shown

#### 3. `styles.css`
- **Copy from:** styles.css provided
- **Action:** Create file and paste code exactly as shown

#### 4. `popup.js`
- **Copy from:** popup.js provided
- **Action:** Create file and paste code exactly as shown

#### 5. `contentScript.js`
- **Copy from:** contentScript.js provided
- **Action:** Create file and paste code exactly as shown

#### 6. `background.js`
- **Copy from:** background.js provided
- **Action:** Create file and paste code exactly as shown

---

## Step 3: Create Icons

You need **2 icons** for the extension:

- `icons/icon16.png` (16x16 pixels)
- `icons/icon128.png` (128x128 pixels)

### Quick Icon Creation:

**Option 1: Use Text as Icon** (Easiest for now)
1. Use an online PNG generator
2. Create simple text-based icons with the diamond symbol: `◇`
3. Save as 16x16 and 128x128

**Option 2: Design Your Own**
1. Use Figma, Canva, or similar
2. Create a modern icon matching the color scheme (Indigo #6366f1)
3. Export as PNG

**Option 3: Download from web**
- Search "modern DSA icon" on flaticon.com or icons8.com
- Download 16x16 and 128x128 versions

For now, you can use placeholder icons - the extension will still work!

---

## Step 4: Create Folder Structure in VS Code

After creating your extension folder:

1. Open the folder in VS Code
2. Create `icons` folder inside
3. Add `icon16.png` and `icon128.png` inside icons folder

Your folder structure should look like:

```
dsa-tracker-extension/
├── manifest.json
├── popup.html
├── popup.js
├── styles.css
├── contentScript.js
├── background.js
└── icons/
    ├── icon16.png
    └── icon128.png
```

---

## Step 5: Load Extension in Chrome

1. **Open Chrome**
2. **Go to:** `chrome://extensions/`
3. **Enable:** "Developer mode" (toggle in top right)
4. **Click:** "Load unpacked"
5. **Select:** Your `dsa-tracker-extension` folder
6. **Done!** Extension is installed ✅

You should see the DSA Tracker extension in your extensions list!

---

## Step 6: Verify Installation

1. **Look at your Chrome extensions icon** (puzzle piece, top right)
2. **Find "DSA Tracker"**
3. **Pin it** for easy access
4. **Click it** to see the popup

---

## Step 7: Test the Extension

### Test on LeetCode:

1. Go to `leetcode.com`
2. Open any problem
3. Submit a solution
4. Wait for "Accepted"
5. Extension should popup automatically ✅

### Test on Codeforces:

1. Go to `codeforces.com`
2. Open any problem
3. Submit a solution
4. Wait for "Accepted"
5. Extension should popup automatically ✅

### If popup doesn't appear automatically:

1. Click the extension icon manually
2. It should open with pre-filled problem details
3. You can manually fill remaining fields
4. Click "Add Problem" to submit

---

## Step 8: Configure Backend API

The extension sends data to your Next.js app. Make sure:

1. **Your DSA Tracker app is running:**
   ```bash
   npm run dev
   ```

2. **App is running on:** `http://localhost:3000`

3. **API route exists:** `/api/problems/from-extension`

4. **You are logged in:** 
   - Open `http://localhost:3000` in another tab
   - Login to your DSA Tracker
   - Then test the extension

---

## Troubleshooting

### Extension doesn't auto-popup?

**Check console:**
1. Open Codeforces problem
2. Press `F12` (Developer Tools)
3. Go to Console tab
4. Look for messages starting with `[DSA Tracker]`
5. Check if solve is detected

**Manual test:**
1. Type in console: `window.DSATrackerTrigger()`
2. Press Enter
3. Does popup appear?

### Form doesn't pre-fill?

1. Check console for errors
2. Make sure problem page has proper HTML structure
3. Fill form manually (still works!)

### Data not saving to backend?

1. **Is your app running?** `npm run dev`
2. **Are you logged in?** Check `/api/problems` works in your app
3. **Check console** for error messages
4. **Check backend logs** for API errors

### Icon not showing?

- Just use placeholder for now
- Extension still works without icons!
- Create proper icons later

---

## Modern Design Features

This extension uses cutting-edge design practices:

### Design System:
- **Color Palette:** Indigo primary, semantic colors for states
- **Typography:** System fonts for maximum compatibility
- **Spacing:** Consistent 8px base unit
- **Shadows:** Subtle glassmorphism effect
- **Animations:** Smooth 150-300ms transitions
- **Dark Mode:** Automatic detection and support

### UI Components:
- **Header:** Modern gradient with floating logo
- **Form:** Clean input design with focus states
- **States:** Loading spinner, error, success animations
- **Buttons:** Gradient buttons with hover effects
- **Inputs:** Focus rings with gradient backgrounds

### Inspiration:
- Figma (minimalist, clean)
- Linear (modern, smooth)
- Raycast (efficient, keyboard-friendly)
- GitHub (professional, refined)

---

## Developer Console Debugging

**Available logging:**

The extension logs everything to the browser console. Open DevTools (F12) and filter for `[DSA Tracker]`:

```
[DSA Tracker] Content script loaded on: https://...
[DSA Tracker] ✅ SOLVE DETECTED! Showing popup...
[DSA Tracker] Problem data extracted: {...}
[DSA Tracker Popup] Popup script loaded
[DSA Tracker Popup] Submitting problem: {...}
```

---

## Project Timeline

**Phase Completed:**
- ✅ Phase 1: Supabase Database Setup
- ✅ Phase 2: Next.js Authentication
- ✅ Phase 3: Problem Management
- ✅ Phase 4: Chrome Extension (Complete!)

**Next Phases:**
- Phase 5: Analytics Dashboard
- Phase 6: Deployment to Vercel
- Phase 7: Publish Extension to Chrome Web Store

---

## Support & Updates

### If Extension Updates:
1. Go to `chrome://extensions/`
2. Find DSA Tracker
3. Click "Reload" button
4. Changes apply immediately

### Common Updates Needed:
- When you change your Next.js API
- When you add new fields to problems
- When backend URL changes

---

## File Checklist

Before loading in Chrome, verify all files exist:

- [ ] `manifest.json` - ✅
- [ ] `popup.html` - ✅
- [ ] `popup.js` - ✅
- [ ] `styles.css` - ✅
- [ ] `contentScript.js` - ✅
- [ ] `background.js` - ✅
- [ ] `icons/icon16.png` - ✅ (or placeholder)
- [ ] `icons/icon128.png` - ✅ (or placeholder)

---

## You're All Set! 🚀

Your DSA Tracker Chrome Extension is ready to use!

### Quick Start:
1. ✅ Create folder
2. ✅ Add all files
3. ✅ Load in Chrome (`chrome://extensions/`)
4. ✅ Pin extension
5. ✅ Test on LeetCode/Codeforces
6. ✅ Solve problems and log them!

**Happy coding! 💻**
