import { setupAutoRail } from './auto-rail.js';

export function setupMobileDetails() {
  const mobile = matchMedia('(max-width: 599px)');
  const portrait = document.querySelector('.about-photo');
  const picture = document.createElement('picture');
  picture.className = 'mobile-picture';
  const source = document.createElement('source');
  source.media = '(max-width: 599px)';
  source.srcset = `${import.meta.env.BASE_URL}mobile/about-photo.webp`;
  portrait.before(picture);
  picture.append(source, portrait);
  const updates = [
    ['#principles-title', 'Принципы работы адвоката'],
  ].map(([selector, text]) => { const node = document.querySelector(selector); return { node, text, original: node.textContent }; });
  const paragraphs = [
    ['.card-light p', 'Строгое соблюдение адвокатской<br>тайны. Любая переданная вами<br>информация защищена на всех<br>этапах работы'],
    ['.principles .statement', 'Более 25 лет я нахожу сильные\nправовые решения. <span style="color:#5a5a5a">Для меня важно\nне только знание закона, но и умение\nуслышать. <em>Каждое дело — это судьба</em>\n\nЯ знаю, как тяжело довериться,\nи стану вашей опорой</span>'],
    ['.card-olive p', 'Не обещаю лёгких побед. После<br>изучения материалов дела<br>дам объективную оценку: где<br>шансы высоки, а где существуют<br>реальные риски'],
    ['.card-orange p', 'По ч. 3 ст. 49 УПК РФ я вступаю в дело<br>с момента задержания или допроса.<br>Даже когда дело ещё не возбуждено,<br>участие защитника законно'],
    ['.card-dark p', 'Шаблоны не работают. Более 25 лет<br>судебной практики позволяют<br>мне анализировать каждое дело<br>до мелочей и защищать вас<br>в судах и госорганах'],
    ['.about .statement', '«Я не обещаю лёгких<br>побед, но гарантирую<br>бескомпромиссное<br><em>отстаивание ваших интересов</em><br>в рамках закона»'],
    ['.biography p:first-child', 'Благодаря тому, что всю свою трудовую<br>деятельность я связала с адвокатурой, имею<br>глубокие познания в области разработки<br>тактики и стратегии для успешной защиты<br>прав и свобод граждан как в уголовном, так<br>и гражданском процессах.'],
    ['.biography p + p', 'Регулярно прохожу различные курсы повышения<br>квалификации, постоянно работаю над своим<br>профессиональным уровнем, участвую<br>в конференциях и семинарах.'],
    ['.consultation-copy > p:last-child', 'Задержание, обыск или сложный гражданский<br>спор — это всегда стресс<br><br>Оставьте заявку, и я лично свяжусь с вами, чтобы<br>разобрать обстоятельства и предложить чёткий<br>план действий'],
    ['.footer-description', 'Адвокат в Смоленске по уголовным<br>и гражданским делам. Юридическая помощь<br>физическим и юридическим лицам'],
  ].map(([selector, html]) => { const node = document.querySelector(selector); return { node, html, original: node.innerHTML }; });
  document.querySelectorAll('.urgent').forEach(node => paragraphs.push({ node, html: 'Задержание или обыск?<br>Свяжитесь со мной в любое время, даже ночью', original: node.innerHTML }));
  function update() {
    updates.forEach(({ node, text, original }) => { node.textContent = mobile.matches ? text : original; });
    paragraphs.forEach(({ node, html, original }) => { node.innerHTML = mobile.matches ? html : original; });
  }
  mobile.addEventListener('change', update);
  update();
  setupAutoRail(document.querySelector('.hero-facts'), 'Факты о практике');
  setupAutoRail(document.querySelector('.credentials'), 'Образование и опыт');
}
