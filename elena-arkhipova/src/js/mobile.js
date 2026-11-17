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
    ['.card-light p', 'Строгое соблюдение адвокатской тайны. Любая переданная вами информация и ваши интересы защищены на всех этапах работы'],
    ['.card-dark p', 'Шаблоны не работают. Более 25 лет судебной практики позволяют мне анализировать каждое дело до мелочей и защищать вас в судах и госорганах'],
  ].map(([selector, text]) => { const node = document.querySelector(selector); return { node, text, original: node.textContent }; });
  const paragraphs = [
    ['.principles .statement', 'Более 25 лет я нахожу сильные правовые решения. <span style="color:#5a5a5a">Для меня важно не только знание закона, но и умение услышать. <em>Каждое дело — это судьба</em>\n\nЯ знаю, как тяжело довериться, и стану вашей опорой</span>'],
    ['.about .statement', '«Я не обещаю лёгких<br>побед, но гарантирую<br>бескомпромиссное<br><em>отстаивание ваших интересов</em><br>в рамках закона»'],
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
