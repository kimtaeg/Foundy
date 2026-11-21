"""Compare screenshots and visible-page text from capture-parity.mjs."""
import json
import sys
from pathlib import Path
from PIL import Image, ImageChops

root = Path(__file__).resolve().parents[1]
baseline = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'work' / 'baseline'
migrated = Path(sys.argv[2]) if len(sys.argv) > 2 else root / 'work' / 'migrated'
output = migrated / 'comparison'
output.mkdir(parents=True, exist_ok=True)
a = json.loads((baseline / 'manifest.json').read_text())
b = json.loads((migrated / 'manifest.json').read_text())
by_key = {(p['viewport'], p['route']): p for p in b['pages']}
report = []
for original in a['pages']:
    key = original['viewport'], original['route']
    actual = by_key.get(key)
    row = {'viewport': key[0], 'route': key[1]}
    if not actual:
        row['missing'] = True
        report.append(row)
        continue
    row['textEqual'] = original['text'] == actual['text']
    row['styleDifferences'] = {
        selector: {'original': value, 'migrated': actual['elements'].get(selector)}
        for selector, value in original['elements'].items()
        if value != actual['elements'].get(selector)
    }
    ia = Image.open(baseline / original['filename']).convert('RGB')
    ib = Image.open(migrated / actual['filename']).convert('RGB')
    row['originalSize'], row['migratedSize'] = list(ia.size), list(ib.size)
    width, height = max(ia.width, ib.width), max(ia.height, ib.height)
    ca, cb = Image.new('RGB', (width, height), 'white'), Image.new('RGB', (width, height), 'white')
    ca.paste(ia, (0, 0)); cb.paste(ib, (0, 0))
    delta = ImageChops.difference(ca, cb)
    pixels = list(delta.getdata())
    changed = sum(max(pixel) > 12 for pixel in pixels)
    row['changedPixelRatio'] = round(changed / (width * height), 6)
    row['exact'] = delta.getbbox() is None
    if not row['exact']:
        delta.save(output / original['filename'])
    report.append(row)
(output / 'report.json').write_text(json.dumps({'pages': report, 'originalErrors': a['errors'], 'migratedErrors': b['errors']}, ensure_ascii=False, indent=2))
for row in report:
    print(f"{row['viewport']:7} {row['route']:10} text={row.get('textEqual')} pixels={row.get('changedPixelRatio')} styles={len(row.get('styleDifferences', {}))}")
print(output / 'report.json')
