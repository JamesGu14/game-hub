#!/usr/bin/env python3
# tools/fix-sprite-blackblob.py — [实测③] 武将立绘"脚下黑影"修复:抠图残留的不透明纯黑实心块 → 透明。
# 判别法=腐蚀种子:近黑(maxRGB<THRESH)且不透明的像素 mask 先腐蚀 ERODE 圈,只有"厚实"黑块的核心存活;
# 细线稿/发丝(1-3px)腐蚀即消失,绝不会被选中。种子限底部(y > Y_MIN_FRAC*h)防误伤发髻(顶部厚黑区)。
# 从种子在 mask 内 BFS 还原整块,再做 RIM_PASSES 圈边缘羽化(邻接的深色反锯齿过渡像素一并清)。
# 用法:
#   python3 tools/fix-sprite-blackblob.py --scan            # 全量体检 assets/sprites/generals/*.png(只报告)
#   python3 tools/fix-sprite-blackblob.py --fix yueying_1.png yueying_2.png   # 实际修复(就地写回,git 兜底)
import sys
from pathlib import Path
import numpy as np
from PIL import Image

GEN_DIR = Path(__file__).resolve().parent.parent / 'assets' / 'sprites' / 'generals'
THRESH = 40        # 近黑判定:max(R,G,B) < 40(鞋/裤为暖深棕 ~#3a3230 maxRGB≈58,不入选)
ALPHA_MIN = 200    # 不透明判定
ERODE = 2          # 腐蚀圈数:细线稿 ≤ ~4px 宽全部消失,只留实心块核心
MIN_AREA = 80      # 成块面积下限(px)
Y_MIN_FRAC = 0.55  # 种子限制在底部 45%(发髻在顶部,永不入选)
RIM_THRESH = 75    # 羽化:邻接已清区且 maxRGB < 75 的过渡像素一并清
RIM_PASSES = 2

def erode(mask, n):
    m = mask.copy()
    for _ in range(n):
        p = np.pad(m, 1, constant_values=False)
        m = (p[1:-1, 1:-1] & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
             & p[:-2, :-2] & p[:-2, 2:] & p[2:, :-2] & p[2:, 2:])
    return m

def components(mask):
    """BFS 连通域(8 邻接)。返回 [(area, bbox, pixels‑bool‑mask)]"""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    out = []
    for sy, sx in zip(*np.nonzero(mask)):
        if seen[sy, sx]:
            continue
        stack = [(sy, sx)]
        seen[sy, sx] = True
        comp = np.zeros_like(mask, dtype=bool)
        while stack:
            y, x = stack.pop()
            comp[y, x] = True
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        ys, xs = np.nonzero(comp)
        out.append((int(comp.sum()), (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())), comp))
    return out

def flood_within(seed, mask):
    """种子在 mask 内膨胀至收敛(还原被腐蚀掉的整块边界)。"""
    grown = seed & mask
    while True:
        p = np.pad(grown, 1, constant_values=False)
        nb = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
              | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:])
        nxt = grown | (nb & mask)
        if nxt.sum() == grown.sum():
            return grown
        grown = nxt

def find_blobs(img):
    """返回 (待清整块 bool mask, 报告列表)。"""
    a = np.asarray(img.convert('RGBA')).copy()
    rgb_max = a[..., :3].max(axis=2)
    dark = (rgb_max < THRESH) & (a[..., 3] >= ALPHA_MIN)
    core = erode(dark, ERODE)
    core[: int(a.shape[0] * Y_MIN_FRAC), :] = False   # 种子限底部
    report, total = [], np.zeros(dark.shape, dtype=bool)
    for area, bbox, comp in components(core):
        blob = flood_within(comp, dark)
        if int(blob.sum()) < MIN_AREA:
            continue
        ys, xs = np.nonzero(blob)
        report.append({'area': int(blob.sum()),
                       'bbox': (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))})
        total |= blob
    # 报告去重(多个 core 可能还原出同一 blob)
    uniq = {(r['bbox'], r['area']): r for r in report}
    return total, list(uniq.values())

def fix_image(path, write):
    img = Image.open(path)
    blob, report = find_blobs(img)
    if not report:
        return None
    a = np.asarray(img.convert('RGBA')).copy()
    cleared = blob.copy()
    a[blob] = 0
    # 边缘羽化:邻接已清区的深色过渡像素一并清(反锯齿黑边)
    rgb_max = a[..., :3].max(axis=2)
    for _ in range(RIM_PASSES):
        p = np.pad(cleared, 1, constant_values=False)
        nb = (p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
              | p[:-2, :-2] | p[:-2, 2:] | p[2:, :-2] | p[2:, 2:])
        rim = nb & ~cleared & (rgb_max < RIM_THRESH) & (a[..., 3] > 0)
        a[rim] = 0
        cleared |= rim
    if write:
        Image.fromarray(a, 'RGBA').save(path)
    return {'report': report, 'cleared': int(cleared.sum()), 'size': img.size}

def main():
    args = sys.argv[1:]
    if args[:1] == ['--scan']:
        hits = 0
        for p in sorted(GEN_DIR.glob('*.png')):
            r = fix_image(p, write=False)
            if r:
                hits += 1
                print(f"⚠ {p.name} {r['size']}: {len(r['report'])} 块, 拟清 {r['cleared']}px, "
                      + ', '.join(f"bbox={b['bbox']} area={b['area']}" for b in r['report']))
        print(f"\n{hits} 个文件检出黑块" if hits else "\n✅ 全部干净")
    elif args[:1] == ['--fix'] and len(args) > 1:
        for name in args[1:]:
            p = Path(name) if '/' in name else GEN_DIR / name
            r = fix_image(p, write=True)
            print(f"✅ {p.name}: 清除 {r['cleared']}px ({len(r['report'])} 块)" if r else f"○ {p.name}: 无黑块,未改动")
    else:
        print(__doc__ or 'usage: --scan | --fix <file...>')
        sys.exit(1)

if __name__ == '__main__':
    main()
