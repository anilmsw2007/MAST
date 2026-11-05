import os
from PIL import Image, ImageDraw, ImageFont

def create_english_promotional_banner():
    # 1280 x 720 HD Landscape Promo Banner
    width = 1280
    height = 720
    
    # Base Image with deep navy-slate background
    img = Image.new('RGB', (width, height), color='#090d16')
    draw = ImageDraw.Draw(img)
    
    # 1. Background Gradient & Tech Ambiance
    for y in range(height):
        ratio = y / height
        # Gradient from deep dark navy (#090d16) to rich slate navy (#131c2e)
        r = int(9 + ratio * 12)
        g = int(13 + ratio * 16)
        b = int(22 + ratio * 26)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
        
    # Subtle ambient glow circles (orange & cyan accents)
    for radius in range(260, 0, -20):
        alpha_color = (25 + int(radius/10), 18, 15)
        draw.ellipse([width - 320 - radius, -100 - radius, width - 320 + radius, -100 + radius], fill=alpha_color)
    
    # Top horizontal accent border
    draw.rectangle([(0, 0), (width, 6)], fill='#f97316')
    
    # Fonts
    font_dir = "C:/Windows/Fonts"
    try:
        font_brand = ImageFont.truetype(os.path.join(font_dir, "segoeuib.ttf"), 42)
        font_brand_sub = ImageFont.truetype(os.path.join(font_dir, "segoeuib.ttf"), 14)
        font_tagline = ImageFont.truetype(os.path.join(font_dir, "segoeuib.ttf"), 22)
        font_subtag = ImageFont.truetype(os.path.join(font_dir, "segoeui.ttf"), 15)
        
        font_card_head = ImageFont.truetype(os.path.join(font_dir, "segoeuib.ttf"), 18)
        font_card_sub = ImageFont.truetype(os.path.join(font_dir, "segoeuib.ttf"), 13)
        font_bullet = ImageFont.truetype(os.path.join(font_dir, "segoeui.ttf"), 13)
        font_badge = ImageFont.truetype(os.path.join(font_dir, "segoeuib.ttf"), 11)
        font_cta = ImageFont.truetype(os.path.join(font_dir, "segoeuib.ttf"), 16)
        font_cta_sub = ImageFont.truetype(os.path.join(font_dir, "segoeui.ttf"), 13)
    except Exception as e:
        print("Font fallback:", e)
        font_brand = font_tagline = font_card_head = font_bullet = ImageFont.load_default()

    # 2. Header Area
    # App Logo Badge (Rounded square with orange gradient)
    draw.rounded_rectangle([50, 24, 114, 88], radius=16, fill='#ea580c', outline='#fdba74', width=2)
    # White 'M' monogram
    draw.text((68, 30), "M", fill='#ffffff', font=font_brand)
    
    # App Title
    draw.text((130, 24), "MAST Life OS", fill='#ffffff', font=font_brand)
    
    # Badges next to title
    draw.rounded_rectangle([390, 32, 530, 58], radius=13, fill='#1e293b', outline='#ea580c', width=1)
    draw.text((404, 38), "ALL-IN-ONE APP", fill='#fb923c', font=font_brand_sub)
    
    draw.rounded_rectangle([542, 32, 715, 58], radius=13, fill='#064e3b', outline='#10b981', width=1)
    draw.text((556, 38), "100% PRIVATE & SAFE", fill='#34d399', font=font_brand_sub)

    draw.rounded_rectangle([727, 32, 915, 58], radius=13, fill='#1e1b4b', outline='#6366f1', width=1)
    draw.text((741, 38), "ENGLISH & HINDI (EN/HI)", fill='#a5b4fc', font=font_brand_sub)

    # Subtitle / Value Proposition
    draw.text((132, 70), "The Complete Family Digital Operating System & Safe School Bus Tracking Platform", fill='#94a3b8', font=font_subtag)

    # 3. Six Core Feature Cards (3 columns x 2 rows)
    cards = [
        {
            "tag": "TRANSPORT & SAFETY",
            "tag_color": "#f97316",
            "title": "Smart School Bus Live GPS",
            "border": "#ea580c",
            "bullets": [
                "• Live GPS vehicle location & real-time ETA calculation",
                "• Driver Duty Status (Parked at Night / Active on Route)",
                "• Conductor attendance roster & student boarding logs",
                "• Zero hardware installation cost for schools"
            ]
        },
        {
            "tag": "FAMILY HEALTHCARE",
            "tag_color": "#ef4444",
            "title": "Medicine Vault & Follow-ups",
            "border": "#dc2626",
            "bullets": [
                "• Full prescription & 10-day medicine course tracker",
                "• Next doctor re-visit & consultation reminders",
                "• Low-stock medicine refill alerts 1 day before expiry",
                "• Emergency SOS quick dial (112, 108 & Family Contacts)"
            ]
        },
        {
            "tag": "ASSET PROTECTION",
            "tag_color": "#38bdf8",
            "title": "Locker & Warranty Vault",
            "border": "#0284c7",
            "bullets": [
                "• Appliance bills & warranty expiry notifications",
                "• 22K/24K Gold & Jewelry locker with live valuation",
                "• Encrypted document safe (RC, Insurance, Aadhaar)",
                "• Never lose a purchase receipt or warranty claim again"
            ]
        },
        {
            "tag": "DAILY PRODUCTIVITY",
            "tag_color": "#a855f7",
            "title": "Today's Tasks & Reminders",
            "border": "#7c3aed",
            "bullets": [
                "• Morning 'Today's Priorities' card with 1-tap [OK] checks",
                "• Birthday & Wedding Anniversary auto-sync alerts",
                "• Monthly utility bills, EMI & recurring dues planner",
                "• Family chore delegation & morning status updates"
            ]
        },
        {
            "tag": "SCHOOL & EDTECH",
            "tag_color": "#10b981",
            "title": "School Fee & Notice Hub",
            "border": "#059669",
            "bullets": [
                "• Transparent student fee status & instant receipts",
                "• Digital school notice board & holiday calendar",
                "• Direct intercom bridge between school & parents",
                "• Multi-child student profile management"
            ]
        },
        {
            "tag": "ENTERPRISE PRIVACY",
            "tag_color": "#eab308",
            "title": "Offline-First & True Bilingual",
            "border": "#d97706",
            "bullets": [
                "• 1-Tap instant switch between English and Hindi",
                "• Works seamlessly offline with cloud auto-sync",
                "• Bank-grade encrypted storage on your phone",
                "• Clean, clutter-free, responsive high-speed UI"
            ]
        }
    ]

    # Grid Layout: 3 columns x 2 rows
    # Margins: Left=50, Right=1230, Available=1180 -> Width per card ~377, gap ~24
    card_w = 377
    card_h = 245
    col_x = [50, 451, 852]
    row_y = [108, 375]

    for idx, c in enumerate(cards):
        col = idx % 3
        row = idx // 3
        x1 = col_x[col]
        y1 = row_y[row]
        x2 = x1 + card_w
        y2 = y1 + card_h
        
        # Background container
        draw.rounded_rectangle([x1, y1, x2, y2], radius=14, fill='#131c2e', outline='#23334d', width=1)
        
        # Top color accent stripe
        draw.rounded_rectangle([x1+12, y1, x1+65, y1+4], radius=2, fill=c["border"])
        
        # Category Tag Badge
        tag_width = len(c["tag"]) * 7.5 + 16
        draw.rounded_rectangle([x1+16, y1+14, x1+16+tag_width, y1+34], radius=6, fill='#1e293b')
        draw.text((x1+24, y1+18), c["tag"], fill=c["tag_color"], font=font_badge)
        
        # Card Title
        draw.text((x1+16, y1+42), c["title"], fill='#ffffff', font=font_card_head)
        
        # Divider line
        draw.line([(x1+16, y1+72), (x2-16, y1+72)], fill='#1e293b', width=1)
        
        # Bullets
        cur_y = y1 + 82
        for b in c["bullets"]:
            draw.text((x1+16, cur_y), b, fill='#cbd5e1', font=font_bullet)
            cur_y += 36

    # 4. Bottom Call-To-Action (CTA) Bar
    cta_y1 = 638
    cta_y2 = 702
    draw.rounded_rectangle([50, cta_y1, 1230, cta_y2], radius=14, fill='#1e293b', outline='#ea580c', width=2)
    
    # Left CTA text
    draw.text((75, cta_y1 + 13), "Ready for School Demo & Everyday Family Life!", fill='#fed7aa', font=font_cta)
    draw.text((75, cta_y1 + 35), "Empowering parents with total peace of mind & schools with zero-cost modern transport tech.", fill='#94a3b8', font=font_cta_sub)
    
    # Right Button Badge
    btn_x1 = 980
    btn_x2 = 1210
    draw.rounded_rectangle([btn_x1, cta_y1 + 10, btn_x2, cta_y2 - 10], radius=10, fill='#ea580c', outline='#fdba74', width=1)
    draw.text((btn_x1 + 30, cta_y1 + 18), "GET THE APP", fill='#ffffff', font=font_cta)

    # Save
    out_path = "E:/MAST/docs/MAST_English_Promo_Banner.png"
    img.save(out_path, quality=95)
    print("English promotional banner generated successfully at:", out_path)

if __name__ == "__main__":
    create_english_promotional_banner()
