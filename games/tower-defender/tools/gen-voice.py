#!/usr/bin/env python3
# tools/gen-voice.py — [演绎段2] edge-tts 批量配音 + registry + 校验门禁(spec §4/§8.3)。
# 用法:
#   python3 tools/gen-voice.py                # 全 50 关:增量生成缺失 mp3 + 全量重写 registry.json
#   python3 tools/gen-voice.py --levels 1     # 仅指定关(逗号分隔;样片定音色用)
#   python3 tools/gen-voice.py --check [--levels 1]   # 门禁:枚举键 ⊆ registry 且文件齐,缺失列清单 exit 1
#   python3 tools/gen-voice.py --bitrate 24k  # 体积超 20MB 时降码率重跑(默认 32k;无 ffmpeg 保留原始 48k)
# 依赖:edge-tts(James 机已装)、node(枚举台词)、ffmpeg(可选转码)。
# 文件名 = sha1(voiceName|rate|pitch|text)[:12].mp3 → 剧本微调只重生成改动句;同文同声跨角色共用。
import argparse, hashlib, json, os, shutil, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE_DIR = os.path.join(ROOT, 'assets', 'voice')
REGISTRY = os.path.join(VOICE_DIR, 'registry.json')

# 集中别名映射(spec §4:微软更名/下线音色时改这一处全局生效;键=cast.js 写的逻辑名,值=实际音色)
VOICE_ALIASES = {
    'zh-CN-XiaoxiaoNeural': 'zh-CN-XiaoxiaoNeural',
    'zh-CN-XiaoyiNeural':   'zh-CN-XiaoyiNeural',
    'zh-CN-YunjianNeural':  'zh-CN-YunjianNeural',
    'zh-CN-YunxiNeural':    'zh-CN-YunxiNeural',
    'zh-CN-YunyangNeural':  'zh-CN-YunyangNeural',
}

def pitch_to_hz(pct):
    """cast.js pitch 用 %(spec §4 口径);edge-tts CLI pitch 只收 Hz → ±1% ≈ ±2Hz(样片期调系数)。"""
    if not pct: return None
    n = int(pct.replace('%', ''))
    hz = n * 2
    return f'{"+" if hz >= 0 else ""}{hz}Hz'

def enumerate_lines(levels):
    cmd = ['node', os.path.join(ROOT, 'tools', 'dump-voice-lines.mjs')]
    if levels: cmd.append(levels)
    out = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    if out.returncode != 0:
        sys.exit(f'✗ 枚举台词失败: {out.stderr[:400]}')
    return json.loads(out.stdout)

def check_voices_exist():
    out = subprocess.run(['edge-tts', '--list-voices'], capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit('✗ edge-tts 不可用(pip install edge-tts / 检查网络)')
    have = out.stdout
    missing = [v for v in set(VOICE_ALIASES.values()) if v not in have]
    if missing:
        sys.exit(f'✗ 音色已下线/更名,改 VOICE_ALIASES: {missing}')

def hash_of(voice, text):
    raw = f"{voice['name']}|{voice.get('rate') or ''}|{voice.get('pitch') or ''}|{text}"
    return hashlib.sha1(raw.encode('utf-8')).hexdigest()[:12]

def gen_one(voice, text, dest, bitrate, has_ffmpeg):
    real = VOICE_ALIASES[voice['name']]
    with tempfile.NamedTemporaryFile(suffix='.mp3', delete=False) as t:
        tmp = t.name
    cmd = ['edge-tts', '--voice', real, '--text', text, '--write-media', tmp]
    if voice.get('rate'): cmd += [f"--rate={voice['rate']}"]
    hz = pitch_to_hz(voice.get('pitch'))
    if hz: cmd += [f'--pitch={hz}']
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0 or not os.path.getsize(tmp):
        os.unlink(tmp); return f'edge-tts 失败: {r.stderr[:200]}'
    if has_ffmpeg:
        r2 = subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-ac', '1', '-b:a', bitrate, dest],
                            capture_output=True, text=True)
        os.unlink(tmp)
        if r2.returncode != 0: return f'ffmpeg 失败: {r2.stderr[:200]}'
    else:
        shutil.move(tmp, dest)   # 无 ffmpeg:保留 edge-tts 原始 48kbps(体积 +50%,可玩)
    return None

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--levels', help='逗号分隔关号(缺省=全 50 关)')
    ap.add_argument('--check', action='store_true', help='只校验不生成(门禁)')
    ap.add_argument('--bitrate', default='32k')
    a = ap.parse_args()

    lines = enumerate_lines(a.levels)
    if a.check:
        reg = json.load(open(REGISTRY)) if os.path.exists(REGISTRY) else {}
        missing = []
        for e in lines:
            key = f"{e['who']}|{e['text']}"
            f = reg.get(key)
            if not f or not os.path.exists(os.path.join(VOICE_DIR, f)):
                missing.append(f"{key[:48]}…" if len(key) > 48 else key)
        if missing:
            print(f'✗ voice registry 校验失败,缺 {len(missing)} 句:')
            for m in missing: print('  -', m)
            sys.exit(1)
        print(f'ok voice registry({len(lines)} 句全有 mp3)')
        return

    check_voices_exist()
    has_ffmpeg = shutil.which('ffmpeg') is not None
    if not has_ffmpeg: print('⚠ 无 ffmpeg,保留 edge-tts 原始 48kbps')
    os.makedirs(VOICE_DIR, exist_ok=True)

    registry, made, fail = {}, 0, []
    for e in lines:
        h = hash_of(e['voice'], e['text'])
        registry[f"{e['who']}|{e['text']}"] = h + '.mp3'
        dest = os.path.join(VOICE_DIR, h + '.mp3')
        if os.path.exists(dest): continue          # 增量:同声同文已有即跳过
        err = gen_one(e['voice'], e['text'], dest, a.bitrate, has_ffmpeg)
        if err: fail.append((e['who'], e['text'][:24], err))
        else: made += 1; print(f"  ✓ {h}.mp3  {e['who']}: {e['text'][:24]}")
    with open(REGISTRY, 'w', encoding='utf-8') as f:
        json.dump(dict(sorted(registry.items())), f, ensure_ascii=False, indent=0, separators=(',', ':'))
    total = sum(os.path.getsize(os.path.join(VOICE_DIR, x)) for x in os.listdir(VOICE_DIR) if x.endswith('.mp3'))
    print(f'完成:新生成 {made} 句 / registry {len(registry)} 键 / voice 目录 {total/1048576:.1f}MB')
    if total > 20 * 1048576: print('⚠ 超 20MB:建议 --bitrate 24k 重跑(spec §9)')
    if fail:
        print(f'✗ {len(fail)} 句失败(网络抖动可重跑,增量续传):')
        for w, t, e2 in fail[:10]: print(f'  - {w}: {t} — {e2}')
        sys.exit(1)

main()
