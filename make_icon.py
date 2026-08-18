"""Generate DeepSeek Harness desktop icon (PNG + ICO)."""
from PIL import Image, ImageDraw, ImageFont

SIZE = 256
BLUE = (77, 107, 254, 255)      # DeepSeek blue
DARK = (30, 41, 82, 255)        # deep navy
WHITE = (255, 255, 255, 255)

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# Rounded square background with subtle vertical gradient
radius = 56
for y in range(SIZE):
    t = y / SIZE
    r = int(BLUE[0] + (DARK[0] - BLUE[0]) * t)
    g = int(BLUE[1] + (DARK[1] - BLUE[1]) * t)
    b = int(BLUE[2] + (DARK[2] - BLUE[2]) * t)
    d.rounded_rectangle([0, y, SIZE - 1, y + 1], radius=radius, fill=(r, g, b, 255))

# Simple whale glyph: two arcs (body + tail)
def whale():
    w = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    dw = ImageDraw.Draw(w)
    # body: rounded horizontal capsule
    bx0, bx1, by0, by1 = 48, 168, 104, 152
    dw.rounded_rectangle([bx0, by0, bx1, by1], radius=28, fill=WHITE)
    # tail: two triangles flaring up-right
    dw.polygon([(168, 104), (212, 72), (198, 120)], fill=WHITE)
    dw.polygon([(168, 152), (212, 184), (198, 136)], fill=WHITE)
    # eye
    dw.ellipse([112, 120, 124, 132], fill=BLUE)
    return w

img = Image.alpha_composite(img, whale())

img.save("D:/dsh-desktop/icon.png")
img.save("D:/dsh-desktop/icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("icons saved:", img.size)
