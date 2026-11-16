// The approved consent UI must set this flag. No counter is installed here.
export function setupAnalytics() {
  const counter = import.meta.env.VITE_METRIKA_ID;
  function goal(name) {
    if (window.elenaAnalyticsConsent !== true || !/^\d+$/.test(counter || '') || typeof window.ym !== 'function') return;
    window.ym(Number(counter), 'reachGoal', name);
  }
  document.addEventListener('elena:form-success', () => goal('form_success'));
  document.addEventListener('click', event => {
    const link = event.target.closest?.('a');
    if (!link) return;
    if (link.protocol === 'tel:') goal('phone_click');
    else if (link.protocol === 'mailto:') goal('email_click');
    else if (link.dataset.analytics === 'messenger') goal('messenger_click');
    else if (link.dataset.analytics === 'map') goal('map_click');
  });
}
