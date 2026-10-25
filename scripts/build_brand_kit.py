"""Builds the downloadable files behind the /brand page.

Run from the repo root:  python scripts/build_brand_kit.py
Needs: pillow, fonttools, brotli.

Inputs (committed):  public/brand/logo/afaq-mark-black.png (2000px, transparent)
                     public/brand/fonts/*.woff2 / *.ttf
Outputs: PNG logo exports, TTF copies of the Thmanyah woff2 files (desktop apps
can't install woff2), palette files, a hosted @font-face stylesheet, the
AI design skill bundle (public/brand/skill/SKILL.md + fonts), and one ZIP with
everything.
"""
import io
import json
import struct
import zipfile
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "public" / "brand"
LOGO = BRAND / "logo"
FONTS = BRAND / "fonts"
PALETTE_DIR = BRAND / "palette"

# Keep in sync with src/data/brand.js
COLORS = [
    ("midnight", "Midnight", "050A30"),
    ("deep-blue", "Deep Blue", "12229D"),
    ("afaq-blue", "Afaq Blue", "233DFF"),
    ("slate", "Slate", "3C4C59"),
    ("sky", "Sky", "5CBCF9"),
    ("ice", "Ice", "CAE8FF"),
    ("cloud", "Cloud", "F4F6FC"),
]

LOGO_COLORS = {"navy": "050A30", "blue": "233DFF", "black": "000000", "white": "FFFFFF"}
SIZES = [256, 512, 1024, 2048]


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mark_mask():
    src = Image.open(LOGO / "afaq-mark-black.png").convert("RGBA")
    return src.getchannel("A")


def export_logos():
    mask = mark_mask()
    out = LOGO / "png"
    out.mkdir(exist_ok=True)
    for name, hexv in LOGO_COLORS.items():
        for size in SIZES:
            m = mask.resize((size, size), Image.LANCZOS)
            img = Image.new("RGBA", (size, size), rgb(hexv) + (0,))
            img.putalpha(m)
            img.save(out / f"afaq-mark-{name}-{size}.png", optimize=True)
    # App-icon style tiles: mark on a solid brand background.
    for bg_name, bg, fg in [("midnight", "050A30", "FFFFFF"), ("afaq-blue", "233DFF", "FFFFFF"),
                            ("cloud", "F4F6FC", "050A30")]:
        size = 1024
        tile = Image.new("RGBA", (size, size), rgb(bg) + (255,))
        inner = int(size * 0.72)
        m = mask.resize((inner, inner), Image.LANCZOS)
        fg_img = Image.new("RGBA", (inner, inner), rgb(fg) + (255,))
        off = (size - inner) // 2
        tile.paste(fg_img, (off, off), m)
        tile.save(out / f"afaq-tile-{bg_name}-{size}.png", optimize=True)


def woff2_to_ttf():
    for f in FONTS.glob("thmanyah*.woff2"):
        font = TTFont(f)
        font.flavor = None
        font.save(f.with_suffix(".ttf"))


def ase_bytes():
    """Adobe Swatch Exchange, RGB float swatches in one group."""
    def ustr(s):
        s += "\0"
        return struct.pack(">H", len(s)) + s.encode("utf-16-be")

    blocks = []
    group = ustr("AFAQ")
    blocks.append(struct.pack(">HI", 0xC001, len(group)) + group)
    for _, label, hexv in COLORS:
        r, g, b = (c / 255 for c in rgb(hexv))
        body = ustr(f"{label} #{hexv}") + b"RGB " + struct.pack(">fff", r, g, b) + struct.pack(">H", 2)
        blocks.append(struct.pack(">HI", 0x0001, len(body)) + body)
    blocks.append(struct.pack(">HI", 0xC002, 0))
    return b"ASEF" + struct.pack(">HHI", 1, 0, len(blocks)) + b"".join(blocks)


