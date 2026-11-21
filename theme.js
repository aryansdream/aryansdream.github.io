(() => {
  const root = document.documentElement;
  const key = 'portfolio-theme';
  let theme = 'dark';
  try {
    if (localStorage.getItem(key) === 'light') theme = 'light';
  } catch { /* Storage is optional for viewing the portfolio. */ }

  function apply(nextTheme) {
    theme = nextTheme;
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#efede3' : '#131712');
    for (const button of document.querySelectorAll('[data-theme-option]')) {
      button.setAttribute('aria-pressed', String(button.dataset.themeOption === theme));
    }
  }

  apply(theme);
  document.addEventListener('DOMContentLoaded', () => {
    apply(theme);
    for (const button of document.querySelectorAll('[data-theme-option]')) {
      button.addEventListener('click', () => {
        apply(button.dataset.themeOption);
        try { localStorage.setItem(key, theme); } catch { /* The current page still updates. */ }
      });
    }
  });
})();
