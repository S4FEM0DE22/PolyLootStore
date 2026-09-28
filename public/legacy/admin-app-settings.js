import { getDisplayPreferences, saveDisplayPreferences, translateCommon } from './settings-ui.js';
import { navigationIcon } from './navigation-icons.js';

// Device-local appearance only. No admin API, account data or server mutation.
export function mountAdminAppSettings(container) {
  const panel = document.createElement('details');
  panel.className = 'login-card admin-app-settings';
  panel.innerHTML = `<summary>${navigationIcon('settings')}<span>ตั้งค่าแอป</span></summary>
    <p class="muted">ปรับการแสดงผลได้ก่อนเข้าสู่ระบบ บันทึกเฉพาะในเครื่องนี้</p>
    <label for="guest-admin-theme">ธีมการแสดงผล</label>
    <select class="field" id="guest-admin-theme"><option value="system">ตามอุปกรณ์</option><option value="light">สว่าง</option><option value="dark">มืด</option></select>
    <label for="guest-admin-language">ภาษา</label>
    <select class="field" id="guest-admin-language"><option value="th" data-no-translate>ไทย</option><option value="en" data-no-translate>English</option></select>
    <p class="muted">ข้อมูลร้านและการแจ้งเตือนต้องเข้าสู่ระบบก่อน</p>
    <div class="app-settings-result" role="status" aria-live="polite"></div>`;
  container.append(panel);
  const preferences = getDisplayPreferences();
  const theme = panel.querySelector('#guest-admin-theme');
  const language = panel.querySelector('#guest-admin-language');
  theme.value = preferences.theme;
  language.value = preferences.language;
  const update = patch => {
    saveDisplayPreferences(patch);
    panel.querySelector('.app-settings-result').textContent = 'บันทึกการตั้งค่าแล้ว';
    // Translate existing DOM rather than re-rendering the login/password form.
    translateCommon(document);
  };
  theme.addEventListener('change', () => update({ theme: theme.value }));
  language.addEventListener('change', () => update({ language: language.value }));
  translateCommon(document);
}
