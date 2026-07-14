from __future__ import annotations

import concurrent.futures, hashlib, html, json, re, time, urllib.parse, urllib.request
from pathlib import Path

OUT=Path('pharmassist-output-v3'); IMG=OUT/'images'; OUT.mkdir(exist_ok=True); IMG.mkdir(exist_ok=True)
VERIFY='https://pharmassist-product-verify-20260714.vercel.app/api/item'
IMAGE='https://pharmassist-image-proxy-20260714.vercel.app/api/image'
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 PharmAssistResearch/3.0'
CANDIDATES=[
 ('타이레놀정500mg','2021082400002'),('이지엔6이브연질캡슐','2013011800015'),
 ('어린이부루펜시럽(80mL)','A11A0500A0154'),('타세놀정500mg','2015071700001'),
 ('타세놀8시간이알서방정','A11ALLLLL0032'),('지르텍정','A11ABBBBB2527'),
 ('클라리틴정','2009091800015'),('액티피드정','A11A0500A0068'),
 ('뮤테란캡슐200mg','A11A1530A0114'),('뮤코펙트정','2009071505405'),
 ('모드콜에스연질캡슐','2012050900002'),('타이레놀콜드에스정','2021101800010'),
 ('화이투벤큐노즈연질캡슐','2013010400010'),('화이투벤씨플러스캡슐','2013010700008'),
 ('겔포스엠현탁액','A11A0930A0424'),('훼스탈플러스정','A11A0740B0009'),
 ('보나링츄어블정','2016021200001'),('디옥타현탁액','A11AKP08G3845'),
 ('로프민캡슐','A11A1660A0057'),('둘코락스에스장용정','2009092300055')]
ING={
 'Acetaminophen':'아세트아미노펜','Ibuprofen':'이부프로펜','Pamabrom':'파마브롬','Cetirizine Hydrochloride':'세티리진염산염','Loratadine':'로라타딘','Pseudoephedrine Hydrochloride':'슈도에페드린염산염','Triprolidine Hydrochloride Hydrate':'트리프롤리딘염산염수화물','Acetylcysteine':'아세틸시스테인','Ambroxol Hydrochloride':'암브록솔염산염','Dextromethorphan Hydrobromide Hydrate':'덱스트로메토르판브롬화수소산염수화물','Chlorpheniramine Maleate':'클로르페니라민말레산염','DL-Methylephedrine Hydrochloride':'DL-메틸에페드린염산염','Guaifenesin':'구아이페네신','Simethicone':'시메티콘','Aluminum Phosphate Gel.':'인산알루미늄겔','Magnesium Hydroxide':'수산화마그네슘','Cellulase':'셀룰라제','Pancreatin':'판크레아틴','Ursodeoxycholic Acid':'우르소데옥시콜산','Dimenhydrinate':'디멘히드리네이트','Scopolamine Hydrobromide Hydrate':'스코폴라민브롬화수소산염수화물','Dioctahedral Smectite':'디오스멕타이트','Loperamide Hydrochloride':'로페라미드염산염','Bisacodyl':'비사코딜','Docusate Sodium':'도큐세이트나트륨','Caffeine Anhydrous':'카페인무수물','Cloperastine Hydrochloride':'클로페라스틴염산염','Ascorbic Acid':'아스코르브산','Riboflavin':'리보플라빈','Thiamine Nitrate':'티아민질산염'}
ALIASES={'디오스멕타이트':['디옥타헤드랄스멕타이트','디옥타헤드랄스멕타이트','디오스멕타이트']}

def clean(s):
    s=re.sub(r'(?i)<br\s*/?>',' ',s or '')
    s=re.sub(r'(?s)<[^>]+>',' ',s)
    return re.sub(r'\s+',' ',html.unescape(s).replace('\u3000',' ')).strip()

def norm(s):
    s=html.unescape(s or '')
    s=re.sub(r'(주식회사|유한회사|\(주\)|㈜|주\)|\(유\)|유\))','',s)
    s=s.replace('밀리그람','mg').replace('밀리그램','mg').replace('㎎','mg')
    return re.sub(r'[^0-9A-Za-z가-힣]+','',s).lower()

def core(s): return norm(re.sub(r'\([^)]*\)','',s or ''))

def get(url,accept='application/json',tries=3):
    last=None
    for n in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA,'Accept':accept}),timeout=75) as r:
                return r.status,dict(r.headers.items()),r.read()
        except Exception as e:
            last=e; time.sleep(n+1)
    raise last

def parse_ingredients(detail_sunb, search_ingr):
    raw=clean(detail_sunb or search_ingr or '').replace('@|','|').replace('@','|')
    out=[]
    for seg in [x.strip() for x in raw.split('|') if x.strip()]:
        hit=next((x for x in sorted(ING,key=len,reverse=True) if seg.lower().startswith(x.lower())),None)
        if hit:
            rest=seg[len(hit):].strip()
            ko=ING[hit]
            if rest.startswith(ko): rest=rest[len(ko):].strip()
            out.append({'name_en':hit,'name_ko':ko,'strength_text':rest})
    return out

def numbers(s): return [x.lstrip('0') or '0' for x in re.findall(r'\d+(?:\.\d+)?',s or '')]

