import { reducedMotion } from './motion.js';

// Keep menu animations separate from scroll reveals: focusing the dialog must
// not cancel the panel reveal or leave a half-open overlay behind.
export function createMenuMotion(navigation, closeButton) {
  const tracks = new Set();
  const ease = 'cubic-bezier(.22, 1, .36, 1)';
  let sequence = 0;

  function cancel() {
    sequence++;
    tracks.forEach(animation => animation.cancel());
    tracks.clear();
    navigation.classList.remove('is-animating');
  }

  function finish() {
    tracks.forEach(animation => animation.finish());
  }

  function play(element, frames, timing) {
    const animation = element.animate(frames, { easing: ease, fill: 'both', ...timing });
    // Attach the rejection handler immediately, including interrupted openings.
    animation.finished.catch(() => {});
    tracks.add(animation);
    return animation;
  }

  function run(opening) {
    // Capture the in-flight wipe before cancelling it, so Escape during opening
    // reverses smoothly from the current shape rather than flashing fully open.
    const currentClip = getComputedStyle(navigation).clipPath;
    const links = [...navigation.querySelectorAll('.navigation-links a')];
    const details = [...navigation.querySelectorAll('.navigation-contact > .urgent, .navigation-contact address > *, .navigation-contact > .footer-socials')];
    const current = new Map([...links, ...details, closeButton].map(element => {
      const style = getComputedStyle(element);
      return [element, { opacity: style.opacity, transform: style.transform }];
    }));
    cancel();
    if (reducedMotion.matches || !navigation.animate) return Promise.resolve();

    const runId = sequence;
    const button = closeButton.getBoundingClientRect();
    const x = button.left + button.width / 2;
    const y = button.top + button.height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) + 2;
    const circle = size => `circle(${size}px at ${x}px ${y}px)`;
    navigation.classList.add('is-animating');

    play(navigation, [
      { clipPath: opening ? circle(20) : currentClip === 'none' ? circle(radius) : currentClip },
      { clipPath: opening ? circle(radius) : circle(0) },
    ], { duration: opening ? 560 : 360, easing: 'cubic-bezier(.76, 0, .24, 1)' });

    links.forEach((link, i) => {
      play(link, opening ? [
        { opacity: 0, transform: 'translateY(32px)', clipPath: 'inset(100% 0 0 0)' },
        { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0 0 0 0)' },
      ] : [
        current.get(link),
        { opacity: 0, transform: 'translateY(-12px)' },
      ], { duration: opening ? 430 : 150, delay: opening ? 120 + i * 65 : (links.length - 1 - i) * 20 });
    });

    details.forEach((element, i) => {
      play(element, [
        opening ? { opacity: 0, transform: 'translateY(18px)' } : current.get(element),
        { opacity: opening ? 1 : 0, transform: opening ? 'translateY(0)' : 'translateY(-8px)' },
      ], { duration: opening ? 360 : 130, delay: opening ? 260 + i * 28 : 0 });
    });

    play(closeButton, opening ? [
      { opacity: 0, transform: 'rotate(-90deg) scale(.6)' },
      { opacity: 1, transform: 'rotate(0) scale(1)' },
    ] : [
      current.get(closeButton),
      { opacity: 0, transform: 'rotate(90deg) scale(.7)' },
    ], { duration: opening ? 450 : 210, delay: opening ? 50 : 0 });

    return Promise.all([...tracks].map(animation => animation.finished.catch(() => {}))).then(() => {
      if (runId === sequence) cancel();
    });
  }

  // A changed OS preference also finishes an already-running closing sequence.
  reducedMotion.addEventListener('change', event => { if (event.matches) finish(); });
  return { open: () => run(true), close: () => run(false), cancel, finish };
}
