import json,html,datetime
s=open('/home/claude/qubic-defi-map.html').read()
def arr(name):
    k=s.find('var %s=['%name); e=s.find('];',k); return json.loads(s[k+len(name)+5:e+1])
CATS=arr('CATS'); E=arr('E')
esc=html.escape
parts=[]
for c in CATS:
    items=[e for e in E if e[0]==c[0]]
    if not items: continue
    parts.append('<section><h2>%s</h2><p>%s</p><ul>'%(esc(c[1]),esc(c[2])))
    for e in items:
        parts.append('<li><a href="%s" rel="noopener">%s</a> — %s</li>'%(esc(e[4]),esc(e[1]),esc(e[5])))
    parts.append('</ul></section>')
static=''.join(parts)
a='<div class="grid" id="list"></div>'; assert s.count(a)==1
body=s.replace(a,'<div class="grid" id="list">'+static+'</div>')
URL='https://qubicmap.org/'
T='Qubic Ecosystem Map — every Qubic project, wallet, exchange and tool'
D='%d projects around Qubic in one map: exchanges, DeFi, wallets, bridges, mining pools, explorers, tokens, NFTs, games and developer tools, with live network figures. Free, community-run, in English, French, German, Spanish, Dutch, Russian and Chinese.'%len(E)
ld={"@context":"https://schema.org","@type":"WebSite","name":"Qubic Ecosystem Map","alternateName":"QubicMap","url":URL,"description":D,"inLanguage":["en","fr","de","es","nl","ru","zh"]}
head=('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
 '<title>%s</title><meta name="description" content="%s"><link rel="canonical" href="%s">'
 '<meta property="og:type" content="website"><meta property="og:site_name" content="Qubic Ecosystem Map"><meta property="og:title" content="%s"><meta property="og:description" content="%s"><meta property="og:url" content="%s"><meta property="og:image" content="%scover.jpg"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="675">'
 '<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="%s"><meta name="twitter:description" content="%s"><meta name="twitter:image" content="%scover.jpg">'
 '<meta name="theme-color" content="#04070c"><script type="application/ld+json">%s</script>'
 '<style>body{margin:0}[hidden]{display:none!important}</style></head><body>')%(esc(T),esc(D),URL,esc(T),esc(D),URL,URL,esc(T),esc(D),URL,json.dumps(ld))
out=head+body+'</body></html>'
for p in ['/home/claude/index.html','/home/claude/qubic-map/public/index.html']: open(p,'w').write(out)
open('/home/claude/qubic-map/public/robots.txt','w').write('User-agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: %ssitemap.xml\n'%URL)
open('/home/claude/qubic-map/public/sitemap.xml','w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>%s</loc><lastmod>%s</lastmod></url><url><loc>%sarcade</loc><lastmod>2026-10-13</lastmod></url><url><loc>%splay</loc><lastmod>2026-10-13</lastmod></url><url><loc>%swhack</loc><lastmod>2026-10-13</lastmod></url><url><loc>%squorum</loc><lastmod>2026-10-13</lastmod></url><url><loc>%sbreaker</loc><lastmod>2026-10-13</lastmod></url></urlset>\n'%(URL,datetime.date(2026,10,11).isoformat(),URL,URL,URL,URL,URL))
print(len(out),len(E))

import re as _re, os as _os
def _slug(n): return _re.sub(r'^-|-$','',_re.sub(r'[^a-z0-9]+','-',n.lower()))
_SKIP=('qubic.church','x.com','twitter.com','youtube.com','youtu.be','discord.gg','discord.com','t.me','join.qubic.org')
_L=[[_slug(e[1]),e[4]] for e in E if not any(h in e[4].split('/')[2] for h in _SKIP)]
_os.makedirs('/home/claude/qubic-map/lib',exist_ok=True)
open('/home/claude/qubic-map/lib/links.js','w').write('// Generated from the page data: [slug, url] of every listed site that can be checked.\nexport default '+json.dumps(_L,ensure_ascii=False)+';\n')
print('links',len(_L))
