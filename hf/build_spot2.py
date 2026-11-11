"""어려움 단계 틀린그림: 힉스필드 원본(hf/raw/spot2_base_v1.png, 2336×1744)에서 10곳만 고쳐 B를 만든다.
지우기는 '같은 줄의 양옆 색으로 가로 보간'(가로 줄눈·모서리가 그대로 이어져 지운 티가 안 남)이나
평평한 면 inpaint만 쓰고, 나머지는 물 높이 이동·색 바꾸기. 다른 곳은 픽셀 그대로.
좌표는 원본 픽셀 기준. 게임 좌표(400×300)는 원본 x/2336*400, y/1744*300."""
import os, numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(HERE, '..', 'img')


def row_fill(b, x0, x1, y0, y1, mask=None, k=4):
    """각 줄마다 왼쪽(x0 바깥 k픽셀 평균)과 오른쪽(x1 바깥 k픽셀 평균)을 직선으로 이어 칠함"""
    src = b.astype(np.float32)
    for y in range(y0, y1):
        L = src[y, x0 - k:x0].mean(0); R = src[y, x1:x1 + k].mean(0)
        t = np.linspace(0, 1, x1 - x0)[:, None]
        row = L * (1 - t) + R * t
        if mask is None:
            b[y, x0:x1] = row.clip(0, 255).astype(np.uint8)
        else:
            m = mask[y - y0][:, None]
            b[y, x0:x1] = (src[y, x0:x1] * (1 - m) + row * m).clip(0, 255).astype(np.uint8)


def soft_ellipse(w, h, cx, cy, rx, ry, feather=3):
    m = np.zeros((h, w), np.uint8)
    cv2.ellipse(m, (cx, cy), (rx, ry), 0, 0, 360, 255, -1)
    return cv2.GaussianBlur(m.astype(np.float32) / 255, (0, 0), feather)


def color_mask(sub, h_from, h_to, s_min=0.3, v_min=0.15):
    hsv = cv2.cvtColor(sub, cv2.COLOR_RGB2HSV_FULL).astype(np.float32)
    h = hsv[..., 0] * 360 / 255; s = hsv[..., 1] / 255; v = hsv[..., 2] / 255
    m = ((h >= h_from) & (h <= h_to)) if h_from <= h_to else ((h >= h_from) | (h <= h_to))
    m &= (s >= s_min) & (v >= v_min)
    return m


def recolor_like(b, box, h_from, h_to, ref_box, ref_h_from, ref_h_to, s_min=0.3):
    """box 안의 (h_from~h_to) 색 픽셀을 ref_box 안 (ref 색) 픽셀의 채널별 평균·편차에 맞춰 다시 칠함 → 음영은 유지, 색만 ref처럼"""
    x0, y0, x1, y1 = box; rx0, ry0, rx1, ry1 = ref_box
    sub = b[y0:y1, x0:x1].copy(); ref = ORIG[ry0:ry1, rx0:rx1]
    m = color_mask(sub, h_from, h_to, s_min); rm = color_mask(ref, ref_h_from, ref_h_to, s_min)
    out = sub.astype(np.float32)
    for c in range(3):
        s_ = sub[..., c][m].astype(np.float32); r_ = ref[..., c][rm].astype(np.float32)
        g = r_.std() / max(s_.std(), 1e-3); o = r_.mean() - g * s_.mean()
        out[..., c] = sub[..., c] * g + o
    mf = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.0)[..., None]
    b[y0:y1, x0:x1] = (sub * (1 - mf) + out.clip(0, 255) * mf).astype(np.uint8)


