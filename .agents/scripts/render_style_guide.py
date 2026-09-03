import fitz
from pathlib import Path
path = Path('attached_assets/IH_Style_Guide_5Nov25_01_1788411933759.pdf')
doc = fitz.open(path)
print('pages', doc.page_count)
for index, page in enumerate(doc):
    pix = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
    out = Path('.agents/outputs') / f'ih-style-guide-{index+1}.png'
    pix.save(out)
    print(out, page.rect)
