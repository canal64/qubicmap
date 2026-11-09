# Builds the generated files of qubicmap.org from build/map.html (the page and its data: CATS, E, TR, ADDED, ALSO).
# Run from anywhere: python3 build/build.py. It writes into the repo:
#   public/index.html, public/<lang>/index.html, public/connections.html, public/sitemap.xml, public/robots.txt,
#   lib/projects.js, lib/links.js, lib/media.js, lib/i18n.js
# Sources: build/map.html (body of the home page), build/head.html (its <head>, with {{T}} {{D}} {{LD}}),
# build/connections.tpl.html (Connections page, with __DATA__).
import json, html, re, os
B = os.path.dirname(os.path.abspath(__file__)); R = os.path.dirname(B)
def rd(p): return open(os.path.join(B, p), encoding='utf-8').read()
def wr(p, x):
    p = os.path.join(R, p); os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w', encoding='utf-8').write(x)
s = rd('map.html')
def arr(name):
    k = s.find('var %s=[' % name); e = s.find('];', k); return json.loads(s[k + len(name) + 5:e + 1])
def obj(name):
    k = s.find('var %s=' % name); return json.JSONDecoder().raw_decode(s[k + len(name) + 5:])[0] if k >= 0 else {}
CATS = arr('CATS'); E = arr('E')
# Exchanges and card on-ramps (buy, cex) are access points, not Qubic projects: kept for link checks and logos,
# listed apart on the page, but no project page, no count, no sitemap entry, no Connections node.
ACCESS = ('buy', 'cex'); EA = E; ACATS = [c for c in CATS if c[0] in ACCESS]
E = [e for e in EA if e[0] not in ACCESS]; CATS = [c for c in CATS if c[0] not in ACCESS]
esc = html.escape
def slug(n): return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', n.lower()))
LG = ['fr', 'es', 'zh', 'nl', 'ru', 'de']  # same order as the TR translations
HL = {'zh': 'zh-Hans'}
TR = obj('TR')
def t(k, i):
    v = TR.get(k); return v[i] if v and i < len(v) and v[i] else k

# crawlable list written into #list (replaced by the tiles once the script runs)
def static(i=None):
    parts = []
    for c in CATS:
        items = [e for e in E if e[0] == c[0]]
        if not items: continue
        if i is None:
            parts.append('<section><h2>%s</h2><p>%s</p><ul>' % (esc(c[1]), esc(c[2])))
            for e in items: parts.append('<li><a href="%s" rel="noopener">%s</a> — %s</li>' % (esc(e[4]), esc(e[1]), esc(e[5])))
        else:
            parts.append('<section><h2>%s</h2><p>%s</p><ul>' % (esc(t(c[1], i)), esc(t(c[2], i))))
            for e in items: parts.append('<li><a href="/%s/p/%s">%s</a> — %s</li>' % (LG[i], slug(e[1]), esc(e[1]), esc(t(e[5], i))))
        parts.append('</ul></section>')
    if i is None:
        parts.append('<section><h2>Where to get QUBIC</h2><p>Exchanges and card payment services that list QUBIC. They are not built on Qubic: they give access to the token.</p><ul>')
        for e in [x for x in EA if x[0] in ACCESS]:
            parts.append('<li><a href="%s" rel="noopener nofollow">%s</a> — %s</li>' % (esc(e[4]), esc(e[1]), esc(e[5])))
        parts.append('</ul></section>')
    return ''.join(parts)
A0 = '<div class="grid" id="list"></div>'; assert s.count(A0) == 1
URL = 'https://qubicmap.org/'
T = 'Qubic Ecosystem Map — every Qubic project, wallet, exchange and tool'
DK = '{n} projects around Qubic in one map: exchanges, DeFi, wallets, bridges, mining pools, explorers, tokens, NFTs, games and developer tools, with live network figures. Free, community-run, in English, French, German, Spanish, Dutch, Russian and Chinese.'
D = DK.replace('{n}', str(len(E)))
ld = {"@context": "https://schema.org", "@type": "WebSite", "name": "Qubic Ecosystem Map", "alternateName": "QubicMap", "url": URL, "description": D, "inLanguage": ["en", "fr", "de", "es", "nl", "ru", "zh"]}
ALT = ''.join('<link rel="alternate" hreflang="%s" href="%s">' % (HL.get(l, l), URL + ('' if l == 'en' else l + '/')) for l in ['en'] + LG) + '<link rel="alternate" hreflang="x-default" href="%s">' % URL
CANON = '<link rel="canonical" href="%s">' % URL
HEAD = rd('head.html'); assert HEAD.count(CANON) == 1
def fiximg(x): return re.sub(r"""(["'])img/""", r'\1/img/', x)

