import sys,json,os,re; sys.path.insert(0,'.')
from gen import build
P=json.load(open('/tmp/claude-0/zip1/products.json'))
# 사용자 목록(이미지) 기준 코드·제품명, 번호: 내장형(에폭시) → 외장형(폴리에스터), 목록 순서
LIST=[('DY#1-BE226','내장형 30691(MC) 유광'),('DY#1-BK003','내장형 BLACK 무광'),('DY#1-BK015','내장형 BLACK(D) 반광'),('DY#1-GY014','내장형 N 5.5 반광'),
('DY#1-GY027','내장형 N 8.0 유광'),('DY#1-GY029','내장형 7.5BG 6/1.5 유광'),('DY#1-IV117','내장형 MC IVORY 유광'),('DY#1-YL001','내장형 PA3758 유광'),
('DY#2-BK003','외장형 BLACK 반광'),('DY#2-BK007','외장형 BLACK 유광'),('DY#2-BK015','외장형 HS BLACK 무광'),('DY#2-BL089','외장형 NEW BLUE(NS) 유광'),
('DY#2-BL090','외장형 SF-6505(DEEP BLUE) 반광'),('DY#2-BR009','외장형 BROWN 유광'),('DY#2-BR046','외장형 G-324501 무광'),('DY#2-GY007','외장형 SEPIA GRAY 유광'),
('DY#2-GY014','외장형 N7.0 유광'),('DY#2-GY044','외장형 C-80680 유광'),('DY#2-GY067','외장형 N 4.0 유광'),('DY#2-GY161','외장형 MC GRAY 11C 반광'),
('DY#2-GY216','외장형 SF-7030 반광'),('DY#2-RD001','외장형 SB RED 유광'),('DY#2-WH001','외장형 PURE WHITE 유광'),('DY#2-WH056','외장형 053 WHITE(MC) 반광'),
('DY#2-YL005','외장형 LT YELLOW(TF) 유광'),('DY#4-GY077','외장형 T/X 구미 연그레이(MC) 반광'),('DY#4-GY078','외장형 T/X 구미 진그레이(MC) 반광'),('DY#4-WH014','외장형 T/X WHITE(MC) 반광'),
('DY#6-GD006','외장형 함마톤 MC GOLD 유광'),('DY#6-GD007','외장형 함마톤 005 COPPER 유광'),('DY#6-GN006','외장형 함마톤 2.5G 7/2 유광'),('DY#6-GY002','내장형 함마톤 EY019K 유광'),
('DY#6-GY015','외장형 함마톤 MC VD0032 유광'),('DY#6-SI002','내장형 함마톤 SILVER 유광')]
order=[x for x in LIST if x[1].startswith('내장')]+[x for x in LIST if x[1].startswith('외장')]
NUM={x:140+i for i,x in enumerate(order)}
def find(code,name):
    io='내장' if name.startswith('내장') else '외장'
    c=[k for k,v in P.items() if str(v['code']).strip()==code]
    if len(c)>1: c=[k for k in c if io in str(v_name(k))]
    return c[0]
def v_name(k): return P[k]['name']
HOLD={'DY#1-YL001':'YELLOW P210(8007-18-9)이 KOSHA 발암성 1A — 2번 분류(H350·위험) 결정 필요'}
os.makedirs('/tmp/claude-0/out1/MSDS',exist_ok=True)
res=[]
for code,name in order:
    k=find(code,name); no=f'AA14944-{NUM[(code,name)]:010d}'
    fn=f"{code} {re.sub(r'^(내장형|외장형)\s*','',name)} MSDS".replace('/','-')
    p=dict(code=code,name=name,items=P[k]['items'])
    if code in HOLD and HOLD[code]:
        res.append(dict(code=code,name=name,no=no,file=None,status='보류',note=HOLD[code],k=k)); continue
    out,rep=build(p,no,f'/tmp/claude-0/out1/MSDS/{fn}.xlsx')
    if not out:
        res.append(dict(code=code,name=name,no=no,file=None,status='보류',note='CAS 미확인 원료: '+', '.join(rep['unknown']),k=k)); continue
    res.append(dict(code=code,name=name,no=no,file=fn,status='생성',excluded=rep['excluded'],rows=rep['rows'],k=k))
json.dump(res,open('/tmp/claude-0/out1/result.json','w'),ensure_ascii=False,indent=1)
for r in res: print(r['no'][-3:],r['code'],r['status'],r.get('note',''),r.get('excluded',''))
