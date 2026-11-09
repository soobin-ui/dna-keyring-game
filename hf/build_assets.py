"""힉스필드 원본(hf/raw) → 웹용 그림(img/).
틀린그림 B는 원본 A에서 7곳만 직접 고쳐 만든다(AI 재생성 없이, 다른 곳은 픽셀 그대로).
좌표는 1024px 미리보기 기준으로 적고 S배 해서 원본(2336px)에 적용."""
import os, numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(HERE, '..', 'img')
os.makedirs(OUT, exist_ok=True)
S = 2336 / 1024


def P(*v):  # 미리보기 좌표 → 원본 좌표
    return [int(round(x * S)) for x in v]


def hue_shift(arr, box, h_from, h_to, h_new, s_min=0.25, v_min=0.15):
    """box 안에서 색상(h_from~h_to, 0~360)인 픽셀만 h_new 로 돌림. 밝기·채도는 유지."""
    x0, y0, x1, y1 = P(*box)
    sub = arr[y0:y1, x0:x1]
    hsv = cv2.cvtColor(sub, cv2.COLOR_RGB2HSV_FULL).astype(np.float32)  # H 0~255
    h = hsv[..., 0] * 360 / 255
    s = hsv[..., 1] / 255
    v = hsv[..., 2] / 255
    if h_from <= h_to:
        m = (h >= h_from) & (h <= h_to)
    else:
        m = (h >= h_from) | (h <= h_to)
    m &= (s >= s_min) & (v >= v_min)
    m = cv2.GaussianBlur(m.astype(np.float32), (0, 0), 1.2)
    shifted = hsv.copy()
    shifted[..., 0] = h_new * 255 / 360
    rgb2 = cv2.cvtColor(shifted.astype(np.uint8), cv2.COLOR_HSV2RGB_FULL).astype(np.float32)
    out = sub.astype(np.float32) * (1 - m[..., None]) + rgb2 * m[..., None]
    arr[y0:y1, x0:x1] = out.clip(0, 255).astype(np.uint8)