# English home page
head = HEAD.replace('{{LD}}', json.dumps(ld)).replace('{{T}}', esc(T)).replace('{{D}}', esc(D)).replace(CANON, CANON + ALT)
body = s.replace(A0, '<div class="grid" id="list">' + static() + '</div>')
out = fiximg(head + body + '</body></html>')
wr('public/index.html', out)

# language home pages: texts, title, description and lang written in the HTML; window.__LANG fixes the language
def dt(m, i):
    k = html.unescape(m.group(2)); v = t(k, i)
    if v == k or html.unescape(m.group(3)) != k: return m.group(0)
    return m.group(1) + esc(v, quote=False) + m.group(4)
def attr(m, i, a):
    k = html.unescape(m.group(1)); return '%s="%s" data-t%s="%s"' % (a, esc(t(k, i)), 't' if a == 'title' else 'a', m.group(1))
for i, l in enumerate(LG):
    T2 = t(T, i); D2 = t(DK, i).replace('{n}', str(len(E))); U2 = URL + l + '/'
    ld2 = dict(ld, description=D2, url=U2, inLanguage=HL.get(l, l))
    h2 = HEAD.replace('{{LD}}', json.dumps(ld2, ensure_ascii=False)).replace('{{T}}', esc(T2)).replace('{{D}}', esc(D2))
    h2 = h2.replace('<html lang="en">', '<html lang="%s">' % HL.get(l, l), 1)
    h2 = h2.replace(CANON, '<link rel="canonical" href="%s">' % U2 + ALT, 1).replace('<meta property="og:url" content="%s">' % URL, '<meta property="og:url" content="%s">' % U2, 1)
    h2 = h2.replace('<script>try{if(localStorage', '<script>window.__LANG="%s"</script><script>try{if(localStorage' % l, 1)
    b2 = s.replace(A0, '<div class="grid" id="list">' + static(i) + '</div>')
    b2 = re.sub(r'(data-t="([^"]+)"[^>]*>)([^<]*)(<)', lambda m: dt(m, i), b2)
    b2 = re.sub(r'title="[^"]*" data-tt="([^"]+)"', lambda m: attr(m, i, 'title'), b2)
    b2 = re.sub(r'aria-label="[^"]*" data-ta="([^"]+)"', lambda m: attr(m, i, 'aria-label'), b2)
    wr('public/%s/index.html' % l, fiximg(h2 + b2 + '</body></html>'))

# robots and sitemap
wr('public/robots.txt', 'User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: %ssitemap.xml\n' % URL)
SM = [('', '2026-10-11'), ('arcade', '2026-10-13'), ('play', '2026-10-13'), ('whack', '2026-10-13'), ('quorum', '2026-10-13'), ('breaker', '2026-10-13'),
      ('bubble', ''), ('connections', ''), ('gallery', ''), ('donate', ''), ('week', '')]
