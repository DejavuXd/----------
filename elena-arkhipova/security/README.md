# Безопасность и обработка заявок

Эта папка — **исходники и инструкции, не публичная директория**. Не загружать её целиком на сайт. Домена/хостинга/реальных SMTP-настроек сейчас нет. GitHub Pages остаётся статическим, форма там закрыта до настройки действующего backend и документов.

## Состав

| Файл | Назначение / размещение |
|---|---|
| `SECURITY-AUDIT.md` | Локальный аудит, результаты и ограничения |
| `DEPLOY-REG-RU.md` | Пошаговое будущее развёртывание |
| `php/contact.php` | Единственный публичный PHP-вход; вручную в `api/contact.php` после покупки хостинга |
| `php/App.php` | Валидация, атомарные квоты, PHPMailer; только вне document root |
| `config/smtp.example.php` | Безопасный выключенный пример; настоящую копию `config.php` создавать вне Git/document root |
| `composer.json`, `composer.lock` | PHPMailer и требования PHP; `vendor` устанавливается отдельно, остаётся приватным |
| `server/.htaccess.example` | Шаблон Apache; требует генерации CSP и проверки реального сервера |
| `scripts/check-public.mjs` | Проверка границы публичной сборки; вызывается Vite после каждой сборки |
| `scripts/prepare-apache.mjs` | CSP-хеши именно финальной сборки → игнорируемая `.generated/.htaccess` |
| `tests/` | Только локальные синтетические тесты; никогда не публиковать |

## Архитектура

Браузер → POST JSON на том же origin → публичный `contact.php` → приватные `App.php`, конфигурация и PHPMailer → SMTP с обязательным TLS. В Git нет SMTP-учётных данных. PHP не входит в JS-бандл и не копируется в `dist`.

Контракт: `{name, phone, email, consent: true, website: ""}`. С 20.11.2026 по требованию заказчика все три контактных поля обязательны. Имя 2–120 символов, телефон до 30 знаков/10–15 цифр; email до 254 байт; honeypot обязателен и пустой; лишние поля запрещены. Максимум JSON — 4096 байт, UTF-8. Только `application/json` (допускается `charset=utf-8`), только POST. Отсутствующий/чужой Origin отвергается; это дополнительный фильтр, не доказательство доверия.

Квоты SQLite в приватной директории: 5 попыток/IP в минуту, 20/час; общий предел 100 попыток/10 минут. Отдельно до 3 попыток SMTP/IP в час и 50 суммарно в сутки. IPv6 объединяется по /64. Окна фиксированные: на границе возможен двойной короткий всплеск. Счётчики всех соответствующих окон проверяются/изменяются одной `BEGIN IMMEDIATE` транзакцией. Отказы SMTP также расходуют квоту. Блокировка/ошибка базы → 503, без обхода лимитов. IP берётся исключительно из `REMOTE_ADDR`, `X-Forwarded-For` не доверяется. Нужна проверка реального IP у REG.RU.

Хранятся только HMAC(IP/подсети), идентификаторы окон, счётчики и время истечения. Это не архив заявок; значения заявки нигде не сохраняются. Истёкшие строки удаляются при следующем запросе. При остановке трафика администратор может удалить базу вне активных запросов; не включать её в бэкапы. HMAC-псевдонимы и инфраструктурные журналы всё равно учитывать при согласовании обработки данных.

`{ok:true}` возвращается только после успешного `PHPMailer::send()` и принятия сообщения SMTP-сервером. Это **не гарантия появления письма во входящих**. При таймауте результат может быть неопределённым; автоматического повторения нет. В письме обычный текст, фиксированные From/To/Subject, пользовательские значения не становятся заголовками. Debug выключен.

## Локальные проверки

Для PHP нужен актуальный PHP 8.4+ с `mbstring`, `openssl`, `PDO`/`pdo_sqlite`, стандартными `ctype`, `filter`, `hash`, `json`; Composer 2. Установить приватные зависимости:

```sh
composer install --working-dir=security --no-dev --prefer-dist --no-plugins --no-scripts
composer audit --working-dir=security
php security/tests/contact-test.php
node security/tests/parallel-quota.mjs /absolute/path/to/php /absolute/path/to/php/extensions
node security/tests/http-test.mjs /absolute/path/to/php /absolute/path/to/php/extensions
npm audit
npm run build
node security/scripts/check-public.mjs dist
node security/tests/client-security.mjs
node security/scripts/audit-source.mjs
node qa/seo-check.mjs
node security/scripts/prepare-apache.mjs dist
```

`parallel-quota.mjs` и `http-test.mjs` запускают PHP с `-n`; каталог расширений передаётся явно. Для Linux расширения должны быть в указанном каталоге и доступны как `pdo_sqlite`, `mbstring`, `openssl` либо встроены. HTTP-тест использует только loopback:8099; SMTP намеренно направлен в закрытый loopback:465. Не запускать при наличии собственного SMTP-сервиса на этом порту. Файлы тестов и синтетическая конфигурация создаются в игнорируемой `.runtime/`. Удалять её можно после завершения тестовых процессов.

Браузерный тест требует отдельно доступный Playwright и Edge/Chromium. Он использует обычный `dist` и отдельную тестовую сборку `.runtime/client-build`. Для последней задать **только в тестовом процессе** `VITE_CONTACT_ENDPOINT=/api/contact.php`, `VITE_CONTACT_LEGAL_READY=true`, `VITE_PRIVACY_URL=/legal/privacy-test.html`, `VITE_CONSENT_URL=/legal/consent-test.html`, выполнить `npm run build -- --outDir security/.runtime/client-build`. Не публиковать тестовую сборку. Затем:

```sh
node security/tests/browser-check.mjs /absolute/path/to/node_modules /absolute/path/to/browser
```

Тест подставляет ответы API в браузере; реальной доставки нет. Проверяет 18 сочетаний страниц/ширин, CSP, прелоудер, меню, gate документов, необязательный email, XSS и переход после успеха. Скриншоты/результаты только в `.runtime/`. Переносимые инструменты `.tools/` локальные, игнорируются Git, в развёртывание не входят.
