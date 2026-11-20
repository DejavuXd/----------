import { createMenuMotion } from './menu-motion.js';
import { reducedMotion } from './motion.js';

export function setupNavigation({ contactsSource = document.querySelector('.contact-details') } = {}) {
  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#navigation');
  const mobile = matchMedia('(max-width: 1100px)');
  const contacts = contactsSource.cloneNode(true);
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
  const motion = createMenuMotion(navigation, closeButton);
  let locked = false;
  let state = 'closed';
  let sequence = 0;
  let closing;
  let scrollY = 0;
  let bodyStyle = '';
  const inertTargets = [document.querySelector('main'), document.querySelector('footer'), document.querySelector('.brand'), document.querySelector('.header-phone'), document.querySelector('.skip-link')].filter(Boolean);
  const previousInert = new Map();
  function finishClose(returnFocus = false) {
    motion.cancel();
    navigation.classList.remove('is-open');
    navigation.removeAttribute('data-menu-state');
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
    state = 'closed';
    closing = undefined;
    if (returnFocus && mobile.matches) toggle.focus({ preventScroll: true });
  }
  function closeMenu(returnFocus = false, immediate = false) {
    if (!locked) return Promise.resolve();
    if (immediate) {
      sequence++;
      finishClose(returnFocus);
      return Promise.resolve();
    }
    if (closing) return closing;
    const runId = ++sequence;
    state = 'closing';
    navigation.dataset.menuState = state;
    closing = motion.close().then(() => {
      if (runId === sequence) finishClose(returnFocus);
    });
    return closing;
  }
  toggle.addEventListener('click', () => {
    if (locked) { closeMenu(true); return; }
    if (!mobile.matches) return;
    scrollY = window.scrollY;
    bodyStyle = document.body.style.cssText;
    document.body.style.cssText += `;position:fixed;top:-${scrollY}px;width:100%;overflow:hidden;`;
    inertTargets.forEach(node => { previousInert.set(node, node.inert); node.inert = true; });
    locked = true;
    const runId = ++sequence;
    state = 'opening';
    navigation.classList.add('is-open');
    navigation.scrollTop = 0;
    navigation.dataset.menuState = state;
    navigation.setAttribute('role', 'dialog');
    navigation.setAttribute('aria-modal', 'true');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Закрыть меню');
    motion.open().then(() => {
      if (runId !== sequence) return;
      state = 'open';
      navigation.dataset.menuState = state;
    });
    closeButton.focus({ preventScroll: true });
  });
  navigation.addEventListener('click', async event => {
    if (!event.target.closest('a')) return;
    const href = event.target.closest('a').getAttribute('href');
    const target = href.startsWith('#') ? document.querySelector(href) : null;
    const fromMenu = locked;
    if (fromMenu && target) event.preventDefault();
    await closeMenu();
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
      if (fromMenu) target.scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') closeMenu(true);
    if (event.key === 'Tab' && locked) {
      if (state === 'closing') { event.preventDefault(); return; }
      // Keyboard users should never tab into an item still behind the reveal.
      if (state === 'opening') motion.finish();
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
    if (!event.matches) closeMenu(false, true);
  });
}