u = lambda loc, lm='': '<url><loc>%s</loc>%s</url>' % (loc, '<lastmod>%s</lastmod>' % lm if lm else '')
sm = ''.join(u(URL + p, lm) for p, lm in SM) + ''.join(u(URL + 'p/' + slug(e[1])) for e in E) + u(URL + 'legal', '2026-10-29')
sm += ''.join(u(URL + l + '/') for l in LG) + ''.join(u('%s%s/p/%s' % (URL, l, slug(e[1]))) for l in LG for e in E)
wr('public/sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + sm + '</urlset>\n')

# links checked by the server, and sites that get a preview and a logo
def hit(url, hosts):
    h = url.split('/')[2].lower(); return any(h == x or h.endswith('.' + x) for x in hosts)
SKIP = ('qubic.church', 'x.com', 'twitter.com', 'youtube.com', 'youtu.be', 'discord.gg', 'discord.com', 't.me', 'join.qubic.org')
wr('lib/links.js', '// Generated from the page data: [slug, url] of every listed site that can be checked.\nexport default ' + json.dumps([[slug(e[1]), e[4]] for e in EA if not hit(e[4], SKIP)], ensure_ascii=False) + ';\n')
# sites that only refuse our link checks (qubic.church) are still captured; social profiles never are
MSKIP = SKIP[1:]
wr('lib/media.js', '// Generated from the page data: [slug, url] of every listed site that gets a preview and a logo.\nexport default ' + json.dumps([[slug(e[1]), e[4]] for e in EA if not hit(e[4], MSKIP)], ensure_ascii=False) + ';\n')

# project pages, feed and weekly summary: the project list and the date each one joined the map
ADD = obj('ADDED'); ALSO = obj('ALSO')
P = [dict({"s": slug(e[1]), "n": e[1], "c": e[0], "sc": e[2], "st": e[3], "u": e[4], "d": e[5], "a": ADD.get(e[1], "")}, **({"al": ALSO[e[1]]} if e[1] in ALSO else {})) for e in E]
wr('lib/projects.js', '// Generated from the page data: every project, its category and the date it joined the map.\nexport const CATS = ' + json.dumps([c[:3] for c in CATS], ensure_ascii=False) + ';\n'
   + '// Exchanges and card on-ramps: no project page any more, their old addresses lead to the "Where to get QUBIC" list.\nexport const ACCESS = ' + json.dumps([slug(e[1]) for e in EA if e[0] in ACCESS], ensure_ascii=False) + ';\n'
   + 'export default ' + json.dumps(P, ensure_ascii=False) + ';\n')

# Connections page
cp = {"cats": [[c[0], c[1]] for c in CATS], "p": [{"s": x["s"], "n": x["n"], "c": x["c"], "st": x["st"], "sc": x["sc"], "d": x["d"]} for x in P]}
wr('public/connections.html', rd('connections.tpl.html').replace('__DATA__', json.dumps(cp, ensure_ascii=False).replace('</', '<\\/')))

# what the server needs for /<lang>/p/<slug>
keys = {"Live", "Testnet", "Upgrading", "Contract only", "Early stage", "Not checked", "In development", "Smart contract {n} of the Qubic core", "Open", "Copy link", "Legal notice",
        "{p} on Qubic: {c}, links & overview | QubicMap", "{p} in the Qubic ecosystem ({c}): {d}", "{n} likes on QubicMap.", "1 like on QubicMap.", "Listed on QubicMap.", "also", "{n} likes", "1 like",
        "On the map since {d}", "See it on the map", "Post on X", "Copied ✓", "{p} website", "Other projects in {c}", "All {c} on the map →", "Listed on qubicmap.org",
        "Is this your project? Add this badge to your site. It links back to this page.", "Copy badge code", "For a light background, use badge-light.svg instead of badge.svg.", "{p} on the Qubic Ecosystem Map: {d}"}
keys |= {c[1] for c in CATS + ACATS} | {c[2] for c in CATS + ACATS} | {e[5] for e in E}
disc = [k for k in TR if k.startswith('<b>Disclaimer.</b>')]; assert len(disc) == 1; keys.add(disc[0])
miss = [k for k in keys if k not in TR and k != 'RWA']
if miss: print('WARNING no translation for:', miss)
I = {k: TR[k] for k in sorted(keys) if k in TR}
wr('lib/i18n.js', '// Generated from the page translations: what the server needs to render /xx/p/<slug>.\n// LANGS: the order of each translation array. DISCLAIMER: the key of the long disclaimer.\nexport const LANGS = ' + json.dumps(LG) + ';\nexport const DISCLAIMER = ' + json.dumps(disc[0], ensure_ascii=False) + ';\nexport default ' + json.dumps(I, ensure_ascii=False) + ';\n')
print('projects', len(E), '· languages', len(LG), '· sitemap urls', sm.count('<loc>'), '· i18n keys', len(I))
