"""Generate favicons for the guest-guide app from the LFV sun logo.

Source: src/assets/lfv-sun.png (square, transparent brand sun).
Outputs: public/favicon-32.png, public/favicon-48.png, public/favicon.ico (16/32/48).
Run: python scripts/gen-favicons.py
"""
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.normpath(os.path.join(HERE, "..", "src", "assets", "lfv-sun.png"))
PUBLIC = os.path.normpath(os.path.join(HERE, "..", "public"))


def square(img):
    w, h = img.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2), img)
    return canvas


def main():
    master = square(Image.open(SRC).convert("RGBA"))
    master.resize((32, 32), Image.LANCZOS).save(os.path.join(PUBLIC, "favicon-32.png"))
    master.resize((48, 48), Image.LANCZOS).save(os.path.join(PUBLIC, "favicon-48.png"))
    master.resize((48, 48), Image.LANCZOS).save(
        os.path.join(PUBLIC, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)]
    )
    for f in ("favicon-32.png", "favicon-48.png", "favicon.ico"):
        p = os.path.join(PUBLIC, f)
        print(f"{f:16} {os.path.getsize(p):>7} bytes")


if __name__ == "__main__":
    main()
