// Phase boundaries from the reference, in milliseconds.
export const INTRO_TIMING = {
  name: 120, nameEnd: 450, line: 350, lineEnd: 700,
  caption: 550, captionEnd: 820, expand: 950,
  nameOut: 1110, captionOut: 1090, open: 1190, end: 1590,
  lineFade: 1190, lineOut: 1270, remove: 1590, nav: 1290, navEnd: 1680,
  overline: 1270, title: 1320, description: 1410, button: 1480, contentDuration: 430,
};
const out = x => 1 - (1 - x) ** 3;
const inOut = x => x < .5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
const range = (time, start, end) => Math.max(0, Math.min(1, (time - start) / (end - start)));

// Sample exact reference curves into compositor keyframes, including boundaries.
function frames(duration, draw) {
  const times = new Set([0, duration, ...Object.values(INTRO_TIMING).filter(t => t <= duration)]);
  for (let time = 0; time < duration; time += 1000 / 120) times.add(time);
  return [...times].sort((a, b) => a - b).map(time => ({ offset: time / duration, ...draw(time) }));
}

export function setupPreloader() {
  const state = window.goldenIntro;
  if (!state || state.started || !state.overlay.isConnected) return;
  state.started = true;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (reduced.matches || !state.overlay.animate) { state.finish(); return; }
  document.querySelector('.site')?.setAttribute('inert', '');
  const animations = [];
  const t = INTRO_TIMING;
  const run = (element, duration, draw) => {
    if (!element) return;
    const animation = element.animate(frames(duration, draw), { duration, easing: 'linear', fill: 'both' });
    animations.push(animation);
    return animation;
  };
  const finish = () => {
    animations.forEach(animation => animation.cancel());
    clearTimeout(state.watchdog);
    state.finish();
    reduced.removeEventListener('change', finish);
    removeEventListener('pagehide', finish);
  };
  reduced.addEventListener('change', finish);
  addEventListener('pagehide', finish, { once: true });
  clearTimeout(state.watchdog);
  state.watchdog = setTimeout(finish, 2500);
  try {
    const q = selector => state.overlay.querySelector(selector);
    run(q('.golden-name'), t.remove, time => {
      const enter = out(range(time, t.name, t.nameEnd));
      return { opacity: enter * (1 - range(time, t.expand, t.nameOut)), transform: `translateY(${(1 - enter) * 8}px)`, filter: `blur(${(1 - enter) * 3}px)` };
    });
    run(q('.golden-caption'), t.remove, time => ({ opacity: out(range(time, t.caption, t.captionEnd)) * (1 - range(time, t.expand, t.captionOut)) }));
    const width = state.overlay.clientWidth;
    const shortScale = Math.min(width * .4, 260) / width;
    run(q('.golden-line'), t.remove, time => {
      const expand = inOut(range(time, t.expand, t.open));
      const initial = shortScale * out(range(time, t.line, t.lineEnd));
      return {
        transform: `translateY(${9 * (1 - expand)}dvh) scaleX(${initial + (1 - initial) * expand})`,
        opacity: 1 - range(time, t.lineFade, t.lineOut),
      };
    });
    const top = run(q('.golden-top'), t.remove, time => ({ transform: `translateY(${-101 * inOut(range(time, t.open, t.end))}%)` }));
    run(q('.golden-bottom'), t.remove, time => ({ transform: `translateY(${101 * inOut(range(time, t.open, t.end))}%)` }));
    top.finished.then(() => state.finish()).catch(() => {});
    // Real site content only; the portrait remains visible and loads normally.
    const content = [
      ['.header', t.nav, t.navEnd, 10],
      ['.hero .eyebrow', t.overline, t.overline + t.contentDuration, 20],
      ['.hero h1', t.title, t.title + t.contentDuration, 20],
      ['.hero-description', t.description, t.description + t.contentDuration, 20],
      ['.hero-copy .button', t.button, t.button + t.contentDuration, 20],
    ];
    content.forEach(([selector, start, end, distance]) => run(document.querySelector(selector), end, time => {
      const progress = out(range(time, start, end));
      return { opacity: progress, transform: `translateY(${(1 - progress) * distance}px)` };
    }));
    const startTime = document.timeline.currentTime;
    animations.forEach(animation => { animation.startTime = startTime; });
    Promise.all(animations.map(animation => animation.finished.catch(() => {}))).then(finish);
  } catch { finish(); }
}