def hue_to(b, box, h_from, h_to, h_new, v_gain=1.0, s_gain=1.0, s_min=0.35):
    x0, y0, x1, y1 = box
    sub = b[y0:y1, x0:x1]
    m = color_mask(sub, h_from, h_to, s_min)
    hsv = cv2.cvtColor(sub, cv2.COLOR_RGB2HSV_FULL).astype(np.float32)
    hsv[..., 0] = h_new * 255 / 360
    hsv[..., 1] = (hsv[..., 1] * s_gain).clip(0, 255); hsv[..., 2] = (hsv[..., 2] * v_gain).clip(0, 255)
    rgb2 = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2RGB_FULL).astype(np.float32)
    mf = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.0)[..., None]
    b[y0:y1, x0:x1] = (sub * (1 - mf) + rgb2 * mf).clip(0, 255).astype(np.uint8)


def fill_smooth(b, cx, cy, r, ring=14, tol=18, feather=4, order=2):
    """원(cx,cy,r) 안을 둘레 띠의 색으로 2차 곡면을 맞춰 채움 → 면의 밝기 흐름이 그대로 이어짐.
    둘레 중 색이 튀는 곳(모서리 빛, 구멍)은 계산에서 뺌"""
    H, W = b.shape[:2]
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.hypot(xx - cx, yy - cy)
    y0, y1, x0, x1 = cy - r - ring - 2, cy + r + ring + 2, cx - r - ring - 2, cx + r + ring + 2
    D = d[y0:y1, x0:x1]; X = xx[y0:y1, x0:x1] - cx; Y = yy[y0:y1, x0:x1] - cy
    sub = b[y0:y1, x0:x1].astype(np.float32)
    ringm = (D > r + 2) & (D <= r + ring)
    med = np.median(sub[ringm], axis=0)
    ringm &= np.abs(sub - med).sum(2) < tol * 3
    cols = [np.ones_like(X), X, Y] + ([X * X, Y * Y, X * Y] if order == 2 else [])
    A = np.stack(cols, -1).astype(np.float32)
    fill = np.zeros_like(sub)
    for c in range(3):
        coef, *_ = np.linalg.lstsq(A[ringm], sub[..., c][ringm], rcond=None)
        fill[..., c] = A @ coef
    w = np.clip((r + feather - D) / (2 * feather), 0, 1)[..., None]
    b[y0:y1, x0:x1] = (sub * (1 - w) + fill * w).clip(0, 255).astype(np.uint8)


def col_fill(b, x0, x1, y0, y1, k=3):
    """각 세로줄마다 위(y0 바깥)와 아래(y1 바깥) 색을 직선으로 이어 칠함"""
    src = b.astype(np.float32)
    T = src[y0 - k:y0, x0:x1].mean(0); B = src[y1:y1 + k, x0:x1].mean(0)
    t = np.linspace(0, 1, y1 - y0)[:, None, None]
    b[y0:y1, x0:x1] = (T[None] * (1 - t) + B[None] * t).clip(0, 255).astype(np.uint8)


ORIG = np.array(Image.open(os.path.join(RAW, 'spot2_base_v1.png')).convert('RGB'))
DIFFS = []  # (이름, 원본 x, 원본 y, 반지름 원본px)


