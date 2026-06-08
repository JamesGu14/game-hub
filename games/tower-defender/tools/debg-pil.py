#!/usr/bin/env python3
# tools/debg-pil.py — 纯 Pillow 去底（沙箱无 scipy 时 debg-sprites.py 的等价替身）。
# 算法同 debg-sprites.py：掩膜=「近白 min≥196 且 低饱和 max-min≤32」→ 仅清其中与图像边界连通的部分
# （内部白被厚描边隔断、不连边界 → 保留：赵云银甲/诸葛白袍/曹操金冠高光）。autocrop + 降采样≤512。
# 仅 dev 用；运行时游戏(src/)零依赖。用法: python3 tools/debg-pil.py bosses/caocao.png enemies/heavy.png ...
import os
import sys
from PIL import Image, ImageChops, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites')
MIN_WHITE = 196
MAX_SAT = 32
MAX_SIDE = 512


def debg(path):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    r, g, b = im.split()
    mn = ImageChops.darker(ImageChops.darker(r, g), b)          # 逐像素 min(r,g,b)
    mx = ImageChops.lighter(ImageChops.lighter(r, g), b)        # 逐像素 max(r,g,b)
    sat = ImageChops.subtract(mx, mn)                           # 饱和度 = max-min
    near = mn.point(lambda v: 255 if v >= MIN_WHITE else 0)
    lowsat = sat.point(lambda v: 255 if v <= MAX_SAT else 0)
    mask = ImageChops.multiply(near, lowsat)                    # 255=近白低饱和（含背景+内部白）

    # 从四边密集播种洪填：仅把「与边界连通的 255」改 128（背景）；内部白保持 255。
    step = 16
    seeds = ([(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)]
             + [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)])
    px = mask.load()
    for s in seeds:
        if px[s] == 255:
            ImageDraw.floodfill(mask, s, 128, thresh=0)

    alpha = mask.point(lambda v: 0 if v == 128 else 255)        # 背景(128)透明，其余不透明
    out = im.convert('RGBA')
    out.putalpha(alpha)
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    if max(out.size) > MAX_SIDE:
        out.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    out.save(path)
    return out.size


for rel in sys.argv[1:]:
    sz = debg(os.path.join(ROOT, rel))
    print(f'✓ {rel} -> {sz[0]}x{sz[1]}')
