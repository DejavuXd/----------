export function setupNavigation() {
  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#navigation');
  const mobile = matchMedia('(max-width: 1100px)');
  const contacts = document.querySelector('.contact-details').cloneNode(true);
  contacts.className = 'navigation-contact';
  contacts.querySelector('h2').remove();
  contacts.prepend(contacts.querySelector('.urgent'));
  contacts.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
  navigation.append(contacts);
  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'menu-close';
  closeButton.setAttribute('aria-label', 'Закрыть меню');
  navigation.prepend(closeButton);
  closeButton.addEventListener('click', () => closeMenu(true));
  let locked = false;
  let scrollY = 0;
  let bodyStyle = '';
  const inertTargets = [document.querySelector('main'), document.querySelector('footer'), document.querySelector('.brand'), document.querySelector('.header-phone'), document.querySelector('.skip-link')];
  const previousInert = new Map();
  function closeMenu(returnFocus = false) {
    navigation.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Открыть меню');
    navigation.removeAttribute('role');
    navigation.removeAttribute('aria-modal');
    if (locked) {
      document.body.style.cssText = bodyStyle;
      previousInert.forEach((value, node) => { node.inert = value; });
      previousInert.clear();
      window.scrollTo({ top: scrollY, behavior: 'instant' });
      locked = false;
    }
    if (returnFocus) toggle.focus();
  }
  toggle.addEventListener('click', () => {
    if (locked) { closeMenu(true); return; }
    if (!mobile.matches) return;
    scrollY = window.scrollY;
    bodyStyle = document.body.style.cssText;
    document.body.style.cssText += `;position:fixed;top:-${scrollY}px;width:100%;overflow:hidden;`;
    inertTargets.forEach(node => { previousInert.set(node, node.inert); node.inert = true; });
    locked = true;
    navigation.classList.add('is-open');
    navigation.setAttribute('role', 'dialog');
    navigation.setAttribute('aria-modal', 'true');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Закрыть меню');
    navigation.querySelector('a').focus({ preventScroll: true });
  });
  navigation.addEventListener('click', event => {
    if (!event.target.closest('a')) return;
    const href = event.target.closest('a').getAttribute('href');
    const target = href.startsWith('#') ? document.querySelector(href) : null;
    closeMenu();
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu(true);
    if (event.key === 'Tab' && locked) {
      const focusable = [closeButton, ...navigation.querySelectorAll('a[href]')];
      const current = focusable.indexOf(document.activeElement);
      if ((event.shiftKey && current <= 0) || (!event.shiftKey && current === focusable.length - 1)) {
        event.preventDefault();
        focusable[event.shiftKey ? focusable.length - 1 : 0].focus();
      }
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.header')) closeMenu();
  });
  mobile.addEventListener('change', event => {
    if (!event.matches) closeMenu();
  });
}