def ingredient_ok(section,ing):
    names=[ing['name_ko']]+ALIASES.get(ing['name_ko'],[])
    if not any(norm(x) in norm(section) for x in names): return False
    nums=set(numbers(section))
    for n in numbers(ing['strength_text']):
        variants={n,n.rstrip('0').rstrip('.')} if '.' in n else {n}
        if not any(v in nums for v in variants): return False
    return True

def split_urls(v): return [x.strip() for x in re.split(r'[|@]',v or '') if x.strip().startswith('http')]

def one(c):
    q,drug=c; rec={'candidate':{'name':q,'drug_cd':drug},'errors':[],'exclusion_reasons':[]}
    try:
        u=VERIFY+'?'+urllib.parse.urlencode({'q':q,'drug_cd':drug})
        st,_,b=get(u); data=json.loads(b.decode('utf-8','replace')); rec['verifier_http_status']=st; rec['verified_data']=data
        h=data['health']; m=data['mfds']; item=h['item']; row=m.get('row'); hdr=m.get('header') or {}; section=m.get('ingredient_section') or ''
        item_seq=str(item.get('kfda_code') or ''); rec['item_seq']=item_seq
        if not re.fullmatch(r'\d{9}',item_seq): rec['exclusion_reasons'].append('품목기준코드가 9자리가 아님')
        if h.get('search_status')!=200 or h.get('detail_status')!=200: rec['exclusion_reasons'].append('약학정보원 HTTP 검증 실패')
        if m.get('search_status')!=200 or m.get('detail_status')!=200: rec['exclusion_reasons'].append('식약처 HTTP 검증 실패')
        if not row: rec['exclusion_reasons'].append('식약처 품목기준코드 검색 결과 없음')
        else:
            if row.get('permit_status')!='정상': rec['exclusion_reasons'].append('식약처 허가 상태가 정상이 아님')
            if row.get('otc_label')!='일반의약품': rec['exclusion_reasons'].append('식약처 일반의약품 표시 불일치')
        if item.get('drug_class')!='일반': rec['exclusion_reasons'].append('약학정보원 일반의약품 표시 불일치')
        official=hdr.get('display_name') or (row or {}).get('display_name') or ''
        health_name=item.get('drug_name') or ''
        rec['name_match']=core(official)==core(health_name) or core(official).startswith(core(health_name)) or core(health_name).startswith(core(official))
        if not rec['name_match']: rec['exclusion_reasons'].append(f'제품명 불일치: MFDS={official!r}, Health.kr={health_name!r}')
        mf_manu=hdr.get('manufacturer') or (row or {}).get('manufacturer') or ''; h_manu=item.get('upso_name_kfda') or ''
        rec['manufacturer_match']=norm(mf_manu)==norm(h_manu)
        if not rec['manufacturer_match']: rec['exclusion_reasons'].append(f'제조사 불일치: MFDS={mf_manu!r}, Health.kr={h_manu!r}')
        d=h.get('detail') or {}; ingredients=parse_ingredients(d.get('sunb'),item.get('ingr_mg'))
        rec['parsed_ingredients']=ingredients
        rec['ingredient_strength_match']=bool(ingredients) and all(ingredient_ok(section,x) for x in ingredients)
        if not rec['ingredient_strength_match']: rec['exclusion_reasons'].append('식약처와 약학정보원 성분·함량 교차검증 실패')
        urls=split_urls(item.get('pack_img')) or split_urls(d.get('pack_img')) or split_urls(item.get('drug_pic')) or split_urls(d.get('drug_pic'))
        rec['candidate_image_urls']=urls
        if not urls: rec['exclusion_reasons'].append('제품 이미지 URL 없음')
        else:
            iu=IMAGE+'?'+urllib.parse.urlencode({'url':urls[0]}); ist,heads,ib=get(iu,'image/avif,image/webp,image/apng,image/*,*/*;q=0.8')
            if ib[:2]==b'\xff\xd8': ct,ext='image/jpeg','jpg'
            elif ib[:8]==b'\x89PNG\r\n\x1a\n': ct,ext='image/png','png'
            elif ib[:4]==b'RIFF' and ib[8:12]==b'WEBP': ct,ext='image/webp','webp'
            else: raise ValueError('unsupported image signature')
            p=IMG/f'{item_seq}.{ext}'; p.write_bytes(ib)
            rec['image']={'source_url':urls[0],'proxy_http_status':ist,'content_type':ct,'local_file':'images/'+p.name,'bytes':len(ib),'sha256':hashlib.sha256(ib).hexdigest()}
        rec['automated_eligible']=not rec['exclusion_reasons'] and bool(rec.get('image'))
    except Exception as e:
        rec['errors'].append(repr(e)); rec['exclusion_reasons'].append('검증 API 또는 이미지 수집 실패')
    return rec

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex: results=list(ex.map(one,CANDIDATES))
for r in results: print(r['candidate']['name'], 'OK' if r.get('automated_eligible') else 'EXCLUDE', '; '.join(r.get('exclusion_reasons',[])),flush=True)
(OUT/'research.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
summary={'candidate_count':len(results),'automated_eligible_count':sum(bool(x.get('automated_eligible')) for x in results),'downloaded_image_count':len(list(IMG.glob('*'))),'generated_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
(OUT/'workflow-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False),flush=True)
