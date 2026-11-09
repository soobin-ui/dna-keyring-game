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
    """v2(어렵게): 색 바꾸기 대신 '없어진 것·모양' 7곳. 다른 곳은 원본 픽셀 그대로."""
    a = np.array(Image.open(os.path.join(RAW, 'spot_base_v1.png')).convert('RGB'))
    b = a.copy()

    def hsv_mask(box, cond):
        x0, y0, x1, y1 = box
        sub = b[y0:y1, x0:x1]
        hsv = cv2.cvtColor(sub, cv2.COLOR_RGB2HSV_FULL).astype(np.float32)
        h, s_, v = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
        m = np.zeros(b.shape[:2], np.uint8)
        m[y0:y1, x0:x1] = cond(h, s_, v).astype(np.uint8) * 255
        return m

    def inpaint(mask, grow=5, r=9):
        nonlocal b
        if grow: mask = cv2.dilate(mask, np.ones((grow, grow), np.uint8))
        b = cv2.inpaint(b, mask, r, cv2.INPAINT_TELEA)

    # 1) 시계 7시 눈금 없애기
    m = np.zeros(b.shape[:2], np.uint8); cv2.circle(m, (271, 562), 24, 255, -1); inpaint(m, 0, 7)
    # 2) 포스터 DNA 초록·빨강 가로대 하나 없애기
    rung = hsv_mask((955, 698, 1160, 758), lambda h, s_, v: (s_ > .30) & (((h > 80) & (h < 170)) | (h < 22) | (h > 345)))
    rung = cv2.dilate(rung, np.ones((5, 5), np.uint8))
    strand = hsv_mask((940, 690, 1180, 770), lambda h, s_, v: (s_ > .35) & (h > 185) & (h < 310))   # 파랑·보라 가닥은 보호
    rung[strand > 0] = 0
    inpaint(rung, 0, 5)
    # 3) (아래 clone 함수 정의 + 파란 시험관 물 높이)
    def clone(dst, src_dx, src_dy, feather=10):
        nonlocal b
        x0, y0, x1, y1 = dst
        patch = a[y0 + src_dy:y1 + src_dy, x0 + src_dx:x1 + src_dx].astype(np.float32)
        hh, ww = y1 - y0, x1 - x0
        w = np.ones((hh, ww), np.float32)
        for i in range(feather):
            t = (i + 1) / (feather + 1)
            w[i, :] = np.minimum(w[i, :], t); w[-1 - i, :] = np.minimum(w[-1 - i, :], t)
            w[:, i] = np.minimum(w[:, i], t); w[:, -1 - i] = np.minimum(w[:, -1 - i], t)
        b[y0:y1, x0:x1] = (b[y0:y1, x0:x1] * (1 - w[..., None]) + patch * w[..., None]).astype(np.uint8)
    # 파란 시험관 물 높이 낮추기: 랙 위 빈 유리 줄을 아래로 이어 붙이고 수면을 50px 내림
    tx0, tx1, S, top = 960, 1046, 50, 1222
    src = b.copy()
    b[top + S:top + 30 + S, tx0:tx1] = src[top:top + 30, tx0:tx1]
    b[top:top + S, tx0:tx1] = src[1112:1112 + S, tx0:tx1]
    # 4) 가운데 서랍 손잡이 없애기
    clone((1000, 1590, 1173, 1716), -170, 0, 10)
    clone((1173, 1590, 1346, 1716), 160, 0, 10)
    clone((1150, 1590, 1196, 1716), -170, 0, 0)   # 두 조각 이음매는 깨끗한 쪽으로 한 번 더
    # 5) 왼쪽 선반 받침대 없애기: 타일 한 칸 옆(오른쪽 235px)의 벽을 그대로 옮겨 붙임
    x0, y0, x1, y1, dx = 1562, 668, 1648, 805, 235
    patch = a[y0:y1, x0 + dx:x1 + dx].astype(np.float32)
    w = np.ones((y1 - y0, x1 - x0), np.float32)
    f = 8
    for i in range(f):
        t = (i + 1) / (f + 1)
        w[:, i] = np.minimum(w[:, i], t); w[:, -1 - i] = np.minimum(w[:, -1 - i], t); w[-1 - i, :] = np.minimum(w[-1 - i, :], t)
    b[y0:y1, x0:x1] = (b[y0:y1, x0:x1] * (1 - w[..., None]) + patch * w[..., None]).astype(np.uint8)

    # 6) 비커 물 높이 낮추기 (빈 유리 줄을 아래로 늘리고 수면을 내림)
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
    cv2.ellipse(leaf, (247, 70), (70, 52), 0, 0, 360, 255, -1)
    cv2.rectangle(leaf, (228, 112), (256, 168), 255, -1)
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
    make_spot()
    print('done')
