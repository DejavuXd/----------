const KEY = 'elena-cookie-preferences-v1';
const MAX_AGE = 180 * 24 * 60 * 60 * 1000;
export function setupCookies() {
  let choice = null;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.version === 1 && typeof saved.analytics === 'boolean' && typeof saved.functional === 'boolean' && Number.isFinite(saved.at) && Date.now() >= saved.at && Date.now() - saved.at < MAX_AGE) choice = saved;
  } catch {}
  window.elenaAnalyticsConsent = choice?.analytics === true;
  const banner = document.createElement('section');
  banner.className = 'cookie-banner';
  banner.setAttribute('aria-labelledby', 'cookie-heading');
  banner.innerHTML = `<h2 id="cookie-heading">Мы используем cookie</h2>
    <p>Сайт использует файлы cookie для корректной работы, сохранения настроек и анализа посещаемости. Вы можете разрешить использование всех cookie или оставить только необходимые.</p>
    <p>Подробнее — в <a class="cookie-policy">Политике обработки персональных данных</a>.</p>
    <fieldset class="cookie-options" hidden><legend>Настройки cookie</legend>
      <label><input type="checkbox" checked disabled> Необходимые — всегда включены</label>
      <label><input name="functional" type="checkbox"> Сохранение настроек</label>
      <label><input name="analytics" type="checkbox"> Аналитика посещаемости</label>
      <button class="button" type="button" data-choice="save">Сохранить выбор</button>
    </fieldset>
    <div class="cookie-actions"><button class="button" type="button" data-choice="all">Принять все</button><button class="button cookie-essential" type="button" data-choice="essential">Только необходимые</button><button class="button" type="button" data-choice="settings" aria-expanded="false">Настроить</button></div>`;
  banner.querySelector('.cookie-policy').href = `${import.meta.env.BASE_URL}privacy.html`;
  const options = banner.querySelector('.cookie-options');
  const configure = banner.querySelector('[data-choice="settings"]');
  let returnFocus;
  const sync = () => {
    banner.querySelector('[name="functional"]').checked = choice?.functional === true;
    banner.querySelector('[name="analytics"]').checked = choice?.analytics === true;
  };
  sync();
  banner.hidden = choice !== null;
  document.body.append(banner);
  banner.addEventListener('click', event => {
    const action = event.target.closest('[data-choice]')?.dataset.choice;
    if (!action) return;
    if (action === 'settings') {
      options.hidden = !options.hidden;
      configure.setAttribute('aria-expanded', String(!options.hidden));
      if (!options.hidden) options.querySelector('input:not(:disabled)').focus();
      return;
    }
    choice = { version: 1, at: Date.now(), functional: action === 'all' || (action === 'save' && banner.querySelector('[name="functional"]').checked), analytics: action === 'all' || (action === 'save' && banner.querySelector('[name="analytics"]').checked) };
    try { localStorage.setItem(KEY, JSON.stringify(choice)); } catch {}
    window.elenaAnalyticsConsent = choice.analytics;
    document.dispatchEvent(new CustomEvent('elena:cookie-choice', { detail: { analytics: choice.analytics, functional: choice.functional } }));
    banner.hidden = true;
    returnFocus?.focus();
  });
  document.querySelectorAll('[data-cookie-settings]').forEach(button => button.addEventListener('click', () => {
    returnFocus = button;
    sync();
    banner.hidden = false;
    options.hidden = false;
    configure.setAttribute('aria-expanded', 'true');
    configure.focus();
  }));
  window.addEventListener('storage', event => {
    if (event.key !== KEY && event.key !== null) return;
    try {
      const saved = JSON.parse(event.newValue);
      choice = saved?.version === 1 && typeof saved.analytics === 'boolean' && typeof saved.functional === 'boolean' && Number.isFinite(saved.at) && Date.now() >= saved.at && Date.now() - saved.at < MAX_AGE ? saved : null;
    } catch { choice = null; }
    window.elenaAnalyticsConsent = choice?.analytics === true;
    sync();
    banner.hidden = choice !== null;
  });
}
