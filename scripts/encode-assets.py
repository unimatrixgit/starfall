from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1] / 'dist'
for name in ['resources', 'race-banners', 'alliance-structures']:
    with Image.open(root / 'assets' / (name + '.png')) as artwork:
        artwork.save(root / 'assets' / (name + '.webp'), 'WEBP', lossless=True, method=6)
for filename in ['index.html', 'game.js']:
    target = root / filename
    source = target.read_text(encoding='utf-8')
    for name in ['resources', 'race-banners', 'alliance-structures']:
        source = source.replace(name + '.png', name + '.webp')
    target.write_text(source, encoding='utf-8')
