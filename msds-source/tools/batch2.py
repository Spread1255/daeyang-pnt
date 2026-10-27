# 보류분 재작업: YL001(발암성 1A), BE226(E-12), WH001(QM1260), BK015·GY014 내장(POWDER 베이스 전개)
import sys,json,os,re,openpyxl; sys.path.insert(0,'.')
from gen import build, nkey
P=json.load(open('/tmp/claude-0/zip1/products.json'))
def base(f):
    ws=openpyxl.load_workbook(f,data_only=True)['26.8.24']
    return [[str(r[0]),str(r[1]).strip(),r[3]] for r in ws.iter_rows(min_row=8,max_row=26,values_only=True) if r[1] and r[3] is not None and r[0]!='DFA' and nkey(r[1]) not in ('CERA-994','HDKV15')]
BASE={'BLACK':base('/tmp/claude-0/pw/black.xlsx'),'GRAY':base('/tmp/claude-0/pw/gray.xlsx')}
def expand(items,name,which):
    """POWDER 행을 베이스 배합(POWDER % 비례)으로 풀어 넣음. 유광이면 S#3000→S#7000, CT-0230 삭제"""
    out=[]
    for no,raw,v in items:
        if nkey(raw)=='POWDER':
            for bno,braw,bv in BASE[which]:
                if '유광' in name:
                    if nkey(braw)=='CT-0230': continue
                    if nkey(braw)=='S3000': braw='S#7000'
                out.append([bno,braw,round(v*bv/100,2)])
        else: out.append([no,raw,v])
    return out
JOBS=[('f01','DY#1-BE226','내장형 30691(MC) 유광',140,{}),
      ('f05','DY#1-BK015','내장형 BLACK(D) 반광',142,{'base':'BLACK'}),
      ('f16','DY#1-GY014','내장형 N 5.5 반광',143,{'base':'GRAY'}),
      ('f33','DY#1-YL001','내장형 PA3758 유광',147,{'carc':'1A'}),
      ('f30','DY#2-WH001','외장형 PURE WHITE 유광',164,{})]
OUT='/tmp/claude-0/out2/MSDS'; os.makedirs(OUT,exist_ok=True)
res=[]
for k,code,name,num,opt in JOBS:
    items=P[k]['items']
    if 'base' in opt: items=expand(items,name,opt['base'])
    no=f'AA14944-{num:010d}'
    fn=f"{code} {re.sub(r'^(내장형|외장형)\s*','',name)} MSDS".replace('/','-')
    out,rep=build(dict(code=code,name=name,items=items,carc=opt.get('carc','2'),nd=2 if 'base' in opt else 6),no,f'{OUT}/{fn}.xlsx')
    print(num,code,'OK' if out else rep['unknown'],rep['excluded'])
    for r in rep['rows']: print('    ',r)
    res.append(dict(code=code,name=name,no=no,file=fn if out else None,status='생성' if out else '보류',excluded=rep['excluded'],rows=rep['rows'],k=k))
json.dump(res,open('/tmp/claude-0/out2/result.json','w'),ensure_ascii=False,indent=1)
