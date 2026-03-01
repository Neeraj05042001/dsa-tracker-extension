'use strict';

const APP_URL = 'http://localhost:3000';
const PROJECT_REF = 'iytjekvwtckjwziartfk';
const COOKIE_BASE = `sb-${PROJECT_REF}-auth-token`;

export async function getAuthToken() {
  const session = await getSession();
  return session?.access_token || null;
}

export async function getSession() {
  try {
    const combined = await readAllChunks();
    console.log('[DSA Auth] Raw combined length:', combined?.length);

    if (!combined) {
      console.log('[DSA Auth] No cookie found');
      return null;
    }

    return parseSession(combined);
  } catch (err) {
    console.error('[DSA Auth] getSession error:', err);
    return null;
  }
}

// ── Reads unchunked OR chunked Supabase cookies ──────────────────────────────
async function readAllChunks() {

  // 1. Try single unchunked cookie first
  const single = await getRawCookie(COOKIE_BASE);
  if (single) {
    console.log('[DSA Auth] Found single (unchunked) cookie');
    return decodeCookieValue(single);
  }

  // 2. Collect all chunks (.0, .1, .2 ...)
  const chunks = [];
  for (let i = 0; i < 10; i++) {
    const chunk = await getRawCookie(`${COOKIE_BASE}.${i}`);
    if (!chunk) break;
    console.log(`[DSA Auth] Chunk ${i} raw length:`, chunk.length);
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    console.log('[DSA Auth] No cookies found at all');
    return null;
  }

  // 3. Concatenate all chunk values as-is first
  //    chrome.cookies returns already URL-decoded values, so no decodeURIComponent needed.
  const combined = chunks.join('');
  console.log('[DSA Auth] Combined raw length:', combined.length);

  // 4. Now decode the combined value
  return decodeCookieValue(combined);
}

// ── Handles base64- prefix stripping and atob decoding ──────────────────────
function decodeCookieValue(raw) {
  try {
    let value = raw;

    // URL-decode if needed (shouldn't be necessary from chrome.cookies, but just in case)
    if (value.includes('%')) {
      try { value = decodeURIComponent(value); } catch (_) {}
    }

    // Strip the "base64-" prefix Supabase adds
    if (value.startsWith('base64-')) {
      const b64 = value.slice(7);

      // Fix base64 padding and clean invalid chars before decoding
      const cleaned = b64.replace(/\s/g, '').replace(/-/g, '+').replace(/_/g, '/');
      const padded  = cleaned + '=='.slice(0, (4 - cleaned.length % 4) % 4);

      try {
        const decoded = atob(padded);
        console.log('[DSA Auth] base64 decoded length:', decoded.length);
        return decoded;
      } catch (err) {
        console.error('[DSA Auth] atob failed, trying raw value:', err.message);
        // Fall through — maybe the cookie isn't actually base64 encoded
        return value.slice(7); // return without prefix
      }
    }

    // No prefix — already plain JSON string
    return value;

  } catch (err) {
    console.error('[DSA Auth] decodeCookieValue error:', err);
    return null;
  }
}

// ── Parses the final decoded string into a Supabase session object ───────────
function parseSession(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    console.log('[DSA Auth] Parsed type:', Array.isArray(parsed) ? 'array' : 'object');

    // Supabase stores as [session, expiry_ts] or plain session object
    const session = Array.isArray(parsed) ? parsed[0] : parsed;

    console.log('[DSA Auth] Has access_token:', !!session?.access_token);
    console.log('[DSA Auth] User email:', session?.user?.email);

    return session?.access_token ? session : null;
  } catch (err) {
    console.error('[DSA Auth] JSON.parse error:', err.message);
    console.error('[DSA Auth] First 200 chars of raw:', raw?.slice(0, 200));
    return null;
  }
}

// ── Gets a single raw cookie value by name ───────────────────────────────────
function getRawCookie(name) {
  return new Promise((resolve) => {
    chrome.cookies.get({ url: APP_URL, name }, (cookie) => {
      resolve(cookie?.value || null);
    });
  });
}