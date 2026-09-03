import pymupdf
from pathlib import Path
out=Path('artifacts/claude-design/public/IH-Seeds-2026-Pasture-Seed-Guide.pdf')
doc=pymupdf.open()
green=(12/255,88/255,60/255); yellow=(249/255,182/255,23/255); black=(29/255,40/255,28/255); sage=(239/255,241/255,238/255)
pages=[
('2026 Pasture Seed Guide','Regional advice, sowing rates and seasonal planning for Western Australian growers.','Start with your rainfall zone, intended use and paddock history. Your local reseller can help fine-tune variety, blend and sowing rate.'),
('Choosing the right pasture','Match performance to the country you farm.','High rainfall: consider perennial ryegrass and clover combinations. Medium rainfall: robust annual ryegrass, serradella and tailored pasture mixes. Lower rainfall: early-maturing, persistent options chosen around feed demand.'),
('Plan before the break','Good establishment starts before seed reaches the ground.','Confirm weed control, seedbed condition, soil constraints and the likely sowing window. Check weekly availability early, then speak with IH Seeds for current regional advice and reseller support.')
]
for i,(title,subtitle,body) in enumerate(pages):
 p=doc.new_page(width=595,height=842)
 p.draw_rect(p.rect,color=None,fill=(1,1,1))
 p.draw_rect((0,0,595,120),color=None,fill=green)
 p.insert_text((44,63),'IH',fontsize=28,fontname='hebo',color=yellow)
 p.insert_text((86,63),'Seeds',fontsize=24,fontname='hebo',color=(1,1,1))
 p.insert_text((44,91),'IRWIN HUNTER & CO',fontsize=8,fontname='hebo',color=(1,1,1))
 p.insert_textbox((44,170,540,300),title,fontsize=34,fontname='hebo',color=green,lineheight=1.15)
 p.insert_textbox((44,285,540,380),subtitle,fontsize=18,fontname='helv',color=black,lineheight=1.35)
 p.draw_rect((44,400,551,620),color=None,fill=sage)
 p.insert_textbox((68,438,525,575),body,fontsize=13,fontname='helv',color=black,lineheight=1.55)
 p.insert_text((44,790),f'IH Seeds • Western Australia                                            {i+1}',fontsize=9,fontname='helv',color=green)
doc.save(out)
print(out, out.stat().st_size)
