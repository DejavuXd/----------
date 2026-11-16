import { animate, reveal, motionStagger } from './motion.js';

const slides = [
  {
    title: 'Уголовно-правовая защита', image: 'practice-criminal', alt: 'Наручники на столе у окна',
    label: '01 // Защита по уголовным делам — от доследственной проверки до суда',
    description: 'Самое страшное — ждать. Ошибки, совершенные на этапе проверки, когда вы еще даже не подозреваемый, часто становятся главными доказательствами в суде. Я включаюсь в дело на любой стадии, но оптимально — с самого начала.',
    items: ['Участие в доследственной проверке', 'Защита в ходе предварительного следствия', 'Полный цикл защиты в суде', 'Обжалование приговоров и судебных актов', 'Помощь при УДО и замене наказания', 'Представительство свидетеля или потерпевшего', 'Категории дел: должностные, экономические, коррупционные, против личности, против собственности, ятрогенные'],
  },
  {
    title: 'Гражданско-правовая практика', image: 'practice-civil', alt: 'Весы правосудия, книги и документы',
    label: '02 // Семейные, наследственные, жилищные и другие гражданские споры',
    description: 'От семейных конфликтов до жестких корпоративных войн. Беру на себя сложные споры любой категории и защищаю ваши интересы в судах',
    items: ['Семейные споры\n(раздел имущества, долгов, дети, алименты)', 'Наследственные споры\n(вступление, оспаривание завещания)', 'Медицинские споры (врачебные ошибки, экспертизы)', 'Жилищные споры (право собственности, выселение)', 'Административные дела (лишение прав, штрафы)', 'Споры с банками и маркетплейсами', 'Интеллектуальное право и трудовые споры', 'Споры в области военного права'],
  },
  {
    title: 'Помощь бизнесу', image: 'practice-business', alt: 'Ноутбук и глобус на столе в кабинете',
    label: '03 // Юридическое сопровождение компаний и разрешение деловых споров',
    description: 'Комплексное юридическое сопровождение и представление интересов компаний в государственных органах и судах',
    items: ['Оспаривание административных штрафов', 'Споры с государственными органами', 'Составление претензий и исков', 'Представительство в арбитражных\nсудах и судах общей юрисдикции', 'Споры из договорных отношений', 'Полное юридическое сопровождение предприятий'],
  },
  {
    title: 'Консультации и документы', image: 'practice-documents', alt: 'Папки с документами и письменные принадлежности',
    label: '04 // Правовой анализ ситуации и подготовка юридических документов',
    description: 'Разберу вашу ситуацию, дам объективную оценку перспектив и помогу подготовить любые необходимые документы',
    items: ['Консультации физическим и\nюридическим лицам (в том числе онлайн)', 'Составление претензий и исковых заявлений', 'Составление договоров', 'Проверка имеющихся документов\nна соответствие законодательству'],
  },
];

export function setupSlider() {
  const section = document.querySelector('#practice');
  const panel = section.querySelector('.practice-content');
  const buttons = section.querySelectorAll('.slider-controls button');
  const image = panel.querySelector('img');
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
    const slide = slides[slideIndex];
    target.querySelector('.slide-number').textContent = slide.label;
    target.querySelector('h3').textContent = slide.title;
    target.querySelector('.practice-description').textContent = slide.description;
    target.querySelector('.practice-list').replaceChildren(...slide.items.map(text => {
      const item = document.createElement('li');
      item.textContent = text;
      return item;
    }));
    const targetImage = target.querySelector('img');
    targetImage.src = `/images/${slide.image}.webp`;
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
    asset.src = `/images/${slide.image}.webp`;
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
    const measure = panel.cloneNode(true);
    measure.removeAttribute('id');
    measure.removeAttribute('tabindex');
    measure.setAttribute('aria-hidden', 'true');
    Object.assign(measure.style, {
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
