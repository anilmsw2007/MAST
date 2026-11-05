import os
from PIL import Image, ImageDraw, ImageFont

def create_promotional_banner():
    # Banner dimensions: 1200 x 630 (Standard high-res social / WhatsApp share landscape card)
    width = 1200
    height = 630
    
    # Create image
    img = Image.new('RGB', (width, height), color='#0f172a')
    draw = ImageDraw.Draw(img)
    
    # 1. Background Gradient / Shapes
    # Orange hero left accent
    for y in range(height):
        # subtle gradient from #0f172a to #1e293b
        ratio = y / height
        r = int(15 + ratio * 15)
        g = int(23 + ratio * 18)
        b = int(42 + ratio * 20)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
        
    # Top curved glow banner
    draw.polygon([(0, 0), (width, 0), (width, 22), (0, 22)], fill='#f97316')
    
    # Decorative glow circle on bottom right
    draw.ellipse([850, 300, 1350, 800], fill='#1e293b', outline='#ea580c', width=2)
    draw.ellipse([880, 330, 1320, 770], fill='#0f172a', outline='#f97316', width=1)

    # 2. Fonts
    font_dir = "C:/Windows/Fonts"
    try:
        font_logo = ImageFont.truetype(os.path.join(font_dir, "segoeuib.ttf"), 46)
        font_sublogo = ImageFont.truetype(os.path.join(font_dir, "segoeui.ttf"), 16)
        font_tagline = ImageFont.truetype(os.path.join(font_dir, "NIRMALA.TTF"), 26)
        font_feature_title = ImageFont.truetype(os.path.join(font_dir, "NIRMALAB.TTF"), 20)
        font_feature_desc = ImageFont.truetype(os.path.join(font_dir, "NIRMALA.TTF"), 16)
        font_badge = ImageFont.truetype(os.path.join(font_dir, "segoeuib.ttf"), 14)
        font_footer = ImageFont.truetype(os.path.join(font_dir, "NIRMALA.TTF"), 15)
    except Exception as e:
        print("Fallback font due to:", e)
        font_logo = ImageFont.load_default()
        font_sublogo = font_logo
        font_tagline = font_logo
        font_feature_title = font_logo
        font_feature_desc = font_logo
        font_badge = font_logo
        font_footer = font_logo

    # 3. Header Branding
    # App Icon Box
    draw.rounded_rectangle([60, 50, 130, 120], radius=18, fill='#ea580c', outline='#fdba74', width=2)
    draw.text((75, 58), "M", fill='#ffffff', font=font_logo)
    
    # App Title & Subtitle
    draw.text((150, 50), "MAST Life OS", fill='#ffffff', font=font_logo)
    draw.rounded_rectangle((480, 62, 640, 92), radius=15, fill='#fff7ed', outline='#ea580c', width=1)
    draw.text((495, 68), "PAN-INDIA 2026", fill='#c2410c', font=font_badge)
    draw.text((152, 105), "Family Digital Operating System & School Transport Safety", fill='#94a3b8', font=font_sublogo)

    # Tagline Banner (Devanagari)
    draw.text((60, 145), "हर परिवार और स्कूल की सुरक्षा, स्वास्थ्य व समय प्रबंधन का संपूर्ण समाधान", fill='#fed7aa', font=font_tagline)

    # 4. Feature Highlights Grid (4 Key Pillars)
    cards = [
        {
            "icon": "BUS",
            "box_color": "#ea580c",
            "title": "🚌 स्मार्ट स्कूल बस लाइव ट्रैकर",
            "desc": "पिकअप व दोपहर ड्रॉप रूट, 1-टैप ड्राइवर ड्यूटी, कंडक्टर उपस्थिति रोस्टर और लाइव ईटीए।"
        },
        {
            "icon": "LOCK",
            "box_color": "#0284c7",
            "title": "🗄️ फैमिली लॉकर व वारंटी वॉल्ट",
            "desc": "घरेलू सामान का बिल व वारंटी रिमाइंडर, 22K हॉलमार्क गोल्ड लॉकर व फैमिली डॉक्स।"
        },
        {
            "icon": "HEALTH",
            "box_color": "#e11d48",
            "title": "💊 मेडिसिन कोर्स व 🎂 जन्मदिन अलर्ट",
            "desc": "10-दिन रीफ़िल अलर्ट, डॉक्टर फॉलो-अप विज़िट, जन्मदिन, सालगिरह व मासिक बजट।"
        },
        {
            "icon": "SYNC",
            "box_color": "#16a34a",
            "title": "🌐 100% द्विभाषी व क्लाउड इंटरकॉम",
            "desc": "1-टैप में शुद्ध English / हिंदी अनुवाद, इमरजेंसी सायरन 112/108 और सुरक्षित क्लाउड सिंक।"
        }
    ]

    # Draw 4 cards in 2x2 grid
    coords = [
        (60, 205, 580, 355),    # Card 1 (Top Left)
        (620, 205, 1140, 355),  # Card 2 (Top Right)
        (60, 375, 580, 525),    # Card 3 (Bottom Left)
        (620, 375, 1140, 525)   # Card 4 (Bottom Right)
    ]

    for i, c in enumerate(cards):
        x1, y1, x2, y2 = coords[i]
        # Card background
        draw.rounded_rectangle([x1, y1, x2, y2], radius=16, fill='#1e293b', outline='#334155', width=1)
        # Left colored accent line
        draw.rounded_rectangle([x1, y1+10, x1+6, y2-10], radius=3, fill=c["box_color"])
        
        # Content
        draw.text((x1 + 22, y1 + 18), c["title"], fill='#ffffff', font=font_feature_title)
        draw.text((x1 + 22, y1 + 54), c["desc"], fill='#cbd5e1', font=font_feature_desc)

    # 5. Bottom Call-to-Action Bar
    draw.rounded_rectangle([60, 550, 1140, 605], radius=14, fill='#fff7ed', outline='#ea580c', width=2)
    draw.text((80, 566), "✨ कल स्कूल डेमो: अभिभावकों को बिना हार्डवेयर खर्च के मिले 100% मन की शांति और समय पर फीस सूचना", fill='#7c2d12', font=font_footer)
    draw.rounded_rectangle([970, 558, 1125, 597], radius=10, fill='#ea580c')
    draw.text((992, 568), "DEMO READY ✓", fill='#ffffff', font=font_badge)

    # Save Banner
    out_path = "E:/MAST/docs/MAST_Promotional_Banner.png"
    img.save(out_path, quality=95)
    print("Banner generated successfully at:", out_path)

if __name__ == "__main__":
    create_promotional_banner()