def make_spot():
    a = np.array(Image.open(os.path.join(RAW, 'spot_base_v1.png')).convert('RGB'))
    b = a.copy()

    # 1) 시계 바늘: 원래 바늘 지우고 다른 시각으로 다시 그림
    ox, oy = 91, 137                      # 시계 크롭 원점(원본 좌표)
    cx, cy = ox + 268, oy + 265
    mask = np.zeros(b.shape[:2], np.uint8)
    for ddx, ddy in ((0, 0), (5, 8), (9, 14)):   # 바늘 + 아래로 진 그림자까지
        cv2.line(mask, (cx + ddx, cy + ddy), (ox + 165 + ddx, oy + 205 + ddy), 255, 44)
        cv2.line(mask, (cx + ddx, cy + ddy), (ox + 430 + ddx, oy + 172 + ddy), 255, 36)
    cv2.circle(mask, (cx + 4, cy + 6), 40, 255, -1)
    b = cv2.inpaint(b, mask, 9, cv2.INPAINT_TELEA)
    # 지우다 같이 사라진 2시 눈금: 원본의 10시 눈금을 좌우로 뒤집어 붙임
    patch = a[oy + 148: oy + 212, ox + 80: ox + 142][:, ::-1]
    tx = 2 * 268 - 142
    b[oy + 148: oy + 212, ox + tx: ox + tx + 62] = patch
    big = Image.new('RGBA', (b.shape[1] * 2, b.shape[0] * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(big)
    C2 = (cx * 2, cy * 2)
    hand = (58, 62, 66, 255)
    for (dx, dy, w) in [(0.0, -1.0, 34), (0.62, 0.78, 46)]:   # 분침 12시, 시침 5시 방향
        L = 360 if w == 34 else 230
        end = (C2[0] + dx * L, C2[1] + dy * L)
        d.line([C2, end], fill=hand, width=w)
        d.ellipse([end[0] - w / 2, end[1] - w / 2, end[0] + w / 2, end[1] + w / 2], fill=hand)
    d.ellipse([C2[0] - 46, C2[1] - 46, C2[0] + 46, C2[1] + 46], fill=(48, 52, 56, 255))
    over = big.resize((b.shape[1], b.shape[0]), Image.LANCZOS)
    bi = Image.fromarray(b).convert('RGBA')
    bi.alpha_composite(over)
    b = np.array(bi.convert('RGB'))

    # 2) 포스터 보라색 가닥 → 주황
    hue_shift(b, (380, 55, 545, 375), 255, 315, 28)
    # 3) 선반 오른쪽 병의 파란 물 → 보라
    hue_shift(b, (893, 185, 982, 268), 190, 235, 285)
    # 4) 두 번째 시험관 초록 뚜껑 → 빨강
    hue_shift(b, (326, 456, 370, 491), 85, 160, 0)
    # 5) 페트리 접시 분홍 → 노랑
    hue_shift(b, (683, 555, 842, 625), 300, 355, 52, s_min=0.15)

    # 6) 비커 물 높이 낮추기: 빈 유리 줄을 아래로 늘리고 수면을 내림
    bx, by = P(520, 460)
    x0, x1 = bx + 40, bx + 318
    shift = 70
    src = b.copy()
    b[by + 165 + shift: by + 300, x0:x1] = src[by + 165: by + 300 - shift, x0:x1]
    b[by + 165: by + 165 + shift, x0:x1] = src[by + 95: by + 95 + shift, x0:x1]

    # 7) 화분 맨 위 잎 하나 없애기
    px, py = P(820, 390)
    sub = b[py: py + 330, px: px + 466]
    hsv = cv2.cvtColor(sub, cv2.COLOR_RGB2HSV_FULL)
    h = hsv[..., 0].astype(np.float32) * 360 / 255
    green = ((h > 55) & (h < 110) & (hsv[..., 1] > 90)).astype(np.uint8) * 255
    leaf = np.zeros_like(green)
    cv2.ellipse(leaf, (247, 70), (70, 52), 0, 0, 360, 255, -1)          # 잎
    cv2.rectangle(leaf, (228, 112), (256, 168), 255, -1)                  # 잎자루 윗부분
    m = cv2.dilate(cv2.bitwise_and(green, leaf), np.ones((7, 7), np.uint8))
    full = np.zeros(b.shape[:2], np.uint8)
    full[py: py + 330, px: px + 466] = m
    b = cv2.inpaint(b, full, 15, cv2.INPAINT_TELEA)

    for name, arr in (('spot_a', a), ('spot_b', b)):
        Image.fromarray(arr).resize((1200, 900), Image.LANCZOS).save(os.path.join(OUT, name + '.jpg'), quality=84, optimize=True)


def make_hero():
    im = Image.open(os.path.join(RAW, 'hero_test_v1.png')).convert('RGB')
    a = np.array(im)
    # 표시창의 '37.0℃'(온도는 미확인) → '온수 처리 중'
    x0, y0, x1, y1 = 972, 1032, 1244, 1126
    bg = np.median(a[y0 - 6:y0, x0 + 20:x1 - 20].reshape(-1, 3), axis=0)
    a[y0:y1, x0:x1] = bg.astype(np.uint8)
    im = Image.fromarray(a)
    font = ImageFont.truetype('C:/Windows/Fonts/malgunbd.ttf', 46)
    txt = '온수 처리 중'
    layer = Image.new('RGBA', im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    w = d.textlength(txt, font=font)
    pos = ((x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - 30)
    d.text(pos, txt, font=font, fill=(70, 235, 225, 255))
    glow = layer.filter(ImageFilter.GaussianBlur(6))
    base = im.convert('RGBA')
    base.alpha_composite(glow)
    base.alpha_composite(layer)
    base.convert('RGB').resize((1200, 896), Image.LANCZOS).save(os.path.join(OUT, 'hero.jpg'), quality=84, optimize=True)


def make_icons():
    for n in ('spot', 'pattern', 'ox'):
        im = Image.open(os.path.join(RAW, f'icon_{n}_v1.png')).convert('RGBA')
        bb = im.getbbox()
        im = im.crop(bb)
        side = max(im.size)
        sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
        sq.paste(im, ((side - im.size[0]) // 2, (side - im.size[1]) // 2))
        sq.resize((320, 320), Image.LANCZOS).save(os.path.join(OUT, f'icon_{n}.png'), optimize=True)


if __name__ == '__main__':
    make_spot(); make_hero(); make_icons()
    print('done')
