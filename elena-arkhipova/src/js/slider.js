import { animate, reveal, motionStagger } from './motion.js';

import { slides } from './practice-data.js';
import { mobilePractice } from './mobile-practice.js';

export function setupSlider() {
  const section = document.querySelector('#practice');
  const panel = section.querySelector('.practice-content');
  section.querySelectorAll('.practice-content').forEach((slide, i) => { slide.hidden = i > 0; });
  const buttons = section.querySelectorAll('.slider-controls button');
  const image = panel.querySelector('img');
  const mobile = matchMedia('(max-width: 599px)');
  const heading = section.querySelector('.practice-heading');
  const picture = document.createElement('picture');
  picture.className = 'practice-picture';
  const source = document.createElement('source');
  source.media = '(max-width: 599px)';
  image.before(picture);
  picture.append(source, image);
  const announcement = document.createElement('p');
  announcement.className = 'sr-only';
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  section.append(announcement);
  section.setAttribute('aria-roledescription', 'карусель');
  panel.id = 'practice-slide';
  panel.tabIndex = 0;
  let index = 0;
  const paint = (target, slideIndex) => {
    const slide = { ...slides[slideIndex], ...(mobile.matches ? mobilePractice[slideIndex] : {}) };
    target.dataset.slide = String(slideIndex);
    target.querySelector('.slide-number').textContent = slide.label;
    target.querySelector('h3').textContent = slide.title;
    target.querySelector('.practice-description').textContent = slide.description;
    target.querySelector('.practice-list').replaceChildren(...slide.items.map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
    const targetImage = target.querySelector('img');
    targetImage.src = `${import.meta.env.BASE_URL}images/${slide.image}.webp`;
    target.querySelector('source').srcset = `${import.meta.env.BASE_URL}mobile/${slide.image}.webp`;
    targetImage.alt = slide.alt;
    targetImage.width = 221;
    targetImage.height = 294;
  };
  const render = (next, announce = true) => {
    index = (next + slides.length) % slides.length;
    const slide = slides[index];
    paint(panel, index);
    panel.setAttribute('aria-label', `${index + 1} из ${slides.length}: ${slide.title}`);
    if (announce) announcement.textContent = `Направление ${index + 1} из ${slides.length}: ${slide.title}`;
  };
  const decoded = slides.map(slide => {
    const asset = new Image();
    asset.src = `${import.meta.env.BASE_URL}${mobile.matches ? 'mobile' : 'images'}/${slide.image}.webp`;
    return asset.decode().then(() => true, () => false);
  });
  let desired = 0;
  let transitioning = false;
  const change = async delta => {
    desired = (desired + delta + slides.length) % slides.length;
    if (transitioning) return;
    transitioning = true;
    try {
      while (desired !== index) {
        const next = desired;
        if (!await decoded[next]) {
          announcement.textContent = 'Не удалось загрузить направление. Попробуйте ещё раз.';
          desired = index;
          break;
        }
        await animate(panel, [{ opacity: 1 }, { opacity: 0 }], { duration: 180, fill: 'forwards' });
        panel.getAnimations().forEach(animation => animation.cancel());
        render(next);
        const step = motionStagger();
        await Promise.all([
          reveal(panel.querySelector('.slide-number')),
          animate(image, [
            { opacity: 0, transform: 'translate3d(16px, 0, 0) scale(1.01)' },
            { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' },
          ], { duration: 520 }),
          reveal(panel.querySelector('h3'), step),
          reveal(panel.querySelector('.practice-description'), step * 2),
          ...[...panel.querySelectorAll('li')].map((item, i) => reveal(item, step * 2 + i * 40)),
        ]);
      }
    } finally { transitioning = false; }
  };
  buttons.forEach((button, i) => {
    button.disabled = false;
    button.setAttribute('aria-controls', panel.id);
    button.addEventListener('click', () => change(i ? 1 : -1));
  });
  section.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      change(event.key === 'ArrowRight' ? 1 : -1);
    }
  });
  let start;
  panel.addEventListener('pointerdown', event => {
    if (event.pointerType === 'touch') start = { x: event.clientX, y: event.clientY };
  });
  panel.addEventListener('pointerup', event => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) change(dx < 0 ? 1 : -1);
    start = undefined;
  });
  panel.addEventListener('pointercancel', () => { start = undefined; });
  render(0, false);
  // Reserve the tallest slide at the current width so following sections stay still.
  const reserveHeight = () => {
    panel.style.minHeight = '';
    // Preserve desktop geometry; reserve all variants on phones and tablets.
    if (matchMedia('(min-width: 1101px)').matches) return;
    const measure = panel.cloneNode(true);
    measure.removeAttribute('id');
    measure.removeAttribute('tabindex');
    measure.setAttribute('aria-hidden', 'true');
    Object.assign(measure.style, {
      // The no-flash sibling rule otherwise hides the measuring clone too.
      display: 'grid',
      position: 'absolute',
      visibility: 'hidden',
      pointerEvents: 'none',
      width: `${panel.getBoundingClientRect().width}px`,
      minHeight: '0',
    });
    panel.after(measure);
    let height = 0;
    for (let i = 0; i < slides.length; i++) {
      paint(measure, i);
      height = Math.max(height, measure.getBoundingClientRect().height);
    }
    measure.remove();
    panel.style.minHeight = `${Math.ceil(height)}px`;
  };
  const updateLayout = () => {
    if (mobile.matches) panel.prepend(heading);
    else section.querySelector('.container').prepend(heading);
    render(index, false);
    reserveHeight();
  };
  mobile.addEventListener('change', updateLayout);
  updateLayout();
  document.fonts.ready.then(reserveHeight);
  let width = 0;
  let frame;
  new ResizeObserver(entries => {
    const next = entries[0].contentRect.width;
    if (next === width) return;
    width = next;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(reserveHeight);
  }).observe(section);
}
