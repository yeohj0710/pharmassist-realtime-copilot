from __future__ import annotations

import concurrent.futures, hashlib, html, http.cookiejar, json, re, struct, time, urllib.parse, urllib.request
from pathlib import Path

OUT=Path('pharmassist-output-v2'); IMG=OUT/'images'; OUT.mkdir(exist_ok=True); IMG.mkdir(exist_ok=True)
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 PharmAssistResearch/2.0'
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
 'Acetaminophen':'아세트아미노펜','Ibuprofen':'이부프로펜','Pamabrom':'파마브롬',
 'Cetirizine Hydrochloride':'세티리진염산염','Loratadine':'로라타딘',
 'Pseudoephedrine Hydrochloride':'슈도에페드린염산염','Triprolidine Hydrochloride Hydrate':'트리프롤리딘염산염수화물',
 'Acetylcysteine':'아세틸시스테인','Ambroxol Hydrochloride':'암브록솔염산염',
 'Dextromethorphan Hydrobromide Hydrate':'덱스트로메토르판브롬화수소산염수화물',
 'Chlorpheniramine Maleate':'클로르페니라민말레산염','DL-Methylephedrine Hydrochloride':'DL-메틸에페드린염산염',
 'Guaifenesin':'구아이페네신','Simethicone':'시메티콘','Aluminum Phosphate Gel.':'인산알루미늄겔',
 'Magnesium Hydroxide':'수산화마그네슘','Cellulase':'셀룰라제','Pancreatin':'판크레아틴',
 'Ursodeoxycholic Acid':'우르소데옥시콜산','Dimenhydrinate':'디멘히드리네이트',
 'Scopolamine Hydrobromide Hydrate':'스코폴라민브롬화수소산염수화물',
 'Dioctahedral Smectite':'디오스멕타이트','Loperamide Hydrochloride':'로페라미드염산염',
 'Bisacodyl':'비사코딜','Docusate Sodium':'도큐세이트나트륨','Caffeine Anhydrous':'카페인무수물',
 'Cloperastine Hydrochloride':'클로페라스틴염산염','Ascorbic Acid':'아스코르브산',
 'Riboflavin':'리보플라빈','Thiamine Nitrate':'티아민질산염'}


def clean(s):
    s=re.sub(r'(?is)<script.*?</script>|<style.*?</style>',' ',s or '')
    s=re.sub(r'(?i)<br\s*/?>',' ',s); s=re.sub(r'(?s)<[^>]+>',' ',s)
    return re.sub(r'\s+',' ',html.unescape(s)).strip()

def norm(s):
    s=html.unescape(s or '')
    s=re.sub(r'(주식회사|유한회사|\(주\)|㈜|주\)|\(유\)|유\))','',s)
    s=s.replace('밀리그람','mg').replace('밀리그램','mg').replace('㎎','mg')
    return re.sub(r'[^0-9A-Za-z가-힣]+','',s).lower()

def name_core(s):
    s=re.sub(r'\([^)]*\)','',s or '')
    return norm(s)

def opener():
    return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

def request(op,url,method='GET',data=None,referer=None,accept='*/*',tries=3):
    headers={'User-Agent':UA,'Accept':accept,'Accept-Language':'ko-KR,ko;q=0.9,en;q=0.7','Cache-Control':'no-cache'}
    if referer: headers['Referer']=referer
    if data is not None and not isinstance(data,(bytes,bytearray)):
        data=urllib.parse.urlencode(data).encode()
        headers['Content-Type']='application/x-www-form-urlencoded'
    last=None
    for n in range(tries):
        try:
            with op.open(urllib.request.Request(url,data=data,headers=headers,method=method),timeout=15) as r:
                return r.status,r.geturl(),dict(r.headers.items()),r.read()
        except Exception as e:
            last=e; time.sleep(0.8*(n+1))
    raise last

def attrs(s):
    out={}
    for m in re.finditer(r'([:\w-]+)(?:\s*=\s*(?:"([^"]*)"|\'([^\']*)\'|([^\s>]+)))?',s or ''):
        out[m.group(1).lower()]=m.group(2) or m.group(3) or m.group(4) or ''
    return out

def cell(tr,label):
    m=re.search(r'<span\s+class=["\']s-th["\']>'+re.escape(label)+r'</span>\s*<span(?:\s+[^>]*)?>(.*?)</span>',tr,re.I|re.S)
    return clean(m.group(1)) if m else ''

def parse_mfds_rows(page):
    rows=[]
    for tr in re.findall(r'(?is)<tr(?:\s+[^>]*)?>(.*?)</tr>',page):
        m=re.search(r'getItemDetail\?itemSeq=(\d{9})[^>]*>(.*?)</a>',tr,re.I|re.S)
        if not m: continue
        rows.append({'item_seq':m.group(1),'display_name':clean(m.group(2)),'manufacturer':cell(tr,'업체명'),
                     'permit_date':cell(tr,'허가일'),'permit_status':cell(tr,'취소/취하구분'),
                     'otc_label':cell(tr,'전문의약품'),'main_ingredient':cell(tr,'주성분')})
    return rows

