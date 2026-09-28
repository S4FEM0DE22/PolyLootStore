const menuIcons = new Set(['home', 'catalog', 'orders', 'library', 'overview', 'assets', 'customers', 'support', 'alerts', 'settings', 'store', 'logout', 'refresh']);

export function navigationIcon(name) {
  if (!menuIcons.has(name)) return '';
  return `<svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><use href="/icons/navigation.svg#${name}"></use></svg>`;
}

// Preserve translated labels, notification badges and the existing navigation handlers.
export function applyAdminNavigationIcons(root) {
  for (const item of root.querySelectorAll('.admin-nav [data-view], .admin-nav [data-action="logout"], .admin-nav .nav-bottom a[href="/"], .admin-topbar [data-action="refresh"]')) {
    const name = item.dataset.view || item.dataset.action || 'store';
    if (!item.querySelector('.menu-icon')) item.insertAdjacentHTML('afterbegin', navigationIcon(name));
  }
}
