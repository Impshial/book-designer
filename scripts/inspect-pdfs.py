"""Independent checks for the sample PDFs; requires pypdf (development only)."""
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader

results = []
for name, dimensions, occurrences in [
    ('picture-book', (612, 612), 0),
    ('text-only', (432, 648), 24),
    ('hybrid', (432, 648), 16),
]:
    path = Path('output/pdf') / f'{name}-proof.pdf'
    reader = PdfReader(path)
    text = re.sub(r'\s+', ' ', ' '.join(page.extract_text() for page in reader.pages))
    if occurrences:
        assert text.count('Mira found the little door') == occurrences, name
    else:
        assert 'Somewhere' in text and 'Made to travel.' in text
    font_references = 0
    image_references = 0
    for page in reader.pages:
        assert (float(page.mediabox.width), float(page.mediabox.height)) == dimensions
        assert tuple(page.trimbox) == tuple(page.mediabox)
        for font in page['/Resources'].get('/Font', {}).values():
            font = font.get_object()
            if '/DescendantFonts' in font:
                font = font['/DescendantFonts'][0].get_object()
            descriptor = font['/FontDescriptor'].get_object()
            assert '/FontFile2' in descriptor or '/FontFile3' in descriptor
            font_references += 1
        for resource in page['/Resources'].get('/XObject', {}).values():
            resource = resource.get_object()
            if resource.get('/Subtype') == '/Image':
                assert resource['/Width'] > 0 and resource['/Height'] > 0
                image_references += 1
    if name == 'picture-book':
        assert image_references > 0
    results.append(dict(file=path.name, pages=len(reader.pages), dimensions_points=dimensions,
                        embedded_font_references=font_references, image_references=image_references,
                        text_occurrences=occurrences, sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
Path('output/independent-pdf-checks.json').write_text(json.dumps(results, indent=2))
print(json.dumps(results, indent=2))
