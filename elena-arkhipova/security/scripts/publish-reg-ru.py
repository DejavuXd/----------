"""Static updates only. Use a dedicated FTPS account jailed to the site's root."""
import ftplib
import os
from pathlib import Path
import re
import ssl
import sys
import uuid


def publish():
    host, user, password = (os.environ.get(k, '') for k in
                            ('REG_RU_HOST', 'REG_RU_USER', 'REG_RU_PASSWORD'))
    if not re.fullmatch(r'[A-Za-z0-9.-]+', host) or not user or not password:
        raise ValueError('Missing connection settings')
    root = Path('dist')
    files = [(p.relative_to(root).as_posix(), p) for p in root.rglob('*') if p.is_file()]
    if not files or not (root / 'index.html').is_file():
        raise ValueError('Missing build')
    allowed_roots = {'assets', 'fonts', 'icons', 'images', 'mobile', 'technical', 'legal'}
    allowed_pages = {'index.html', '404.html', 'thanks.html', 'privacy.html',
                     'consent.html', 'robots.txt', 'sitemap.xml'}
    for name, path in files:
        parts = Path(name).parts
        if path.is_symlink() or any(p.startswith('.') for p in parts):
            raise ValueError('Unsafe build')
        if (len(parts) == 1 and name not in allowed_pages) or (len(parts) > 1 and parts[0] not in allowed_roots):
            raise ValueError('Unexpected build file')
    headers = Path('security/.generated/.htaccess')
    if not headers.is_file():
        raise ValueError('Missing headers')
    # Assets first, then CSP hashes, then HTML; retain old assets for open tabs.
    assets = [(n, p) for n, p in files if not n.endswith('.html')]
    pages = sorted([(n, p) for n, p in files if n.endswith('.html')],
                   key=lambda item: item[0] == 'index.html')
    with ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=60) as ftp:
        ftp.connect(host, 21)
        ftp.login(user, password)  # FTP_TLS negotiates TLS before credentials.
        ftp.prot_p()  # Encrypt data transfers as well as authentication.
        ftp.cwd('/')  # Dedicated account root MUST be www/arxipova.ru.
        if 'index.html' not in ftp.nlst():
            raise ValueError('Expected existing website root')
        for name, source in assets + [('.htaccess', headers)] + pages:
            parent = Path(name).parent.as_posix()
            if parent != '.':
                current = ''
                for part in parent.split('/'):
                    current += '/' + part
                    try:
                        ftp.mkd(current)
                    except ftplib.error_perm as error:
                        if not str(error).startswith('550'):
                            raise
            temporary = name + '.deploy-' + uuid.uuid4().hex
            with source.open('rb') as handle:
                ftp.storbinary('STOR ' + temporary, handle)
            ftp.rename(temporary, name)
    print('Static website uploaded. Backend and private files were not modified.')


if __name__ == '__main__':
    try:
        publish()
    except Exception:
        # Never print server responses or credential-containing exception text.
        print('Publication failed. Check FTPS/TLS, credentials, account root and write permissions.', file=sys.stderr)
        sys.exit(1)
