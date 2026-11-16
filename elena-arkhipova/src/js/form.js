export function validateContact(values) {
  const errors = {};
  if (!values.name.trim()) errors.name = 'обязательное поле';
  else if (values.name.trim().length < 2) errors.name = 'проверьте имя';
  const digits = values.phone.replace(/\D/g, '');
  if (!values.phone.trim()) errors.phone = 'обязательное поле';
  else if (digits.length < 10 || digits.length > 15 || !/^[+\d\s()\-]+$/.test(values.phone)) errors.phone = 'проверьте номер';
  if (!values.email.trim()) errors.email = 'обязательное поле';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = 'проверьте почту';
  if (!values.consent) errors.consent = 'Для отправки необходимо согласие на обработку данных.';
  return errors;
}

export function setupForm() {
  const form = document.querySelector('.contact-form');
  const status = document.querySelector('#form-status');
  const button = form.querySelector('[type="submit"]');
  button.disabled = false;
  const endpoint = import.meta.env.VITE_CONTACT_ENDPOINT?.trim();
  const legalReady = import.meta.env.VITE_CONTACT_LEGAL_READY === 'true';
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
    if (!endpoint || !legalReady) { setStatus(unavailable, 'error'); return; }
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
        signal: AbortSignal.timeout(15000),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error('Request not accepted');
      form.reset();
      document.dispatchEvent(new Event('elena:form-success'));
      setStatus('Ваш запрос отправлен. Я свяжусь с вами.', 'success');
    } catch {
      setStatus('Не удалось подтвердить отправку. Позвоните: +7 (910) 787-73-42.', 'error');
    } finally {
      sending = false;
      button.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
}
