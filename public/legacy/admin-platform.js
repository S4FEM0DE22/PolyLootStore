// Display only: actual desktop navigation restrictions live in Electron's main process.
export function getAdminNavigation(userAgent = '') {
  const desktop = /\bPolyLootAdminDesktop\//.test(userAgent);
  const logo = '<img class="theme-logo-light" src="/assets/brand/polyloot.png" alt="PolyLoot"><img class="theme-logo-dark" src="/assets/brand/polyloot-dark.png" alt="PolyLoot">';
  return {
    brand: desktop
      ? `<span class="brand" aria-label="PolyLoot ระบบผู้ดูแล">${logo}</span>`
      : `<a class="brand" href="/" aria-label="PolyLoot หน้าร้าน">${logo}</a>`,
    backLink: desktop ? '' : '<a href="/">กลับหน้าร้าน</a>',
    loginBackLink: desktop ? '' : '<a href="/" class="pill-button outline">กลับหน้าร้าน</a>',
  };
}
