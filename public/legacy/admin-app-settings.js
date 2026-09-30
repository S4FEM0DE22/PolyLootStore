import { getDisplayPreferences, saveDisplayPreferences, translateCommon } from './settings-ui.js';

const globeIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>';
const sunIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
const moonIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

// Quick language and theme toggle icon buttons placed at the top-right of the admin app.
export function mountAdminAppSettings(container) {
  if (!container) return;
  container.querySelector('.admin-quick-settings')?.remove();

  const wrap = document.createElement('div');
  wrap.className = 'admin-quick-settings';
  wrap.setAttribute('aria-label', 'ตั้งค่าภาษาและธีม');

  const langBtn = document.createElement('button');
  langBtn.type = 'button';
  langBtn.className = 'admin-quick-btn';
  langBtn.id = 'admin-lang-toggle';

  const themeBtn = document.createElement('button');
  themeBtn.type = 'button';
  themeBtn.className = 'admin-quick-btn';
  themeBtn.id = 'admin-theme-toggle';

  wrap.append(langBtn, themeBtn);
  container.append(wrap);

  function syncState() {
    const prefs = getDisplayPreferences();
    const isDark = document.documentElement.dataset.theme === 'dark' || prefs.theme === 'dark';
    const isEn = prefs.language === 'en';

    langBtn.innerHTML = `${globeIcon}<span class="admin-quick-tag" data-no-translate>${isEn ? 'EN' : 'TH'}</span>`;
    langBtn.setAttribute('aria-label', isEn ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ');
    langBtn.title = isEn ? 'Switch language (EN -> TH)' : 'เปลี่ยนภาษา (TH -> EN)';

    themeBtn.innerHTML = isDark ? sunIcon : moonIcon;
    themeBtn.setAttribute('aria-label', isDark ? 'เปลี่ยนเป็นธีมสว่าง' : 'เปลี่ยนเป็นธีมมืด');
    themeBtn.title = isDark ? 'เปลี่ยนเป็นธีมสว่าง' : 'เปลี่ยนเป็นธีมมืด';
  }

  langBtn.addEventListener('click', () => {
    const prefs = getDisplayPreferences();
    const nextLang = prefs.language === 'en' ? 'th' : 'en';
    saveDisplayPreferences({ language: nextLang });
    syncState();
    translateCommon(document);
  });

  themeBtn.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    const nextTheme = isDark ? 'light' : 'dark';
    saveDisplayPreferences({ theme: nextTheme });
    syncState();
  });

  syncState();
}