def export_palette():
    PALETTE_DIR.mkdir(exist_ok=True)
    css = ":root {\n" + "".join(f"  --afaq-{k}: #{h};\n" for k, _, h in COLORS) + "}\n"
    (PALETTE_DIR / "afaq-colors.css").write_text(css, encoding="utf-8")

    data = {k: f"#{h}" for k, _, h in COLORS}
    (PALETTE_DIR / "afaq-colors.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    tw = "@theme {\n" + "".join(f"  --color-afaq-{k}: #{h};\n" for k, _, h in COLORS) + "}\n"
    (PALETTE_DIR / "afaq-tailwind.css").write_text(tw, encoding="utf-8")

    gpl = "GIMP Palette\nName: AFAQ\nColumns: 7\n#\n" + "".join(
        "{:3d} {:3d} {:3d}\t{}\n".format(*rgb(h), label) for _, label, h in COLORS)
    (PALETTE_DIR / "afaq.gpl").write_text(gpl, encoding="utf-8")

    (PALETTE_DIR / "afaq.ase").write_bytes(ase_bytes())


FONT_FAMILIES = {
    "thmanyah-sans": "thmanyahsans-*",
    "thmanyah-serif-display": "thmanyahserifdisplay-*",
    "minecraft": "Minecraft.*",
    "unixel": "unixel-*",
}


def build_font_zips():
    out = FONTS / "zip"
    out.mkdir(exist_ok=True)
    for name, pattern in FONT_FAMILIES.items():
        with zipfile.ZipFile(out / f"{name}.zip", "w", zipfile.ZIP_DEFLATED) as z:
            for p in sorted(FONTS.glob(pattern)):
                z.write(p, Path(name) / p.name)


SITE = "https://afaq.club"
SKILL = BRAND / "skill"

# (family, weight, file stem, has woff2) — the families designs actually use.
FONT_FACES = [
    *[("Thmanyah Sans", w, f"thmanyahsans-{n}", True) for n, w in
      [("Light", 300), ("Regular", 400), ("Medium", 500), ("Bold", 700), ("Black", 900)]],
    *[("Thmanyah Serif Display", w, f"thmanyahserifdisplay-{n}", True) for n, w in
      [("Light", 300), ("Regular", 400), ("Medium", 500), ("Bold", 700), ("Black", 900)]],
    ("Minecraft", 400, "Minecraft", True),
    ("Unixel", 400, "unixel-Regular", False),
]


def font_face_css(base):
    rules = []
    for family, weight, stem, woff2 in FONT_FACES:
        src = [f'url("{base}{stem}.woff2") format("woff2")'] if woff2 else []
        src.append(f'url("{base}{stem}.ttf") format("truetype")')
        rules.append(
            f'@font-face {{ font-family: "{family}"; src: {", ".join(src)}; '
            f"font-weight: {weight}; font-style: normal; font-display: swap; }}"
        )
    return "/* AFAQ brand fonts. */\n" + "\n".join(rules) + "\n"


def build_font_css():
    """Hosted stylesheet so any page or tool can use the fonts with one <link>."""
    (FONTS / "afaq-fonts.css").write_text(font_face_css(f"{SITE}/brand/fonts/"), encoding="utf-8")


def build_skill_zip():
    """AI design skill: SKILL.md plus the fonts, with a CSS file that points at them locally."""
    root = Path("afaq-design-system")
    with zipfile.ZipFile(SKILL / "afaq-design-system.zip", "w", zipfile.ZIP_DEFLATED) as z:
        z.write(SKILL / "SKILL.md", root / "SKILL.md")
        z.writestr(str(root / "fonts" / "afaq-fonts.css"), font_face_css(""))
        for _, _, stem, woff2 in FONT_FACES:
            for ext in (["woff2"] if woff2 else []) + ["ttf"]:
                z.write(FONTS / f"{stem}.{ext}", root / "fonts" / f"{stem}.{ext}")


def build_zip():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for p in sorted(BRAND.rglob("*")):
            if p.is_file() and p.suffix != ".zip":
                z.write(p, Path("afaq-brand-kit") / p.relative_to(BRAND))
    (BRAND / "afaq-brand-kit.zip").write_bytes(buf.getvalue())


if __name__ == "__main__":
    export_logos()
    woff2_to_ttf()
    export_palette()
    build_font_zips()
    build_font_css()
    build_skill_zip()
    build_zip()
    print("brand kit built:", BRAND)