def parse_ingredients(v):
    v=clean(v or '').replace('\u3000',' ')
    parts=[p.strip(' @') for p in re.split(r'\s*@\s*\|?\s*|\s*\|\s*',v) if p.strip(' @')]
    out=[]
    for p in parts:
        hit=None
        for en in sorted(ING,key=len,reverse=True):
            if p.lower().startswith(en.lower()): hit=en; break
        if hit:
            strength=p[len(hit):].strip() or None
            out.append({'name_en':hit,'name_ko':ING[hit],'strength_text':strength})
        else:
            m=re.match(r'(.+?)\s+([0-9].*)$',p)
            if m: out.append({'name_en':m.group(1).strip(),'name_ko':m.group(1).strip(),'strength_text':m.group(2).strip()})
    return out

def split_urls(v): return [x.strip() for x in re.split(r'[|@]',v or '') if x.strip().startswith('http')]

def official_header(text):
    start=text.find('기본정보 의약품정보')
    if start<0: start=text.find('제품명 ')
    t=text[start:start+5000] if start>=0 else text[:5000]
    def grab(a,b):
        m=re.search(re.escape(a)+r'\s+(.+?)\s+'+b,t)
        return m.group(1).strip() if m else None
    return {'display_name':grab('제품명','성상'),'manufacturer':grab('업체명','(?:위탁제조업체|전문/일반)'),
            'otc_label':grab('전문/일반','허가일'),'permit_date':grab('허가일','품목기준코드'),
            'item_seq':grab('품목기준코드','표준코드')}

def strength_tokens(s):
    return [x.lstrip('0') or '0' for x in re.findall(r'\d+(?:\.\d+)?',s or '')]

def verify_strength(section,ing):
    if norm(ing['name_ko']) not in norm(section):
        aliases={'디오스멕타이트':['디옥타헤드랄스멕타이트','디옥타헤드랄스멕타이트','디오스멕타이트']}
        if not any(norm(x) in norm(section) for x in aliases.get(ing['name_ko'],[])): return False
    nums=strength_tokens(ing.get('strength_text'))
    secnums=set(strength_tokens(section))
    return all(n in secnums or ('.' in n and n.rstrip('0').rstrip('.') in secnums) for n in nums)

