#!/usr/bin/env python3
# tools/debg-sprites.py — [P6] 一次性资产处理：v1 sprite 不透明白底 → 透明（边缘洪填，保内部白）。
# 运行时游戏(src/)零依赖；本工具仅 dev 时用，需 Pillow：pip3 install Pillow。
# 边缘洪填：仅清「与图像边界连通的近白像素」→ 内部白（赵云银甲/诸葛白袍）因被厚描边隔开而保留。
# 处理后 autocrop 到 alpha 包围盒（脚底贴合 billboard）+ 降采样到 ≤512（瘦身）。
# 用法:
#   python3 tools/debg-sprites.py                      # 全部 11 张
#   python3 tools/debg-sprites.py generals/zhao.png    # 单张
# 幂等：已透明的图再跑近乎无变化（洪填命中不到不透明白底）。
import os
import sys
import numpy as np
from scipy import ndimage
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites')
FILES = [
    'generals/huang.png', 'generals/zhang.png', 'generals/guan.png',
    'generals/zhao.png', 'generals/ma.png', 'generals/zhuge.png',
    'enemies/nanman_footman.png', 'enemies/tengjia.png', 'enemies/wolf.png',
    'bosses/mulu.png', 'bosses/wutugu.png',
]
MIN_WHITE = 196    # 近白判定：min(r,g,b) ≥ 此值（角落 ~239、bg 渐变到 ~200 都算底）
MAX_SAT = 32       # 低饱和判定：max-min ≤ 此值（彩色/深描边不算底）
MAX_SIDE = 512     # 降采样上限（战场塔 ~54px 显示，512 足够清晰）


def debg(im):
    # 去背 = 「近白低饱和」掩膜里**与图像边界连通**的连通块（保内部白：被厚描边隔断、不连边界）。
    im = im.convert('RGBA')
    arr = np.asarray(im).copy()
    rgb = arr[..., :3].astype(np.int16)
    mx, mn = rgb.max(axis=2), rgb.min(axis=2)
    whiteish = (mn >= MIN_WHITE) & ((mx - mn) <= MAX_SAT)
    labels, n = ndimage.label(whiteish)         # 4-连通
    if n:
        border = np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]])
        border_labels = np.unique(border)
        border_labels = border_labels[border_labels != 0]
        bg = np.isin(labels, border_labels)
        arr[bg, 3] = 0                           # 边界连通的底 → 透明
    return Image.fromarray(arr, 'RGBA')


def autocrop(im, pad_frac=0.03):
    bbox = im.split()[3].getbbox()
    if not bbox:
        return im
    x0, y0, x1, y1 = bbox
    pad = int(max(im.width, im.height) * pad_frac)
    return im.crop((max(0, x0 - pad), max(0, y0 - pad),
                    min(im.width, x1 + pad), min(im.height, y1 + pad)))


def downscale(im, mx=MAX_SIDE):
    w, h = im.size
    if max(w, h) <= mx:
        return im
    s = mx / max(w, h)
    return im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)


def process(rel):
    path = os.path.normpath(os.path.join(ROOT, rel))
    im = Image.open(path)
    before = im.size
    im = downscale(autocrop(debg(im)))
    im.save(path)
    a = im.split()[3]
    trans = sum(1 for p in a.getdata() if p == 0)
    tot = im.width * im.height
    print(f'{rel}: {before[0]}x{before[1]} -> {im.width}x{im.height}  '
          f'transparent={100 * trans / tot:.0f}%  figure={100 * (1 - trans / tot):.0f}%')


def main():
    targets = sys.argv[1:] or FILES
    for rel in targets:
        process(rel)


if __name__ == '__main__':
    main()
