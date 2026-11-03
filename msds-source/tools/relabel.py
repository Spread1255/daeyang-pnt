# 이미 만든 MSDS의 8·11·12·15번 이름 칸: 원료명 → 물질명 (2026-11-03 사용자 결정)
import sys,json,glob,zipfile,html,re,os
SUBS=json.load(open(os.path.join(os.path.dirname(__file__),'../../manager/msds-substances.json')))
def esc(t): return html.escape(t,quote=False)
def patch(path,raw2cas,out=None):
    z=zipfile.ZipFile(path); s=z.read('xl/worksheets/sheet1.xml').decode()
    cnt={}
    def fixrow(m):
        row=m.group(0); n=m.group(1)
        if int(n)<60: return row
        need=[]
        def fixc(cm):
            c=cm.group(0); t=html.unescape(''.join(re.findall(r'<t[^>]*>(.*?)</t>',c,re.S)))
            k=t.strip()
            if k in raw2cas and raw2cas[k] in SUBS:
                nm=SUBS[raw2cas[k]]['name']; new=t[:len(t)-len(t.lstrip())]+nm
                cnt[k]=cnt.get(k,0)+1; need.append(-(-(17+len(nm))//55)*14.25)
                return re.sub(r'<is>.*?</is>','<is><t xml:space="preserve">'+esc(new)+'</t></is>',c,flags=re.S)
            return c
        row=re.sub(r'<c r="A%s"[^>]*t="inlineStr"[^>]*>.*?</c>'%n,fixc,row,flags=re.S)
        if need:
            h=max(need); head=re.match(r'<row [^>]*>',row).group(0)
            cur=re.search(r'ht="([\d.]+)"',head)
            if not cur or float(cur.group(1))<h:
                nh=re.sub(r'\s(ht|customHeight)="[^"]*"','',head)[:-1]+' ht="%s" customHeight="true">'%h
                row=nh+row[len(head):]
        return row
    s2=re.sub(r'<row [^>]*r="(\d+)"[^>]*>.*?</row>',fixrow,s,flags=re.S)
    out=out or path; tmp=out+'.tmp'
    with zipfile.ZipFile(tmp,'w',zipfile.ZIP_DEFLATED) as zo:
        for it in z.infolist(): zo.writestr(it, s2.encode() if it.filename=='xl/worksheets/sheet1.xml' else z.read(it.filename))
    os.replace(tmp,out); return cnt
if __name__=='__main__':
    R={}
    for f in glob.glob(os.path.join(os.path.dirname(__file__),'../data/batch_*_result.json')):
        for r in json.load(open(f)):
            if r.get('file'): R[r['file']]={row[0].strip():row[1] for row in r['rows']}
    for fn in sys.argv[1:]:
        b=os.path.basename(fn)[:-5]; print(b, patch(fn,R[b]))
