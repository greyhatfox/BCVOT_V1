/**
 * SWEVOT Theme Manager
 * Handles dark ↔ light mode toggle, persists preference to localStorage,
 * and is applied on every page by adding <script src="../js/theme.js"> early in <head>.
 */

(function () {
  const STORAGE_KEY = 'swevot-theme';
  const LIGHT = 'light';
  const DARK  = 'dark';

  // Apply theme immediately (before DOM paint) to avoid flash
  const saved = localStorage.getItem(STORAGE_KEY) || DARK;
  document.documentElement.setAttribute('data-theme', saved);

  /**
   * Toggle the current theme and persist.
   * Called by the toggle button on each page.
   */
  window.toggleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === DARK ? LIGHT : DARK;
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY, next);
    syncToggleButtons();
  };

  /** Update all toggle button icons/labels on the page */
  function syncToggleButtons() {
    const isDark = document.documentElement.getAttribute('data-theme') === DARK;
    document.querySelectorAll('.theme-toggle').forEach(btn => {
      btn.setAttribute('title', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
      btn.setAttribute('aria-label', isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode');
      const icon = btn.querySelector('.theme-toggle-icon');
      if (icon) icon.textContent = isDark ? '☀️' : '🌙';
      const label = btn.querySelector('.theme-toggle-label');
      if (label) label.textContent = isDark ? 'Light' : 'Dark';
    });
  }

  // Sync once DOM is ready
  document.addEventListener('DOMContentLoaded', syncToggleButtons);
})();
