import re,html,glob,sys
def txt(f):
    t=open(f,encoding='utf-8',errors='replace').read()
    body=re.sub(r'<script.*?</script>|<style.*?</style>','',t,flags=re.S)
    s=re.sub(r'[ \t\r\f\v]+',' ',html.unescape(re.sub(r'<[^>]+>','\n',body)))
    return [l.strip() for l in s.split('\n') if l.strip()]
def sections(lines):
    i=next(k for k,l in enumerate(lines) if l=='MSDS 상세정보')
    L=lines[i:]; secs={}; cur=None
    for l in L:
        m=re.match(r'^(\d{1,2})\. ',l)
        if m and int(m.group(1))<=16 and (cur is None or int(m.group(1))==cur+1): cur=int(m.group(1)); secs[cur]=[l]; continue
        if cur: secs[cur].append(l)
    return L[:12],secs
if __name__=='__main__':
    for f in sorted(glob.glob('d_*.html')):
        L,s=sections(txt(f)); print('=====',f); print(' | '.join(L[1:10]))
        for n in map(int,sys.argv[1:]):
            print(f'--- {n}'); print('\n'.join(s.get(n,[])[:int(60)]))
