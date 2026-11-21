import { setupPhoneMask } from './phone-mask.js';

export function validateContact(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = 'обязательное поле';
  else if (values.name.trim().length < 2 || values.name.trim().length > 120 || !/^[\p{L}\p{M} .'’\-]+$/u.test(values.name.trim()) || !/\p{L}/u.test(values.name)) errors.name = 'проверьте имя';
  const digits = values.phone.replace(/\D/g, '');
  if (!values.phone.trim()) errors.phone = 'обязательное поле';
  else if (!/^7[3489]\d{9}$/.test(digits) || !/^\+?[\d ()\-]+$/.test(values.phone)) errors.phone = 'проверьте номер РФ';
  if (!values.email.trim()) errors.email = 'обязательное поле';
  else if (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'проверьте почту';
  if (!values.consent) errors.consent = 'Для отправки необходимо согласие на обработку данных.';
  return errors;
}

export function setupForm() {
  const form = document.querySelector('.contact-form');
  setupPhoneMask(form.elements.phone);
  const status = document.querySelector('#form-status');
  const button = form.querySelector('[type="submit"]');
  button.disabled = false;
  const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT?.trim();
  const legalReady = import.meta.env.VITE_CONTACT_LEGAL_READY === 'true';
  const legalUrls = [import.meta.env.VITE_PRIVACY_URL || `${import.meta.env.BASE_URL}privacy.html`, import.meta.env.VITE_CONSENT_URL || `${import.meta.env.BASE_URL}consent.html`];
  const legalLinks = [...form.querySelectorAll('[data-legal]')];
  const documentsReady = legalLinks.length === 2 && legalLinks.every((placeholder, index) => {
    try {
      if (!legalUrls[index]?.trim()) return false;
      const url = new URL(legalUrls[index], window.location.origin);
      if (url.origin !== location.origin || !['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.hash) return false;
      const link = document.createElement('a');
      link.href = url.href;
      link.textContent = placeholder.textContent;
      placeholder.replaceWith(link);
      return true;
    } catch { return false; }
  });
  const fields = ['name', 'phone', 'email', 'consent'];
  let sending = false;
  const unavailable = 'Не удалось отправить запрос.';
  function setStatus(message = '', state = '') {
    status.textContent = message;
    status.dataset.state = state;
  }
  function values() {
    return Object.fromEntries(fields.map(key => [key, key === 'consent' ? form.elements[key].checked : form.elements[key].value.trim()]));
  }
  function showError(key, message = '') {
    document.querySelector(`#${key}-error`).textContent = message;
    form.elements[key].setAttribute('aria-invalid', String(Boolean(message)));
  }
  form.addEventListener('input', event => {
    const key = event.target.name;
    if (fields.includes(key) && event.target.getAttribute('aria-invalid') === 'true') showError(key, validateContact(values())[key]);
    if (!sending) setStatus();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    const payload = values();
    const errors = validateContact(payload);
    fields.forEach(key => showError(key, errors[key]));
    if (Object.keys(errors).length) {
      form.elements[Object.keys(errors)[0]].focus();
      setStatus('Проверьте отмеченные поля.', 'error');
      return;
    }
    if (!endpoint || !legalReady || !documentsReady) { setStatus(unavailable, 'error'); return; }
    payload.website = form.elements.website.value;
    let url;
    try { url = new URL(endpoint, window.location.origin); }
    catch { setStatus(unavailable, 'error'); return; }
    if (url.origin !== window.location.origin || (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))) {
      setStatus(unavailable, 'error');
      return;
    }
    sending = true;
    button.disabled = true;
    form.setAttribute('aria-busy', 'true');
    setStatus('Отправляем запрос…', 'sending');
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error('Request not accepted');
      form.reset();
      document.dispatchEvent(new Event('elena:form-success'));
      setStatus('Почтовый сервер принял запрос. Я свяжусь с вами.', 'success');
      window.location.assign(`${import.meta.env.BASE_URL}thanks.html`);
    } catch {
      setStatus('Не удалось подтвердить отправку. Позвоните: +7 (910) 787-73-42.', 'error');
    } finally {
      sending = false;
      button.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
}
