#!/usr/bin/env python3
# tools/contact-sheet.py — 把 assets/sprites 全部 sprite 拼成一张总览图供人工审阅。
# 用法: python3 tools/contact-sheet.py  → 输出 ../_sprites-review.png（未入库，审完可删）。
import os
import glob
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), '..')
SPR = os.path.join(ROOT, 'assets', 'sprites')
# 排序：generals → enemies → bosses，组内字母序
order = {'generals': 0, 'enemies': 1, 'bosses': 2}
files = sorted(glob.glob(os.path.join(SPR, '*', '*.png')),
               key=lambda f: (order.get(os.path.basename(os.path.dirname(f)), 9), os.path.basename(f)))
CELL, PAD, LBL, COLS = 140, 10, 18, 6
rows = (len(files) + COLS - 1) // COLS
W = COLS * (CELL + PAD) + PAD
H = rows * (CELL + LBL + PAD) + PAD
sheet = Image.new('RGBA', (W, H), (38, 34, 28, 255))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype('/System/Library/Fonts/PingFang.ttc', 13)
except Exception:
    font = ImageFont.load_default()
for i, f in enumerate(files):
    r, c = divmod(i, COLS)
    x = PAD + c * (CELL + PAD)
    y = PAD + r * (CELL + LBL + PAD)
    im = Image.open(f).convert('RGBA')
    im.thumbnail((CELL, CELL), Image.LANCZOS)
    sheet.alpha_composite(im, (x + (CELL - im.width) // 2, y + (CELL - im.height)))
    cat = os.path.basename(os.path.dirname(f))[:3]
    name = os.path.splitext(os.path.basename(f))[0]
    draw.text((x + 2, y + CELL + 2), f'{cat}/{name}', fill=(232, 222, 200, 255), font=font)
out = os.path.join(ROOT, '_sprites-review.png')
sheet.save(out)
print('wrote', os.path.abspath(out), sheet.size, f'({len(files)} sprites)')
