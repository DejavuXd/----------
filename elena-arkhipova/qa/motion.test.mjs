import test from 'node:test';
import assert from 'node:assert/strict';

let onPreferenceChange;
const preference = { matches: false, addEventListener: (_event, callback) => { onPreferenceChange = callback; } };
globalThis.matchMedia = () => preference;
const { animate, setupMotion } = await import('../src/js/motion.js');

test('reduced motion never starts an animation', async () => {
  preference.matches = true;
  let calls = 0;
  await animate({ animate: () => { calls++; } }, []);
  assert.equal(calls, 0);
  preference.matches = false;
});

test('changing preference cancels running animation without rejection', async () => {
  let reject;
  let cancelled = false;
  const animation = {
    finished: new Promise((_resolve, fail) => { reject = fail; }),
    cancel: () => { cancelled = true; reject(new Error('cancelled')); },
  };
  const completion = animate({ animate: () => animation }, []);
  onPreferenceChange({ matches: true });
  await completion;
  assert.equal(cancelled, true);
});

test('missing animation API leaves content untouched', async () => {
  await animate({}, []);
  await animate(null, []);
});

test('offscreen reveals are prepared before observation, start once, and respect cancellation', async () => {
  const animations = [];
  const makeElement = () => ({
    childNodes: [], append() {}, replaceChildren() {}, setAttribute() {}, remove() {},
    matches: () => false, querySelectorAll: () => [],
    animate() {
      let reject;
      const animation = {
        playState: 'running', currentTime: null,
        finished: new Promise((_resolve, fail) => { reject = fail; }),
        pause() { this.playState = 'paused'; },
        play() { this.playState = 'running'; },
        cancel() { this.playState = 'idle'; reject(new Error('cancelled')); },
      };
      this.animation = animation;
      animations.push(animation);
      return animation;
    },
  });
  const elements = new Map();
  const cards = Array.from({ length: 4 }, makeElement);
  let onIntersection;
  const observed = new Set();
  globalThis.IntersectionObserver = class {
    constructor(callback) { onIntersection = callback; }
    observe(element) { observed.add(element); }
    unobserve(element) { observed.delete(element); }
  };
  globalThis.window = { IntersectionObserver };
  globalThis.document = {
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, makeElement());
      return elements.get(selector);
    },
    querySelectorAll: selector => selector === '.principle-card' ? cards : [],
    createDocumentFragment: makeElement, createElement: makeElement, addEventListener() {},
  };
  setupMotion();
  assert.ok(cards.every(card => card.animation.playState === 'paused' && card.animation.currentTime === 0));
  const count = animations.length;
  setupMotion();
  assert.equal(animations.length, count, 'repeated initialization must not stack animations');
  onIntersection([{ target: cards[0], isIntersecting: true }]);
  assert.equal(cards[0].animation.playState, 'running');
  assert.equal(observed.has(cards[0]), false);
  assert.equal(cards[1].animation.playState, 'paused');
  onPreferenceChange({ matches: true });
  onIntersection([{ target: cards[1], isIntersecting: true }]);
  assert.equal(cards[1].animation.playState, 'idle', 'cancelled reveals must never restart');
  await Promise.allSettled(animations.map(animation => animation.finished));
});
