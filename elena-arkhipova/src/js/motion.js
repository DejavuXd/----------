export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const active = new Set();
let preparation;
let initialized = false;
const ease = 'cubic-bezier(0.22, 1, 0.36, 1)';
export const motionDistance = () => matchMedia('(max-width: 800px)').matches ? 12 : 20;
export const motionStagger = () => matchMedia('(max-width: 800px)').matches ? 70 : 110;

export function animate(element, frames, options = {}) {
  if (!element || reducedMotion.matches || !element.animate) return Promise.resolve();
  const animation = element.animate(frames, { duration: 650, easing: ease, fill: 'backwards', ...options });
  if (preparation) {
    animation.pause();
    animation.currentTime = 0;
    preparation.push(animation);
  }
  active.add(animation);
  return animation.finished.catch(() => {}).finally(() => active.delete(animation));
}

reducedMotion.addEventListener('change', event => {
  if (event.matches) {
    active.forEach(animation => animation.cancel());
    active.clear();
  }
});

export function reveal(element, delay = 0, options = {}) {
  return animate(element, [
    { opacity: 0, transform: `translateY(${motionDistance()}px)` },
    { opacity: 1, transform: 'translateY(0)' },
  ], { delay, ...options });
}

export function revealImage(element, direction = 'vertical', delay = 0, options = {}) {
  const inset = direction === 'horizontal' ? 'inset(0 100% 0 0)' : 'inset(100% 0 0 0)';
  return animate(element, [{ clipPath: inset }, { clipPath: 'inset(0 0 0 0)' }], { duration: 900, delay, ...options });
}

function lines(element) {
  const fragment = document.createDocumentFragment();
  let line = document.createElement('span');
  line.className = 'motion-line';
  for (const node of [...element.childNodes]) {
    if (node.nodeName === 'BR') {
      fragment.append(line, node);
      line = document.createElement('span');
      line.className = 'motion-line';
    } else line.append(node);
  }
  fragment.append(line);
  element.replaceChildren(fragment);
  return [...element.querySelectorAll(':scope > .motion-line')];
}

function revealLines(element, delay = 0) {
  if (element.matches('blockquote') && matchMedia('(max-width: 480px)').matches) {
    return reveal(element, delay);
  }
  element.querySelectorAll(':scope > .motion-line').forEach((line, i) => {
    animate(line, [
      { clipPath: 'inset(100% 0 0 0)', transform: 'translateY(12px)' },
      { clipPath: 'inset(0 0 0 0)', transform: 'translateY(0)' },
    ], { duration: 900, delay: delay + i * motionStagger() });
  });
}

export function setupMotion() {
  if (initialized || !('IntersectionObserver' in window) || reducedMotion.matches) return;
  initialized = true;
  const heroTitle = document.querySelector('.hero h1');
  const quote = document.querySelector('.about blockquote');
  lines(quote);
  // Prepare paused animations BEFORE observation, so visible cards never flash
  // from their final state back to opacity: 0. No hidden CSS / no-JS dependency.
  const groups = new WeakMap();
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      groups.get(entry.target)?.forEach(animation => {
        // Cancelled animations (reduced motion / keyboard focus) must not restart.
        if (animation.playState === 'paused') animation.play();
      });
      groups.delete(entry.target);
    });
  }, { threshold: 0, rootMargin: '0px 0px 96px 0px' });
  const watch = (element, callback) => {
    if (!element) return;
    const animations = [];
    preparation = animations;
    try { callback(); }
    catch { animations.forEach(animation => animation.cancel()); }
    finally { preparation = undefined; }
    groups.set(element, animations);
    observer.observe(element);
  };
  // Start only when the hero is on screen (including restored scroll positions).
  watch(document.querySelector('.hero'), () => {
    animate(document.querySelector('.hero .eyebrow'), [{ opacity: .35 }, { opacity: 1 }], { duration: 450 });
    reveal(heroTitle, 80, { duration: 900 });
    revealImage(document.querySelector('.hero-photo'), 'vertical', 180, { duration: 1100 });
    reveal(document.querySelector('.hero-description'), 420, { duration: 850 });
    reveal(document.querySelector('.hero-copy .button'), 600, { duration: 850 });
  });
  watch(document.querySelector('.principles .statement'), () => reveal(document.querySelector('.principles .statement'), 0, { duration: 900 }));
  document.querySelectorAll('.principle-card').forEach((card, i) => watch(card, () => reveal(card, (i % 2) * 100, { duration: 950 })));
  const transition = document.querySelector('.photo-transition');
  watch(transition, () => {
    // Transform two flat covers instead of repeatedly clipping/scaling a large photo.
    ['left', 'right'].forEach((side, i) => {
      const mask = document.createElement('span');
      mask.className = `photo-mask photo-mask--${side}`;
      mask.setAttribute('aria-hidden', 'true');
      transition.append(mask);
      animate(mask, [{ transform: 'translateX(0)' }, { transform: `translateX(${i ? 100 : -100}%)` }], { duration: 1250, fill: 'both' }).finally(() => mask.remove());
    });
  });
  watch(quote, () => revealLines(quote));
  const portrait = document.querySelector('.about-photo');
  watch(portrait, () => revealImage(portrait, 'vertical', 0, { duration: 1100 }));
  document.querySelectorAll('.biography p').forEach((p, i) => watch(p, () => reveal(p, i * 100, { duration: 850 })));
  document.querySelectorAll('.footer-main > *').forEach((group, i) => watch(group, () => reveal(group, i * 100, { duration: 900 })));
  // Keyboard navigation should never land on an invisible element mid-reveal.
  document.addEventListener('focusin', event => {
    active.forEach(animation => {
      const target = animation.effect?.target;
      if (target?.contains(event.target)) animation.cancel();
    });
  });
}
