from __future__ import annotations

import hashlib, html, json, os, re, struct, time, urllib.parse, urllib.request
from pathlib import Path

OUT=Path('pharmassist-output'); IMG=OUT/'images'; OUT.mkdir(exist_ok=True); IMG.mkdir(exist_ok=True)
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 PharmAssistResearch/1.0'
CANDIDATES=[
 ('타이레놀정500mg','2021082400002'),('이지엔6이브연질캡슐','2013011800015'),
 ('어린이부루펜시럽(80mL)','A11A0500A0154'),('타세놀정500mg','2015071700001'),
 ('타세놀8시간이알서방정','A11ALLLLL0032'),('지르텍정','A11ABBBBB2527'),
 ('클라리틴정','2009091800015'),('액티피드정','A11A0500A0068'),
 ('뮤테란캡슐200mg','A11A1530A0114'),('뮤코펙트정','2009071505405'),
 ('모드콜에스연질캡슐','2012050900002'),('타이레놀콜드에스정','2021101800010'),
 ('화이투벤큐노즈연질캡슐','2013010400010'),('화이투벤씨플러스캡슐','2013010700008'),
 ('겔포스엠현탁액','A11A0930A0424'),('훼스탈플러스정','A11A0740B0009'),
 ('보나링츄어블정','2016021200001'),('디오타현탁액','A11AKP08G3845'),
 ('로프민캡슐','A11A1660A0057'),('둘코락스에스장용정','2009092300055')]

def fetch(url, referer=None, accept='*/*', timeout=35):
    h={'User-Agent':UA,'Accept':accept,'Accept-Language':'ko-KR,ko;q=0.9,en;q=0.7','Cache-Control':'no-cache'}
    if referer: h['Referer']=referer
    last=None
    for n in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers=h),timeout=timeout) as r:
                return r.status,r.geturl(),dict(r.headers.items()),r.read()
        except Exception as e:
            last=e; time.sleep(n+1)
    raise last

def clean(s):
    s=re.sub(r'(?is)<script.*?</script>|<style.*?</style>',' ',s or '')
    s=re.sub(r'(?i)<br\s*/?>',' ',s); s=re.sub(r'(?s)<[^>]+>',' ',s)
    return re.sub(r'\s+',' ',html.unescape(s)).strip()

def norm(s):
    s=html.unescape(s or '')
    s=re.sub(r'(주식회사|유한회사|\(주\)|㈜|주\)|\(유\)|유\))','',s)
    return re.sub(r'[^0-9A-Za-z가-힣]+','',s).lower()

def cell(tr,label):
    m=re.search(r'<span\s+class=["\']s-th["\']>'+re.escape(label)+r'</span>\s*<span(?:\s+[^>]*)?>(.*?)</span>',tr,re.I|re.S)
    return clean(m.group(1)) if m else ''

def mfds_rows(page):
    out=[]
    for tr in re.findall(r'(?is)<tr(?:\s+[^>]*)?>(.*?)</tr>',page):
        m=re.search(r'getItemDetail\?itemSeq=(\d{9})[^>]*>(.*?)</a>',tr,re.I|re.S)
        if not m: continue
        out.append({'item_seq':m.group(1),'display_name':clean(m.group(2)),'manufacturer':cell(tr,'업체명'),
                    'permit_date':cell(tr,'허가일'),'permit_status':cell(tr,'취소/취하구분'),
                    'otc_label':cell(tr,'전문의약품'),'main_ingredient':cell(tr,'주성분')})
    return out

def split_urls(v): return [x.strip() for x in re.split(r'[|@]',v or '') if x.strip().startswith('http')]

def img_size(b,ctype):
    if ctype=='image/png' and b[:8]==b'\x89PNG\r\n\x1a\n' and len(b)>=24: return struct.unpack('>II',b[16:24])
    if ctype=='image/jpeg' and b[:2]==b'\xff\xd8':
        i=2
        while i+9<len(b):
            if b[i]!=0xff: i+=1; continue
            while i<len(b) and b[i]==0xff: i+=1
            if i>=len(b): break
            marker=b[i]; i+=1
            if marker in (0xd8,0xd9): continue
            if i+2>len(b): break
            n=struct.unpack('>H',b[i:i+2])[0]
            if marker in {0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf} and i+7<len(b):
                h,w=struct.unpack('>HH',b[i+3:i+7]); return w,h
            i+=max(n,2)
    if ctype=='image/webp' and b[:4]==b'RIFF' and b[8:12]==b'WEBP':
        if b[12:16]==b'VP8X' and len(b)>=30: return 1+int.from_bytes(b[24:27],'little'),1+int.from_bytes(b[27:30],'little')
        if b[12:16]==b'VP8 ' and len(b)>=30: return int.from_bytes(b[26:28],'little')&0x3fff,int.from_bytes(b[28:30],'little')&0x3fff
    return None,None

