# icons/gen_icon.py — 纯 stdlib 生成绿底圆角方块 + 白色 # 号图标
import struct, zlib, math, os

def make_png(size, path):
    bg = (26, 127, 55)      # 绿色 #1a7f37
    fg = (255, 255, 255)    # 白色 # 号
    r = size * 0.22         # 圆角半径
    rows = []
    for y in range(size):
        row = bytearray([0])  # filter type 0
        for x in range(size):
            dx = min(x, size - 1 - x)
            dy = min(y, size - 1 - y)
            inside = True
            if dx < r and dy < r:  # 角落:距圆心 (r, r) 的距离判断
                if math.hypot(r - dx, r - dy) > r:
                    inside = False
            # # 号:两根竖条 + 两根横条(尺寸按 size 比例)
            u = size * 0.62
            v = size * 0.38
            bar = size * 0.09
            gap = size * 0.14
            g1 = v - gap / 2 - bar   # 横条1 顶
            g2 = v + gap / 2         # 横条2 顶
            h1 = u - gap / 2 - bar   # 竖条1 左
            h2 = u + gap / 2         # 竖条2 左
            on_v = h1 <= x < h1 + bar or h2 <= x < h2 + bar
            on_h = g1 <= y < g1 + bar or g2 <= y < g2 + bar
            if not inside:
                px = (0, 0, 0, 0)        # 透明
            elif on_v or on_h:
                px = fg + (255,)
            else:
                px = bg + (255,)
            row += bytes(px)
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(tag, data):
        c = tag + data
        return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw))
           + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)
    print('wrote', path, len(png), 'bytes')

base = os.path.dirname(os.path.abspath(__file__))
for s in (16, 32, 48, 128):
    make_png(s, os.path.join(base, f'icon{s}.png'))