def one(candidate):
    query,expected=candidate; op=opener(); rec={'candidate':{'name':query,'drug_cd':expected},'errors':[],'exclusion_reasons':[]}
    try:
        purl='https://health.kr/searchDrug/search_total_result.asp'
        st,_,_,body=request(op,purl,'POST',{'search_word':query,'search_flag':'all'},accept='text/html')
        page=body.decode('utf-8','replace'); token=(re.search(r'window\.csrfToken\s*=\s*"([^"]+)"',page) or [None,None])[1]
        if not token: raise ValueError('Health.kr CSRF token missing')
        aurl='https://health.kr/searchDrug/ajax/ajax_commonSearch.asp?'+urllib.parse.urlencode({'search_word':query,'csrf_token':token,'search_flag':'all'})
        st2,_,_,body2=request(op,aurl,'POST',{'search_word':query,'csrf_token':token,'search_flag':'all'},purl,'application/json, text/javascript, */*; q=0.01')
        items=json.loads(body2.decode('utf-8','replace')); item=next((x for x in items if x.get('drug_code')==expected),None)
        if not item: raise ValueError(f'expected Health.kr drug_code not found among {len(items)} result(s)')
        rec['health_search_http_status']=st2; rec['health_search_item']=item
        item_seq=str(item.get('kfda_code') or ''); rec['item_seq']=item_seq
        if not re.fullmatch(r'\d{9}',item_seq): rec['exclusion_reasons'].append('약학정보원 kfda_code가 9자리 품목기준코드가 아님')
        durl='https://health.kr/searchDrug/ajax/ajax_result_drug2.asp?drug_cd='+urllib.parse.quote(expected)+'&_='+str(int(time.time()*1000))
        st3,_,_,body3=request(op,durl,referer='https://health.kr/searchDrug/result_drug.asp?drug_cd='+urllib.parse.quote(expected),accept='application/json, text/javascript, */*; q=0.01')
        detail=json.loads(body3.decode('utf-8','replace')); rec['health_detail_http_status']=st3; rec['health_detail_item']=detail[0] if isinstance(detail,list) and detail else None
        if not rec['health_detail_item']: rec['exclusion_reasons'].append('약학정보원 상세 데이터가 없음')
    except Exception as e:
        rec['errors'].append('health: '+repr(e)); rec['exclusion_reasons'].append('약학정보원 검색/상세 조회 실패'); return rec
    item=rec['health_search_item']; item_seq=rec['item_seq']
    try:
        params={'searchDivision':'detail','searchYn':'true','page':'1','itemSeq':item_seq,'etcOtcCode':'01','cancelCode':'0'}
        surl='https://nedrug.mfds.go.kr/searchDrug?'+urllib.parse.urlencode(params)
        st,_,_,body=request(op,surl,referer='https://nedrug.mfds.go.kr/searchDrug',accept='text/html,*/*')
        rows=parse_mfds_rows(body.decode('utf-8','replace')); row=next((x for x in rows if x['item_seq']==item_seq),None)
        rec['mfds_search_http_status']=st; rec['mfds_search_matches']=rows; rec['mfds_selected']=row
        if not row: rec['exclusion_reasons'].append('식약처 품목기준코드 검색 결과가 없음')
        else:
            if row['permit_status']!='정상': rec['exclusion_reasons'].append('식약처 허가상태가 정상이 아님')
            if row['otc_label']!='일반의약품': rec['exclusion_reasons'].append('식약처 일반의약품 표시 불일치')
        durl='https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetailCache?cacheSeq='+item_seq
        st2,_,_,body2=request(op,durl,referer=surl,accept='text/html,*/*')
        text=clean(body2.decode('utf-8','replace')); hdr=official_header(text)
        anchor=text.find('품목기준코드 '+item_seq); a=text.find('원료약품 및 분량',anchor if anchor>=0 else 0); z=text.find('첨가제',a+1)
        section=text[a:(z+300 if z>0 else a+6000)] if a>=0 else ''
        rec['mfds_detail_http_status']=st2; rec['mfds_header']=hdr; rec['mfds_ingredient_section']=section
    except Exception as e:
        rec['errors'].append('mfds: '+repr(e)); rec['exclusion_reasons'].append('식약처 검색/상세 조회 실패'); return rec
    row=rec.get('mfds_selected'); hdr=rec.get('mfds_header') or {}
    official=(hdr.get('display_name') or (row or {}).get('display_name') or '')
    health_name=item.get('drug_name') or ''
    rec['name_match']=name_core(official)==name_core(health_name) or name_core(official).startswith(name_core(health_name)) or name_core(health_name).startswith(name_core(official))
    if not rec['name_match']: rec['exclusion_reasons'].append(f'제품명 불일치: MFDS={official!r}, Health.kr={health_name!r}')
    mf_manu=hdr.get('manufacturer') or (row or {}).get('manufacturer') or ''; h_manu=item.get('upso_name_kfda') or ''
    rec['manufacturer_match']=norm(mf_manu)==norm(h_manu)
    if not rec['manufacturer_match']: rec['exclusion_reasons'].append(f'제조사 불일치: MFDS={mf_manu!r}, Health.kr={h_manu!r}')
    ingredients=parse_ingredients(item.get('ingr_mg') or item.get('list_sunb_name') or '')
    rec['parsed_ingredients']=ingredients
    rec['ingredient_strength_match']=bool(ingredients) and all(verify_strength(rec.get('mfds_ingredient_section',''),x) for x in ingredients)
    if not rec['ingredient_strength_match']: rec['exclusion_reasons'].append('식약처 원료약품 분량과 약학정보원 성분/함량 교차검증 실패')
    urls=split_urls(item.get('pack_img')) or split_urls(item.get('drug_pic'))
    rec['candidate_image_urls']=urls
    if not urls: rec['exclusion_reasons'].append('약학정보원 이미지 URL 없음')
    else:
        try:
            u=urls[0]; st,_,headers,b=request(op,u,referer='https://health.kr/searchDrug/result_drug.asp?drug_cd='+urllib.parse.quote(expected),accept='image/avif,image/webp,image/apng,image/*,*/*;q=0.8')
            if b[:2]==b'\xff\xd8': ct,ext='image/jpeg','jpg'
            elif b[:8]==b'\x89PNG\r\n\x1a\n': ct,ext='image/png','png'
            elif b[:4]==b'RIFF' and b[8:12]==b'WEBP': ct,ext='image/webp','webp'
            else: raise ValueError('unsupported image signature')
            local=IMG/f'{item_seq}.{ext}'; local.write_bytes(b)
            rec['image']={'source_url':u,'http_status':st,'content_type':ct,'local_file':'images/'+local.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
        except Exception as e:
            rec['errors'].append('image: '+repr(e)); rec['exclusion_reasons'].append('제품 이미지 다운로드/형식 검증 실패')
    rec['automated_eligible']=not rec['exclusion_reasons'] and bool(rec.get('image'))
    return rec

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:
    results=list(ex.map(one,CANDIDATES))
for r in results:
    print(r['candidate']['name'], 'OK' if r.get('automated_eligible') else 'EXCLUDE', '; '.join(r.get('exclusion_reasons',[])), flush=True)
(OUT/'research.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
summary={'candidate_count':len(results),'automated_eligible_count':sum(bool(x.get('automated_eligible')) for x in results),'downloaded_image_count':len(list(IMG.glob('*'))),'generated_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
(OUT/'workflow-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False),flush=True)
