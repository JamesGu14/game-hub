#!/usr/bin/env python3
# tools/debg-holes.py — 封闭残底洞检/修复(debg-sprites 的盲区:弓弦圈/胳膊夹缝等被描边圈住的背景白)。
# 判据:不触图像边界的连通块 + 近纯白(min≥240·极差≤12)+ 面积≥60px——比 debg 的「近白」严得多,
# 衣物白(赵云银甲/诸葛羽扇)有明暗纹理(方差大/偏灰),纯平白块=生成底色残留。
# 用法: python3 tools/debg-holes.py                              # 扫描全部 generals,只报告
#       python3 tools/debg-holes.py --fix liao_1.png …           # 修复指定文件(打透明+1px白晕收边)
#       python3 tools/debg-holes.py --fix --min 1000 huang_1.png # 只删 ≥min px 的洞(保白须/箭羽/刀刃等小块合法白)
import os
import sys
import numpy as np
from scipy import ndimage
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sprites', 'generals')
MIN_AREA = 60

def holes(path):
    im = Image.open(path).convert('RGBA')
    a = np.array(im).astype(int)
    rgb, alpha = a[..., :3], a[..., 3]
    near = (rgb.min(axis=2) >= 240) & ((rgb.max(axis=2) - rgb.min(axis=2)) <= 12) & (alpha > 0)
    lab, n = ndimage.label(near)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    out = []
    for i in range(1, n + 1):
        if i in border:
            continue
        m = lab == i
        area = int(m.sum())
        if area < MIN_AREA:
            continue
        ys, xs = np.where(m)
        out.append({ 'mask': m, 'area': area, 'bbox': (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) })
    return im, a, out

def fix(path, min_area=MIN_AREA):
    im, a, hs = holes(path)
    hs = [h for h in hs if h['area'] >= min_area]
    if not hs:
        print(f'{os.path.basename(path)}: 无 ≥{min_area}px 的洞,跳过')
        return
    alpha = a[..., 3]
    kill = np.zeros(alpha.shape, bool)
    for h in hs:
        kill |= h['mask']
    # 1px 白晕收边:与洞相邻且仍偏白(min≥225)的过渡像素一并清(防punch后留白圈)
    ring = ndimage.binary_dilation(kill, iterations=1) & ~kill & (a[..., :3].min(axis=2) >= 225) & (alpha > 0)
    a[..., 3] = np.where(kill | ring, 0, alpha)
    Image.fromarray(a.astype('uint8'), 'RGBA').save(path)
    print(f'{os.path.basename(path)}: 修复 {len(hs)} 洞 {sum(h["area"] for h in hs)}px(+收边 {int(ring.sum())}px)')

files = sorted(f for f in os.listdir(ROOT) if f.endswith('.png'))
if '--fix' in sys.argv:
    args = [a for a in sys.argv[1:] if a != '--fix']
    min_area = MIN_AREA
    if '--min' in args:
        i = args.index('--min')
        min_area = int(args[i + 1])
        args = args[:i] + args[i + 2:]
    for f in args:
        fix(os.path.join(ROOT, f), min_area)
else:
    found = 0
    for f in files:
        _, _, hs = holes(os.path.join(ROOT, f))
        if hs:
            found += 1
            tops = sorted(hs, key=lambda h: -h['area'])[:4]
            desc = ' '.join(f"{h['area']}px@({(h['bbox'][0]+h['bbox'][2])//2},{(h['bbox'][1]+h['bbox'][3])//2})" for h in tops)
            print(f"{f}: {len(hs)} 洞  {desc}")
    print(f"\n扫描 {len(files)} 张,{found} 张有封闭残底")
