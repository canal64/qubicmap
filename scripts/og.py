# Share images for each project page (public/og/<slug>.png), 1200x630.
# Left: category, name, status, description. Right: the project's site preview (shots/<slug>.jpg,
# downloaded from qubicmap.org/m/s/ by the og-images workflow); bars motif when there is no preview.
# Usage: python3 scripts/og.py [shots_dir]
import json, re, colorsys, hashlib, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
F = os.path.join(ROOT, 'scripts', 'og-fonts')
OUT = os.path.join(ROOT, 'public')
SHOTS = sys.argv[1] if len(sys.argv) > 1 else None
s = open(os.path.join(OUT, 'index.html'), encoding='utf-8').read()
def arr(name):
    k = s.find('var %s=[' % name); e = s.find('];', k); return json.loads(s[k + len(name) + 5:e + 1])
E, CATS = arr('E'), arr('CATS')
E = [e for e in E if e[0] not in ('buy', 'cex')]  # exchanges and card on-ramps have no project page
LOOK = {k: int(v) for k, v in re.findall(r'(\w+):\[(\d+),\d+\]', re.search(r'var LOOK=\{[^}]*\}', s).group(0))}
ST = dict(re.findall(r'(\w+):"([^"]+)"', re.search(r'var ST=\{[^}]*\}', s).group(0)))
NOSHOT = set(re.findall(r'"([a-z0-9-]+)":1', re.search(r'var NOSHOT=\{[^}]*\}', s).group(0)))
CL = {c[0]: c[1] for c in CATS}
slug = lambda n: re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', n.lower()))
def hsl(h, sat, l):
    r, g, b = colorsys.hls_to_rgb(h / 360, l / 100, sat / 100); return (int(r * 255), int(g * 255), int(b * 255))
D = lambda n, sz: ImageFont.truetype(os.path.join(F, n), sz)
VOID, INK, MUTED, RULE = (4, 7, 12), (223, 233, 243), (127, 147, 168), (24, 36, 52)

def wrap(d, text, font, width, lines):
    out, cur = [], ''
    for w in text.split():
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) <= width: cur = t
        else:
            out.append(cur); cur = w
            if len(out) == lines: break
    if len(out) < lines and cur: out.append(cur)
    if len(out) == lines and ' '.join(out) != text:
        while d.textlength(out[-1] + '…', font=font) > width: out[-1] = out[-1][:-1]
        out[-1] = out[-1].rstrip(' ,.;:') + '…'
    return out

def shot(k):
    if not SHOTS or k in NOSHOT: return None
    p = os.path.join(SHOTS, k + '.jpg')
    try:
        im = Image.open(p).convert('RGB')
        return im if im.width >= 200 and im.height >= 200 else None
    except Exception:
        return None

# preview panel: a browser window on the right
PX, PY, PW, PH, R = 790, 52, 360, 508, 14
def panel(im, sh, acc):
    bar = 30
    glow = Image.new('L', im.size, 0); ImageDraw.Draw(glow).rounded_rectangle([PX - 4, PY - 4, PX + PW + 4, PY + PH + 4], R + 4, fill=110)
    glow = glow.filter(ImageFilter.GaussianBlur(18))
    im.paste(Image.new('RGB', im.size, tuple(int(c * .55) for c in acc)), (0, 0), glow)
    win = Image.new('RGB', (PW, PH), (10, 16, 25)); d = ImageDraw.Draw(win)
    for i, c in enumerate([(240, 138, 114), (241, 187, 92), (98, 214, 160)]): d.ellipse([14 + i * 18, 10, 24 + i * 18, 20], fill=c)
    d.rounded_rectangle([76, 7, PW - 14, 23], 8, fill=(20, 30, 44))
    view = sh.resize((PW, round(sh.height * PW / sh.width)), Image.LANCZOS).crop((0, 0, PW, PH - bar))
    win.paste(view, (0, bar))
    mask = Image.new('L', (PW, PH), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, PW - 1, PH - 1], R, fill=255)
    im.paste(win, (PX, PY), mask)
    ImageDraw.Draw(im).rounded_rectangle([PX, PY, PX + PW - 1, PY + PH - 1], R, outline=tuple(int(c * .8) for c in acc), width=2)

os.makedirs(OUT + '/og', exist_ok=True)
n_shot = 0
for e in E:
    cat, name, sc, st, url, desc = e
    k = slug(name); h = LOOK.get(cat, 190); acc = hsl(h, 70, 62)
    im = Image.new('RGB', (1200, 630), VOID); d = ImageDraw.Draw(im)
    for x in range(0, 1200, 60): d.line([(x, 0), (x, 630)], fill=(12, 19, 29))
    for y in range(0, 630, 60): d.line([(0, y), (1200, y)], fill=(12, 19, 29))
    sh = shot(k)
    if sh:
        panel(im, sh, acc); n_shot += 1; d = ImageDraw.Draw(im)
    else:  # bars motif, seeded by the name (same idea as the tile sigils)
        seed = hashlib.sha256(name.encode()).digest()
        for i in range(9):
            bh = 120 + seed[i] % 300; x = 820 + i * 38
            d.rounded_rectangle([x, 560 - bh, x + 26, 560], 4, fill=hsl(h, 55, 22 + (seed[i + 9] % 30)))
    d.rectangle([0, 0, 1200, 8], fill=acc)
    d.text((70, 70), CL.get(cat, cat).upper(), font=D('plex500.ttf', 26), fill=acc)
    sz = 104
    while d.textlength(name, font=D('chakra700.ttf', sz)) > 680 and sz > 52: sz -= 4
    d.text((66, 112), name, font=D('chakra700.ttf', sz), fill=INK)
    y = 112 + sz + 34
    tag = ST.get(st, st).upper() + ('   ·   SC %02d' % sc if sc else '')
    dot = (98, 214, 160) if st == 'live' else (241, 187, 92) if st in ('test', 'early', 'dev', 'hold') else MUTED
    d.ellipse([70, y + 9, 84, y + 23], fill=dot); d.text((96, y), tag, font=D('plex500.ttf', 26), fill=MUTED)
    y += 64
    for ln in wrap(d, desc, D('plex400.ttf', 30), 670, 3):
        d.text((70, y), ln, font=D('plex400.ttf', 30), fill=(180, 195, 210)); y += 44
    d.line([(70, 548), (740, 548)], fill=RULE, width=2)
    d.text((70, 566), 'QUBIC ECOSYSTEM MAP', font=D('chakra700.ttf', 28), fill=INK)
    d.text((420, 570), 'qubicmap.org/p/' + k, font=D('plex400.ttf', 24), fill=MUTED)
    im.save(OUT + '/og/' + k + '.png', optimize=True)
print('og', len(E), 'with preview', n_shot)
