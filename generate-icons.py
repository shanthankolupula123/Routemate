import os
from PIL import Image, ImageDraw

src_path = r"C:\Users\shant\.gemini\antigravity\brain\4cc4e24b-bce8-4f27-bff1-2df7ff89047b\.user_uploaded\media_1791264145672.jpg"
res_base = os.path.join(os.path.dirname(__file__), "android", "app", "src", "main", "res")

img = Image.open(src_path).convert("RGBA")

# Ensure image is square
w, h = img.size
size = max(w, h)
square_img = Image.new("RGBA", (size, size), (255, 255, 255, 255))
offset_x = (size - w) // 2
offset_y = (size - h) // 2
square_img.paste(img, (offset_x, offset_y))

# Also copy high-res logo to web assets
assets_dir = os.path.join(os.path.dirname(__file__), "www")
os.makedirs(assets_dir, exist_ok=True)
square_img.save(os.path.join(assets_dir, "app-logo.png"), "PNG")
square_img.save(os.path.join(os.path.dirname(__file__), "app-logo.png"), "PNG")

icon_sizes = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192
}

fg_sizes = {
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432
}

def create_round_icon(base_icon):
    w, h = base_icon.size
    mask = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(mask)
    draw.ellipse((0, 0, w, h), fill=255)
    rounded = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    rounded.paste(base_icon, (0, 0), mask=mask)
    return rounded

# 1. Generate regular and round mipmap icons
for folder, sz in icon_sizes.items():
    folder_path = os.path.join(res_base, folder)
    os.makedirs(folder_path, exist_ok=True)
    
    resized = square_img.resize((sz, sz), Image.Resampling.LANCZOS)
    resized.save(os.path.join(folder_path, "ic_launcher.png"), "PNG")
    
    rounded = create_round_icon(resized)
    rounded.save(os.path.join(folder_path, "ic_launcher_round.png"), "PNG")
    print(f"Generated {folder}/ic_launcher.png & ic_launcher_round.png ({sz}x{sz})")

# 2. Generate adaptive icon foregrounds
for folder, sz in fg_sizes.items():
    folder_path = os.path.join(res_base, folder)
    os.makedirs(folder_path, exist_ok=True)
    
    # Adaptive icon foreground has safe zone in center (66%)
    inner_sz = int(sz * 0.72)
    inner_logo = square_img.resize((inner_sz, inner_sz), Image.Resampling.LANCZOS)
    
    fg_canvas = Image.new("RGBA", (sz, sz), (255, 255, 255, 0))
    pos = ((sz - inner_sz) // 2, (sz - inner_sz) // 2)
    fg_canvas.paste(inner_logo, pos)
    fg_canvas.save(os.path.join(folder_path, "ic_launcher_foreground.png"), "PNG")
    print(f"Generated {folder}/ic_launcher_foreground.png ({sz}x{sz})")

# 3. Generate Splash screens
splash_sizes = {
    "drawable": (480, 800),
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (960, 1600),
    "drawable-port-xxxhdpi": (1280, 1920),
    "drawable-land-mdpi": (480, 320),
    "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-land-xxhdpi": (1600, 960),
    "drawable-land-xxxhdpi": (1920, 1280)
}

for folder, (sw, sh) in splash_sizes.items():
    folder_path = os.path.join(res_base, folder)
    os.makedirs(folder_path, exist_ok=True)
    
    splash_canvas = Image.new("RGBA", (sw, sh), (255, 255, 255, 255))
    logo_sz = min(sw, sh) // 2
    logo_resized = square_img.resize((logo_sz, logo_sz), Image.Resampling.LANCZOS)
    pos = ((sw - logo_sz) // 2, (sh - logo_sz) // 2)
    splash_canvas.paste(logo_resized, pos, logo_resized)
    splash_canvas.save(os.path.join(folder_path, "splash.png"), "PNG")
    print(f"Generated {folder}/splash.png ({sw}x{sh})")

print("All Android app logos and splash screens generated successfully!")
