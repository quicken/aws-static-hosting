import { describe, it, expect } from 'vitest';
import { isApiPath, isNormalisedPath, isPageRequest, isPublicPath, resolveAppShell, safeReturnPath, stripApiPrefix } from '../src/lib/routing.js';

describe('isNormalisedPath', () => {
  it('accepts ordinary paths, including dots inside names', () => {
    for (const path of ['/', '/billing', '/billing/invoices/7', '/billing/app.js', '/docs/v1.2/guide', '/.well-known/x', '/a%20b']) {
      expect(isNormalisedPath(path)).toBe(true);
    }
  });

  it('rejects anything CloudFront would normalise into a different path', () => {
    for (const path of ['//billing', '/docs//x', '/docs/../billing', '/docs/..', '/./billing', '/docs/.', '/docs\\..\\billing', '/docs/%2e%2e/billing', '/docs/%2E%2E/billing', '/docs%2fbilling', '/docs%5c..', 'billing']) {
      expect(isNormalisedPath(path)).toBe(false);
    }
  });
});

describe('resolveAppShell', () => {
  it('maps the root to the shell index.html (Trailhead at the root)', () => {
    expect(resolveAppShell('/', '')).toBe('/index.html');
  });

  it('maps an app folder and its deep links to the app index.html', () => {
    expect(resolveAppShell('/customers', '')).toBe('/customers/index.html');
    expect(resolveAppShell('/customers/', '')).toBe('/customers/index.html');
    expect(resolveAppShell('/customers/42/orders', '')).toBe('/customers/index.html');
  });

  it('leaves real assets alone', () => {
    expect(resolveAppShell('/customers/app.js', '')).toBe('/customers/app.js');
    expect(resolveAppShell('/shell.json', '')).toBe('/shell.json');
    expect(resolveAppShell('/customers/about.html', '')).toBe('/customers/about.html');
  });

  it('applies beneath an app base path and ignores paths outside it', () => {
    expect(resolveAppShell('/apps', '/apps')).toBe('/apps/index.html');
    expect(resolveAppShell('/apps/crm/deals/7', '/apps')).toBe('/apps/crm/index.html');
    expect(resolveAppShell('/docs/intro', '/apps')).toBe('/docs/intro');
    expect(resolveAppShell('/appsfoo/x', '/apps')).toBe('/appsfoo/x');
  });
});

describe('isPublicPath', () => {
  it('matches whole path segments only', () => {
    expect(isPublicPath('/public', ['/public'])).toBe(true);
    expect(isPublicPath('/public/landing', ['/public'])).toBe(true);
    expect(isPublicPath('/publications/secret', ['/public'])).toBe(false);
  });

  it('can open up a Trailhead shell and one app while other apps stay behind the login', () => {
    const publicPaths = ['/', '/index.html', '/shell.js', '/shell.css', '/shell.json', '/webawesome', '/docs'];
    for (const path of ['/', '/index.html', '/shell.json', '/webawesome/components/button.js', '/docs/getting-started']) {
      expect(isPublicPath(path, publicPaths)).toBe(true);
    }
    for (const path of ['/billing', '/billing/invoices/7', '/billing/app.js', '/docsx', '//billing']) {
      expect(isPublicPath(path, publicPaths)).toBe(false);
    }
  });

  it('treats a public "/" as the root only', () => {
    expect(isPublicPath('/', ['/'])).toBe(true);
    expect(isPublicPath('/billing', ['/'])).toBe(false);
    expect(isPublicPath('//billing', ['/'])).toBe(false);
  });

  it('always allows favicon.ico and robots.txt', () => {
    expect(isPublicPath('/favicon.ico', [])).toBe(true);
    expect(isPublicPath('/robots.txt', [])).toBe(true);
  });
});

describe('API paths', () => {
  it('matches the prefix on segment boundaries and can be disabled', () => {
    expect(isApiPath('/api/orders', '/api')).toBe(true);
    expect(isApiPath('/apiary', '/api')).toBe(false);
    expect(isApiPath('/api/orders', '')).toBe(false);
  });

  it('strips the prefix', () => {
    expect(stripApiPrefix('/api/orders/5', '/api')).toBe('/orders/5');
    expect(stripApiPrefix('/api', '/api')).toBe('/');
  });
});

describe('isPageRequest', () => {
  it('treats extensionless paths and .html as pages', () => {
    expect(isPageRequest('/customers/42')).toBe(true);
    expect(isPageRequest('/index.html')).toBe(true);
    expect(isPageRequest('/customers/app.js')).toBe(false);
  });
});

describe('safeReturnPath', () => {
  it('keeps same-site paths including the query string', () => {
    expect(safeReturnPath('/customers/42?tab=orders')).toBe('/customers/42?tab=orders');
  });

  it('rejects anything that could leave the site', () => {
    for (const candidate of ['//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', '/ok\r\nSet-Cookie: x', '', null, undefined]) {
      expect(safeReturnPath(candidate)).toBe('/');
    }
  });
});