def make():
    a = ORIG
    b = a.copy()
    # 1) 창밖 구름 크기 줄이기 (없애기는 너무 쉬움 → 실제 어려운 틀린그림처럼 '크기 변화')
    x0, x1, y0, y1 = 422, 604, 196, 304
    cloud = a[y0:y1, x0:x1].astype(np.float32)
    row_fill(b, x0, x1, y0, y1, k=5)                                   # 구름 뺀 하늘
    sky = b[y0:y1, x0:x1].astype(np.float32)
    m = np.clip((cloud[..., 0] - 95) / 110, 0, 1)                      # 흰 구름 = 빨강 채널이 높음
    k = 0.72; hh, ww = m.shape; nh, nw = int(hh * k), int(ww * k)
    cs = cv2.resize(cloud, (nw, nh), interpolation=cv2.INTER_AREA); ms = cv2.resize(m, (nw, nh), interpolation=cv2.INTER_AREA)
    oy, ox = (hh - nh) // 2 + 6, (ww - nw) // 2                        # 같은 자리(살짝 아래)에
    out = sky.copy()
    reg = out[oy:oy + nh, ox:ox + nw]
    out[oy:oy + nh, ox:ox + nw] = reg * (1 - ms[..., None]) + cs * ms[..., None]
    b[y0:y1, x0:x1] = out.clip(0, 255).astype(np.uint8)
    DIFFS.append(('창밖 구름 크기(작아짐)', 512, 250, 70))
    # 2) 공구판 오른쪽 위 나사 없애기: 평평한 청록 면 inpaint
    fill_smooth(b, 1459, 173, 30, ring=12)
    DIFFS.append(('공구판 오른쪽 위 나사', 1458, 171, 40))
    # 3) 보라·분홍 스포이트 색 서로 바꾸기 (원본 기준으로 색을 가져와 음영은 그대로)
    recolor_like(b, (1272, 268, 1334, 376), 250, 300, (1335, 268, 1396, 376), 320, 359)
    recolor_like(b, (1335, 268, 1396, 376), 320, 359, (1272, 268, 1334, 376), 250, 300)
    DIFFS.append(('스포이트 보라·분홍 색', 1334, 322, 62))
    # 4) 선반 파란 병 물 높이 낮추기 (병 안 가로 범위만)
    tx0, tx1, top, S = 1906, 1984, 357, 30
    src = b.copy()
    b[top + S:top + S + 26, tx0:tx1] = src[top:top + 26, tx0:tx1]
    b[top:top + S, tx0:tx1] = src[322:322 + S, tx0:tx1]
    DIFFS.append(('선반 파란 병 물 높이', 1945, 395, 50))
    # 5) 보라 시험관 물 높이 올리기 (선반 위로 보이는 부분)
    tx0, tx1, top, S = 1257, 1296, 905, 26
    src = b.copy()
    band = src[top - 2:top + 10, tx0:tx1]                       # 물 표면 띠
    b[top - S - 2:top - S + 10, tx0:tx1] = band
    for y in range(top - S + 10, top + 12):
        b[y, tx0:tx1] = src[top + 16, tx0:tx1]                  # 그 아래는 물 색으로 채움
    DIFFS.append(('보라 시험관 물 높이', 1276, 900, 40))
    # 6) 초록 펜 → 노란 펜
    hue_to(b, (606, 824, 668, 975), 100, 170, 212, v_gain=1.0, s_gain=1.0)
    DIFFS.append(('초록 펜 → 파란 펜', 636, 880, 48))
    # 7) 공책 파랑·초록 순서 바꾸기 (같은 자리에서 두 색을 서로 바꿈, 종이 부분은 그대로)
    bx = (240, 1012, 525, 1150)
    sub = ORIG[bx[1]:bx[3], bx[0]:bx[2]]
    mb = color_mask(sub, 195, 235, 0.35); mg = color_mask(sub, 95, 165, 0.35)
    outb = sub.astype(np.float32).copy()
    for src_m, ref_m in ((mb, mg), (mg, mb)):
        for c in range(3):
            s_ = sub[..., c][src_m].astype(np.float32); r_ = sub[..., c][ref_m].astype(np.float32)
            g = r_.std() / max(s_.std(), 1e-3); o = r_.mean() - g * s_.mean()
            ch = outb[..., c]; ch[src_m] = (sub[..., c][src_m] * g + o)
    feather = cv2.GaussianBlur((mb | mg).astype(np.float32), (0, 0), 1.0)[..., None]
    b[bx[1]:bx[3], bx[0]:bx[2]] = (sub * (1 - feather) + outb.clip(0, 255) * feather).astype(np.uint8)
    DIFFS.append(('공책 파랑·초록 순서', 380, 1080, 70))
    # 8) 공구함 잠금쇠 없애기: 뚜껑 이음선이 가로라서 가로 보간이 자연스러움
    row_fill(b, 1552, 1628, 910, 1000, k=6)
    DIFFS.append(('공구함 잠금쇠', 1590, 950, 44))
    # 9) 세 번째 서랍 손잡이 없애기
    cx, cy, r = 1447, 1480, 84
    sm = b.copy(); fill_smooth(sm, cx, cy, r, ring=22, tol=10, feather=8, order=1)   # 밝기 흐름
    dx = 140                                                                          # 같은 서랍 왼쪽 빈 곳의 질감
    ys, xs = slice(cy - r - 10, cy + r + 10), slice(cx - r - 10, cx + r + 10)
    src = b[ys, slice(cx - r - 10 + dx, cx + r + 10 + dx)].astype(np.float32)
    hi = src - cv2.GaussianBlur(src, (0, 0), 6)
    yy, xx = np.mgrid[ys, xs]; D = np.hypot(xx - cx, yy - cy)
    w = np.clip((r + 8 - D) / 16, 0, 1)[..., None]
    b[ys, xs] = (sm[ys, xs].astype(np.float32) + hi * w).clip(0, 255).astype(np.uint8)
    DIFFS.append(('세 번째 서랍 손잡이', 1452, 1466, 56))
    # 10) 돋보기 손잡이 짧게 (손잡이 기울기를 따라 끝부분을 24px 당기고, 빈 끝은 그 너머 책상으로)
    # 보안경이 x 1530부터 붙어 있어서 손잡이 끝 너머(1516~1528)만 책상으로 쓰고, 그 오른쪽은 건드리지 않음
    c, e, N, dy, ry0, ry1, hend = 1452, 1524, 24, 2, 1118, 1184, 1518
    src = b.copy()
    clean = src.copy(); col_fill(clean, hend - N - 4, e + 2, ry0, ry1, k=3)   # 손잡이 끝이 빠진 자리 = 위아래 책상 색 잇기
    for x in range(c, e):
        b[ry0:ry1, x] = src[ry0 + dy:ry1 + dy, x + N] if x + N < hend else clean[ry0:ry1, x]
    for i in range(5):                                                  # 오른쪽 경계(원본과 만나는 곳) 부드럽게
        t = (i + 1) / 6; x = e - 5 + i
        b[ry0:ry1, x] = (b[ry0:ry1, x] * (1 - t) + src[ry0:ry1, x] * t).astype(np.uint8)
    for i in range(6):                                                  # 자른 이음매 부드럽게
        t = (i + 1) / 7
        b[ry0:ry1, c + i] = (src[ry0:ry1, c + i] * (1 - t) + b[ry0:ry1, c + i] * t).astype(np.uint8)
    DIFFS.append(('돋보기 손잡이 길이', 1480, 1142, 60))
    # 11) 노란 시험관 뚜껑 → 주황
    hue_to(b, (1058, 818, 1118, 866), 35, 65, 26, s_min=0.35)
    DIFFS.append(('노란 시험관 뚜껑 색', 1088, 842, 36))
    # 12) 공구판 아래쪽 구멍 하나 막기 (평평한 청록 면)
    mk = np.zeros(b.shape[:2], np.uint8); cv2.circle(mk, (1311, 552), 15, 255, -1)
    b = cv2.inpaint(b, mk, 9, cv2.INPAINT_TELEA)
    DIFFS.append(('공구판 구멍 하나', 1311, 552, 30))

    Image.fromarray(b).save(os.path.join(RAW, 'spot2_b_full.png'))
    for name, arr in (('spot2_a', a), ('spot2_b', b)):
        Image.fromarray(arr).resize((1200, 900), Image.LANCZOS).save(os.path.join(OUT, name + '.jpg'), quality=84, optimize=True)
    # 게임 좌표 출력
    lines = []
    for n, x, y, r in DIFFS:
        gx, gy, gr = x / 2336 * 400, y / 1744 * 300, max(14, r / 2336 * 400)
        lines.append(f"    {{ x: {gx:.0f}, y: {gy:.0f}, r: {gr:.0f}, name: '{n}' }},")
    open(os.path.join(RAW, 'spot2_diffs.txt'), 'w', encoding='utf-8').write(chr(10).join(lines))


if __name__ == '__main__':
    make()
