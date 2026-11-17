import { reducedMotion } from './motion.js';

// A native scroll rail with matching content on both sides of the real items.
// Recentring after a transition is invisible and never reverses the direction.
export function setupAutoRail(rail, label) {
  const mobile = matchMedia('(max-width: 599px)');
  const items = [...rail.children];
  const originalTabIndex = rail.getAttribute('tabindex');
  const originalLabel = rail.getAttribute('aria-label');
  const clones = [];
  let enabled = false;
  let visible = false;
  let pointer = false;
  let hover = false;
  let focused = false;
  let active = 1;
  let timer;
  let settle;
  let frame;
  let layoutFrame;
  let width = 0;

  const center = item => rail.scrollLeft + item.getBoundingClientRect().left - rail.getBoundingClientRect().left + item.offsetWidth / 2 - rail.clientWidth / 2;
  const step = () => center(items[1]) - center(items[0]);
  const canRun = () => enabled && visible && !document.hidden && !reducedMotion.matches && !pointer && !hover && !focused;
  function stop() {
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    frame = undefined;
    rail.classList.remove('is-rail-moving');
  }
  function jump(left) {
    const moving = rail.classList.contains('is-rail-moving');
    rail.classList.add('is-rail-moving');
    rail.scrollTo({ left, behavior: 'instant' });
    if (!moving) rail.classList.remove('is-rail-moving');
  }
  function normalize() {
    if (!enabled) return;
    const distance = step();
    if (!distance) return;
    const first = center(items[0]);
    const period = distance * items.length;
    let left = rail.scrollLeft;
    while (left < first - distance / 2) left += period;
    while (left >= first + period - distance / 2) left -= period;
    if (Math.abs(left - rail.scrollLeft) > 1) jump(left);
    active = ((Math.round((left - first) / distance) % items.length) + items.length) % items.length;
  }
  function schedule() {
    clearTimeout(timer);
    if (!canRun()) return;
    timer = setTimeout(() => {
      // A modal menu can temporarily make the page inert without hiding it.
      if (rail.closest('[inert]')) { schedule(); return; }
      advance(1);
    }, 5000);
  }
  function advance(direction) {
    stop();
    clearTimeout(settle);
    normalize();
    const from = rail.scrollLeft;
    const target = center(items[0]) + (active + direction) * step();
    if (reducedMotion.matches) { jump(target); normalize(); return; }
    rail.classList.add('is-rail-moving');
    const started = performance.now();
    const tick = now => {
      const progress = Math.min((now - started) / 850, 1);
      const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      rail.scrollLeft = from + (target - from) * eased;
      if (progress < 1) frame = requestAnimationFrame(tick);
      else {
        frame = undefined;
        normalize();
        rail.classList.remove('is-rail-moving');
        schedule();
      }
    };
    frame = requestAnimationFrame(tick);
  }
  function refresh() {
    if (!enabled) return;
    stop();
    jump(center(items[active]));
    schedule();
  }
  function configure() {
    if (mobile.matches === enabled) return;
    stop();
    clearTimeout(settle);
    enabled = mobile.matches;
    if (enabled) {
      const copy = item => {
        const clone = item.cloneNode(true);
        clone.dataset.railClone = '';
        clone.setAttribute('aria-hidden', 'true');
        clone.inert = true;
        clone.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
        clone.removeAttribute('id');
        clones.push(clone);
        return clone;
      };
      const leading = items.map(copy);
      const trailing = items.map(copy);
      rail.prepend(...leading);
      rail.append(...trailing);
      rail.setAttribute('tabindex', '0');
      rail.setAttribute('aria-label', label);
      active = 1;
      refresh();
    } else {
      clones.splice(0).forEach(clone => clone.remove());
      for (const [name, value] of [['tabindex', originalTabIndex], ['aria-label', originalLabel]]) {
        if (value === null) rail.removeAttribute(name);
        else rail.setAttribute(name, value);
      }
      rail.scrollLeft = 0;
    }
  }

  rail.addEventListener('scroll', () => {
    if (!enabled || frame !== undefined) return;
    clearTimeout(timer);
    clearTimeout(settle);
    settle = setTimeout(() => { normalize(); schedule(); }, 150);
  }, { passive: true });
  rail.addEventListener('pointerdown', () => { if (enabled) { pointer = true; stop(); } }, { passive: true });
  for (const event of ['pointerup', 'pointercancel']) document.addEventListener(event, () => {
    if (!pointer) return;
    pointer = false;
    schedule();
  }, { passive: true });
  rail.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') { hover = true; stop(); } });
  rail.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') { hover = false; schedule(); } });
  rail.addEventListener('wheel', () => { if (enabled) { stop(); schedule(); } }, { passive: true });
  rail.addEventListener('focusin', () => { focused = true; stop(); });
  rail.addEventListener('focusout', event => { if (!rail.contains(event.relatedTarget)) { focused = false; schedule(); } });
  rail.addEventListener('keydown', event => {
    if (!enabled || event.target !== rail || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    advance(event.key === 'ArrowRight' ? 1 : -1);
  });
  document.addEventListener('visibilitychange', () => { stop(); schedule(); });
  reducedMotion.addEventListener('change', () => { stop(); normalize(); if (enabled) jump(center(items[active])); schedule(); });
  mobile.addEventListener('change', configure);
  new IntersectionObserver(entries => {
    visible = entries[0].intersectionRatio >= .25;
    stop();
    schedule();
  }, { threshold: .25 }).observe(rail);
  new ResizeObserver(entries => {
    if (entries[0].contentRect.width === width) return;
    width = entries[0].contentRect.width;
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(refresh);
  }).observe(rail);
  configure();
  document.fonts.ready.then(refresh);
}