results=[]
for i,(name,drug_cd) in enumerate(CANDIDATES,1):
    print(f'[{i}/{len(CANDIDATES)}] {name}',flush=True)
    rec={'candidate':{'name':name,'drug_cd':drug_cd},'errors':[],'exclusion_reasons':[]}
    item=None; mfds=None; item_seq=None
    try:
        hu='https://health.kr/searchDrug/ajax/ajax_result_drug2.asp?drug_cd='+urllib.parse.quote(drug_cd)+'&_='+str(int(time.time()*1000))
        st,final,headers,body=fetch(hu,'https://health.kr/searchDrug/result_drug.asp?drug_cd='+urllib.parse.quote(drug_cd),'application/json, text/javascript, */*; q=0.01')
        rec['health_http_status']=st; data=json.loads(body.decode('utf-8','replace')); item=data[0] if isinstance(data,list) and data else None
        rec['health_item']=item
        if not item: rec['exclusion_reasons'].append('약학정보원 상세 응답에 품목 데이터가 없음')
        elif norm(item.get('drug_name'))!=norm(name): rec['exclusion_reasons'].append('요청 품목명과 약학정보원 품목명 불일치')
    except Exception as e:
        rec['health_http_status']=None; rec['errors'].append('health: '+repr(e)); rec['exclusion_reasons'].append('약학정보원 상세 조회 실패')
    params={'searchDivision':'detail','searchYn':'true','page':'1','itemName':name,'etcOtcCode':'01','cancelCode':'0'}
    msu='https://nedrug.mfds.go.kr/searchDrug?'+urllib.parse.urlencode(params)
    try:
        st,final,headers,body=fetch(msu,'https://nedrug.mfds.go.kr/searchDrug','text/html,*/*')
        rec['mfds_search_http_status']=st; rows=mfds_rows(body.decode('utf-8','replace')); rec['mfds_search_matches']=rows
        exact=[x for x in rows if norm(x['display_name'])==norm(name)]
        if len(exact)!=1: rec['exclusion_reasons'].append(f'식약처 정확 일치 품목 수가 1개가 아님({len(exact)}개)')
        else:
            mfds=exact[0]; item_seq=mfds['item_seq']; rec['mfds_selected']=mfds
            if mfds['otc_label']!='일반의약품': rec['exclusion_reasons'].append('식약처 일반의약품 표시 불일치')
            if mfds['permit_status']!='정상': rec['exclusion_reasons'].append('식약처 허가 상태가 정상이 아님')
    except Exception as e:
        rec['mfds_search_http_status']=None; rec['errors'].append('mfds_search: '+repr(e)); rec['exclusion_reasons'].append('식약처 품목 검색 실패')
    if item and mfds:
        hm=(item.get('upso_name') or '').split('|')[0].strip(); rec['health_manufacturer']=hm
        rec['manufacturer_match']=norm(hm)==norm(mfds['manufacturer'])
        if not rec['manufacturer_match']: rec['exclusion_reasons'].append(f'제조사 불일치: MFDS={mfds["manufacturer"]!r}, Health.kr={hm!r}')
        htxt=clean((item.get('sunb') or '')+' '+(item.get('list_sunb_name') or ''))
        parts=[p.strip() for p in (mfds.get('main_ingredient') or '').split('/') if p.strip()]
        rec['ingredient_name_match']=bool(parts) and all(norm(p) in norm(htxt) for p in parts)
        if not rec['ingredient_name_match']: rec['exclusion_reasons'].append('식약처 주성분명과 약학정보원 성분명 불일치')
    if mfds:
        du='https://nedrug.mfds.go.kr/pbp/CCBBB01/getItemDetailCache?cacheSeq='+item_seq
        try:
            st,final,headers,body=fetch(du,msu,'text/html,*/*'); rec['mfds_detail_http_status']=st
            text=clean(body.decode('utf-8','replace')); a=text.find('원료약품 및 분량'); z=text.find('첨가제',a+1)
            rec['mfds_detail_identity_text']=text[:2200]
            rec['mfds_ingredient_section']=text[a:(z+1200 if z>0 else a+5000)] if a>=0 else text[:5000]
        except Exception as e:
            rec['mfds_detail_http_status']=None; rec['errors'].append('mfds_detail: '+repr(e)); rec['exclusion_reasons'].append('식약처 상세 페이지 조회 실패')
    if item and item_seq:
        urls=split_urls(item.get('pack_img')) or split_urls(item.get('drug_pic')); rec['candidate_image_urls']=urls
        if not urls: rec['exclusion_reasons'].append('약학정보원 상세 응답에 이미지 URL이 없음')
        else:
            try:
                u=urls[0]; st,final,headers,b=fetch(u,'https://health.kr/searchDrug/result_drug.asp?drug_cd='+urllib.parse.quote(drug_cd),'image/avif,image/webp,image/apng,image/*,*/*;q=0.8')
                ct=headers.get('Content-Type','').split(';')[0].lower()
                if b[:2]==b'\xff\xd8': ct='image/jpeg'
                elif b[:8]==b'\x89PNG\r\n\x1a\n': ct='image/png'
                elif b[:4]==b'RIFF' and b[8:12]==b'WEBP': ct='image/webp'
                ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}.get(ct)
                if not ext: raise ValueError('unsupported image type '+repr(ct))
                w,h=img_size(b,ct)
                if not w or not h: raise ValueError('image dimensions unavailable')
                local=IMG/f'{item_seq}.{ext}'; local.write_bytes(b)
                rec['image']={'source_url':u,'http_status':st,'content_type':ct,'local_file':'images/'+local.name,
                              'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'width':w,'height':h}
            except Exception as e:
                rec['errors'].append('image: '+repr(e)); rec['exclusion_reasons'].append('제품 이미지 다운로드 또는 형식 검증 실패')
    rec['automated_eligible']=not rec['exclusion_reasons'] and bool(rec.get('image'))
    results.append(rec); time.sleep(.5)

(OUT/'research.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
summary={'candidate_count':len(results),'automated_eligible_count':sum(bool(x.get('automated_eligible')) for x in results),
         'downloaded_image_count':len(list(IMG.glob('*'))),'generated_at_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
(OUT/'workflow-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False),flush=True)
