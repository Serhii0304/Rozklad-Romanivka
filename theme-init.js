/* Adapted from saadeghi/theme-change, src/core.js (MIT, Pouya Saadeghi).
 * See THIRD_PARTY_NOTICES.md. Storage errors do not prevent theme switching. */
(() => {
  const key = 'romanivka.theme';
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  let saved = null;
  try { saved = localStorage.getItem(key); } catch {}
  if (!['light', 'dark'].includes(saved)) saved = null;
  let explicit = !!saved;
  function applyTheme(theme, persist = true) {
    if (!['light', 'dark'].includes(theme)) return;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    if (persist) {
      explicit = true;
      try { localStorage.setItem(key, theme); } catch {}
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0c1428' : '#f2f5fd');
    document.querySelectorAll('[data-set-theme]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.setTheme === theme));
    });
    document.dispatchEvent(new CustomEvent('themechange', { detail: theme }));
  }
  applyTheme(saved || (system.matches ? 'dark' : 'light'), false);
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(root.dataset.theme, false);
    document.querySelectorAll('[data-set-theme]').forEach(button => {
      button.addEventListener('click', () => applyTheme(button.dataset.setTheme));
    });
  });
  system.addEventListener('change', event => { if (!explicit) applyTheme(event.matches ? 'dark' : 'light', false); });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    explicit = ['light', 'dark'].includes(event.newValue);
    applyTheme(explicit ? event.newValue : system.matches ? 'dark' : 'light', false);
  });
})();