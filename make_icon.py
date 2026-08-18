"""Convert the official DeepSeek whale logo (whale.svg) into icon.png / icon.ico.

The SVG source is the official DeepSeek favicon (from the dsh web frontend),
recolored to the brand blue (#4d6bfe) with a transparent background.
Requires: pip install resvg-py pillow
"""
import io
import resvg_py
from PIL import Image

SVG_PATH = r"D:\dsh-desktop\whale.svg"
PNG_PATH = r"D:\dsh-desktop\icon.png"
ICO_PATH = r"D:\dsh-desktop\icon.ico"

with open(SVG_PATH, "r", encoding="utf-8") as f:
    svg = f.read()

png = resvg_py.svg_to_bytes(svg_string=svg, width=256, height=256)
img = Image.open(io.BytesIO(png)).convert("RGBA")
img.save(PNG_PATH)
img.save(ICO_PATH, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("icon.png:", img.size, img.mode)
print("icon.ico: multi-size saved")
