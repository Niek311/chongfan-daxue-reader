import os
import sys
import json
import pymupdf
import time

def extract_novel_pdf(pdf_path, out_dir):
    chapters_md_dir = os.path.join(out_dir, 'chapters')
    chapters_json_dir = os.path.join(out_dir, 'data', 'chapters')

    os.makedirs(chapters_md_dir, exist_ok=True)
    os.makedirs(chapters_json_dir, exist_ok=True)

    t0 = time.time()
    doc = pymupdf.open(pdf_path)
    toc = doc.get_toc()

    print(f'Starting extraction of {len(toc)} chapters from {pdf_path}...')

    toc_list = []

    for idx in range(len(toc)):
        lvl, title, start_page = toc[idx]
        end_page = (toc[idx+1][2] - 1) if idx + 1 < len(toc) else len(doc)
        
        paragraphs = []
        current_para = ''
        
        for p in range(start_page - 1, end_page):
            page = doc[p]
            blocks = page.get_text('blocks')
            body_blocks = [b for b in blocks if b[1] >= 40 and b[3] <= 790]
            body_blocks.sort(key=lambda b: (b[1], b[0]))
            
            for b in body_blocks:
                text = b[4].strip()
                if not text:
                    continue
                x0 = b[0]
                if x0 >= 65:
                    if current_para:
                        paragraphs.append(current_para)
                    current_para = text.replace('\n', '')
                else:
                    if current_para:
                        current_para += text.replace('\n', '')
                    else:
                        current_para = text.replace('\n', '')
        if current_para:
            paragraphs.append(current_para)
            
        body_paras = []
        if paragraphs and (paragraphs[0].strip() == title.strip() or title.strip().startswith(paragraphs[0].strip()[:10])):
            body_paras = paragraphs[1:]
        else:
            body_paras = paragraphs
            
        word_count = sum(len(p) for p in body_paras)
        ch_id = idx + 1
        
        # Markdown
        md_filename = f'chapter_{ch_id:04d}.md'
        md_content = f'# {title}\n\n' + '\n\n'.join(body_paras)
        with open(os.path.join(chapters_md_dir, md_filename), 'w', encoding='utf-8') as f:
            f.write(md_content)
            
        # JSON
        ch_data = {
            'id': ch_id,
            'title': title,
            'wordCount': word_count,
            'paragraphs': body_paras
        }
        with open(os.path.join(chapters_json_dir, f'{ch_id}.json'), 'w', encoding='utf-8') as f:
            json.dump(ch_data, f, ensure_ascii=False)
            
        toc_list.append({
            'id': ch_id,
            'title': title,
            'wordCount': word_count
        })

    meta = {
        'title': '重返大学：她们都想圈养我',
        'author': '秋收十月',
        'totalChapters': len(toc),
        'description': '【传统向都市文，非脑洞】【都市日常】+【无系统】+【不修仙】+【青春校园】+【商业赚钱】。别人重生当渣男，赵今安重生，前准岳母娘pua他....她们都想欺负他，想把他当养成系男友来养。',
        'chapters': toc_list
    }

    with open(os.path.join(out_dir, 'data', 'book.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f'Successfully extracted {len(toc_list)} chapters in {time.time() - t0:.2f}s!')

if __name__ == '__main__':
    pdf_path = sys.argv[1] if len(sys.argv) > 1 else r'E:\Download\重返大学：她们都想圈养我.pdf'
    out_dir = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(__file__))
    extract_novel_pdf(pdf_path, out_dir)
