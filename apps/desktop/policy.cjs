const { URL } = require('node:url');

function validateAppUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Set POLYLOOT_APP_URL or apps/config.json appUrl to your HTTPS website origin.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('App URL must be an HTTPS origin without credentials, path, query or fragment.');
  }
  return url.origin;
}
function isAdminUrl(value, origin) {
  try {
    const url = new URL(value);
    return !url.username && !url.password && url.origin === origin && (url.pathname === '/admin' || url.pathname.startsWith('/admin/'));
  } catch { return false; }
}
function isExternalUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; }
  catch { return false; }
}
function canOpenInBrowser(value, origin) {
  if (!isExternalUrl(value)) return false;
  return new URL(value).origin !== origin || isAdminUrl(value, origin);
}
module.exports = { validateAppUrl, isAdminUrl, isExternalUrl, canOpenInBrowser };
