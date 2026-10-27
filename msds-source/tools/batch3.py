# 함마톤: 베이스 작업지시서 배합을 베이스 %만큼 비례로 전개, 101A·S-160 가루 제외
import sys,json,os,re,openpyxl; sys.path.insert(0,'.')
from gen import build, nkey
P=json.load(open('/tmp/claude-0/zip1/products.json'))
def base(f):
    wb=openpyxl.load_workbook(f,data_only=True); ws=wb[wb.sheetnames[0]]  # 첫 시트 = 최신
    return [[str(r[0]),str(r[1]).strip(),r[3]] for r in ws.iter_rows(min_row=8,max_row=26,values_only=True)
            if r[1] and r[3] is not None and r[0]!='DFA' and nkey(r[1]) not in ('CERA-994','HDKV15')]
H='/tmp/claude-0/hm/'
JOBS=[('f14','DY#6-GY002','내장형 함마톤 EY019K 유광',148,H+'gy002.xlsx'),
      ('f29','DY#6-SI002','내장형 함마톤 SILVER 유광',149,H+'sibk.xlsx'),
      ('f12','DY#6-GD007','외장형 함마톤 005 COPPER 유광',171,H+'bk.xlsx'),
      ('f18','DY#6-GY015','외장형 함마톤 MC VD0032 유광',173,H+'gy008.xlsx')]
SKIP=lambda raw: re.match(r'^(101A|S-160)',nkey(raw))
OUT='/tmp/claude-0/out3/MSDS'; os.makedirs(OUT,exist_ok=True); res=[]
for k,code,name,num,bf in JOBS:
    items=[]; B=base(bf)
    for i,(no,raw,v) in enumerate(P[k]['items']):
        if SKIP(raw): continue
        if i==0: items+= [[bno,braw,round(v*bv/100,2)] for bno,braw,bv in B]   # 1번 행 = 베이스
        else: items.append([no,raw,v])
    no=f'AA14944-{num:010d}'; fn=f"{code} {re.sub(r'^(내장형|외장형)\s*','',name)} MSDS".replace('/','-')
    out,rep=build(dict(code=code,name=name,items=items,nd=2),no,f'{OUT}/{fn}.xlsx')
    print(num,code,'OK' if out else rep['unknown'],rep['excluded'])
    for r in rep['rows']: print('    ',r)
    res.append(dict(code=code,name=name,no=no,file=fn if out else None,excluded=rep['excluded'],rows=rep['rows'],k=k))
json.dump(res,open('/tmp/claude-0/out3/result.json','w'),ensure_ascii=False,indent=1)
