from pathlib import Path
from PIL import Image, ImageDraw

HERE = Path(__file__).parent

for size in (192, 512):
    image = Image.new("RGBA", (size, size), "#345b43")
    draw = ImageDraw.Draw(image)
    s = size / 512
    def box(coords):
        return tuple(round(v * s) for v in coords)

    draw.rounded_rectangle(box((93, 95, 419, 425)), radius=round(50*s), fill="#ffffff")
    draw.rounded_rectangle(box((93, 95, 419, 174)), radius=round(50*s), fill="#d6e4d1")
    draw.rectangle(box((93, 148, 419, 174)), fill="#d6e4d1")
    for x in (168, 344):
        draw.rounded_rectangle(box((x-13, 74, x+13, 131)), radius=round(12*s), fill="#ffffff")
    colors = ["#d7a84d", "#86a7d0", "#b89ac0", "#8cad91"]
    for n, (x, y) in enumerate(((139, 222), (267, 222), (139, 331), (267, 331))):
        draw.rounded_rectangle(box((x, y, x+105, y+72)), radius=round(14*s), fill=colors[n])
    image.save(HERE / f"icon-{size}.png")
