import openpyxl, copy, re, datetime
from openpyxl.worksheet.pagebreak import Break, RowBreak
from openpyxl.worksheet.cell_range import CellRange
SRC='/tmp/claude-0/ral/iv064.xlsx'
wb=openpyxl.load_workbook(SRC)
if '호환성 보고서' in wb.sheetnames: del wb['호환성 보고서']
ws=wb['Sheet1']

# ---- 함유량 범위 규칙 ----
def rng(v):
    s=repr(v) if isinstance(v,float) else str(v)
    d=len(s.split('.')[1].rstrip('0')) if '.' in s else 0
    if d==0: lo,hi=v,v+5
    else:
        u=10**-d; lo,hi=v-u,v+2*u
    f=lambda x: (f'{x:.{d}f}' if d else str(int(round(x))))
    return f'{f(lo)} ∽ {f(hi)}'

# ---- 새 구성성분 (NO 1~16, DFA 제외; 함량 내림차순) ----
TBL={r:[ws.cell(r,c).value for c in (1,3,4)] for r in range(38,50)}
poly=TBL[39]; epx=TBL[40]; pb29=TBL[47]; ben=TBL[42]; pe=TBL[43]; bar=TBL[44]; lime=TBL[45]; tio=TBL[46]; y83=TBL[48]; pba=TBL[41]
NEW=[
 (poly[0],poly[1],poly[2],35),
 (epx[0],epx[1],epx[2],25),
 (bar[0],bar[1],bar[2],21),
 (lime[0],lime[1],lime[2],11.4),
 (tio[0],tio[1],tio[2],2),
 (pb29[0],pb29[1],pb29[2],2.63),
 ('구리 프탈로시아닌','구리 프탈로시아닌 청색(COPPER PHTHALOCYANINE BLUE);','147-14-8',1),
 (pba[0],pba[1],pba[2],0.85),
 (ben[0],ben[1],ben[2],0.3),
 (pe[0],pe[1],pe[2],0.3),
 ('3,9-비스(2,4-비스(1,1-다이메틸에틸)펜옥시)-2,4,8,10-테트라옥사-3,9-디포스파스피로[5.5]언데칸','SONOX626','26741-53-7',0.3),
 ('카브아졸 다이옥사진 바이올렛(CARBAZOLE DIOXAZINE VIOLET)',"디인돌로(3,2-B:3'',2''-M)트리페노디옥사진, 8,18-디클로로-5,15-디에틸-",'6358-30-1',0.025),
 (y83[0],y83[1],y83[2],0.051),
]
assert abs(sum(n[3] for n in NEW)-99.856)<1e-9

# ---- 행 1개 삽입 (병합·행높이·쪽나누기 이동) ----
INS=50; N=1
merges=[CellRange(str(m)) for m in ws.merged_cells.ranges]
for m in merges: ws.unmerge_cells(str(m))
heights={r:d.height for r,d in ws.row_dimensions.items() if d.height}
ws.insert_rows(INS,N)
for r in sorted(heights,reverse=True):
    if r>=INS: ws.row_dimensions[r+N].height=heights[r]
ws.row_dimensions[INS].height=heights[49]
for m in merges:
    if m.min_row>=INS: m.shift(row_shift=N)
    ws.merge_cells(str(m))
ws.merge_cells(f'A{INS}:B{INS}')
for c in range(1,6):
    s=ws.cell(49,c); d=ws.cell(INS,c); d._style=copy.copy(s._style)
brks=[b.id for b in ws.row_breaks.brk]
ws.row_breaks=RowBreak()
for b in brks: ws.row_breaks.append(Break(id=b+N if b>=INS else b))
# (삽입 후 3번 표 = 38~50, 4번 섹션 제목 = 52)
for i,(a,c,d,p) in enumerate(NEW):
    r=38+i
    ws.cell(r,1).value=a; ws.cell(r,3).value=c or None; ws.cell(r,4).value=d; ws.cell(r,5).value=rng(p)
    ws.row_dimensions[r].height=heights[39] if len(c or '')>60 else 24.75
ws.row_dimensions[38+1].height=24.75

def find(text,col=1,start=1):
    for r in range(start,ws.max_row+1):
        v=ws.cell(r,col).value
        if v and text in str(v): return r
    raise KeyError(text)
def row_blank(r):
    for c in (1,2): ws.cell(r,c).value=None

# 1번·표지
ws['B3']='내장형 RAL 5005 유광'
ws['B6']='내장형 RAL 5005 유광 (DY#1-BL141)'
# 8번 ACGIH 산화철 (BL141에 없음) 삭제
r=find('산화철',1,find('ACGIH')); row_blank(r)
# 9번 색상
r=find('색상',1,find('9. 물리화학')); ws.cell(r,2).value='청색'
# 16번
r=find('나. 최초작성일'); today=datetime.datetime(2026,10,7)
ws.cell(r,3).value=today
def find_exact(t,start):
    for r in range(start,ws.max_row+1):
        if str(ws.cell(r,1).value or '').strip()==t: return r
ws.cell(find_exact('개정횟수',r),3).value='1 회'
ws.cell(find_exact('최종개정일자',r),3).value=today
# ---- 8번: ACGIH 구리 프탈로시아닌 (KOSHA: TWA 1 ㎎/㎥) — 비워 둔 행 재사용 ----
r=find('이산화티타늄',1,find('ACGIH'))+1
ws.cell(r,1).value='                 구리 프탈로시아닌'; ws.cell(r,2).value='TWA - 1  ㎎/㎥'
ws.cell(r,1)._style=copy.copy(ws.cell(r-1,1)._style); ws.cell(r,2)._style=copy.copy(ws.cell(r-1,2)._style)
ws.row_dimensions[r].height=ws.row_dimensions[r-1].height
for c in range(1,6):
    pass
ws.merge_cells(start_row=r,start_column=2,end_row=r,end_column=5) if not any(m.min_row==r and m.min_col==2 for m in ws.merged_cells.ranges) else None

def norm(v): return re.sub(r'\s+',' ',str(v or '').strip())
def rows_with(label,lo,hi):
    for k in range(lo,hi):
        if norm(ws.cell(k,1).value)==label: return k
    raise KeyError(label)
def sec_range(n):
    a=next(k for k in range(1,ws.max_row+1) if re.match(rf'^{n}\.\s*',norm(ws.cell(k,1).value)) and ws.cell(k,1).fill.fgColor.rgb.endswith('E6E6FA'))
    b=next((k for k in range(a+1,ws.max_row+1) if re.match(rf'^{n+1}\.\s*',norm(ws.cell(k,1).value))),ws.max_row)
    return a,b
IND=' '*17
OPS=[]   # (이 줄 "앞"에 끼울 라벨 행, [(A,B),...])
a11,b11=sec_range(11); a12,b12=sec_range(12); a15,b15=sec_range(15)
CU='구리 프탈로시아닌'; SX='SONOX626'
def before(label,lo,hi,items): OPS.append((rows_with(label,lo,hi),items))
OPS.append((next(k for k in range(a11,b11) if norm(ws.cell(k,1).value).startswith('C.I. 색소 황색 83')),[(CU,'LD50 > 6400 ㎎/㎏ Rat'),(SX,'LD50 > 5500 ㎎/㎏ Rat')]))
before('- 흡입',a11,b11,[(CU,'LD50 > 5000 ㎎/㎏ Rat'),(SX,'LD50 ≥ 2000 ㎎/㎏ Rabbit')])
before('- 피부부식성 또는 자극성',a11,b11,[(CU,'가스 LD50 > 5000 ㎎/㎏ Rabbit')])
before('- 심한 눈손상 또는 자극성',a11,b11,[(CU,'자극성 없음, Rabbit, 부종점수 0.1/4, 7일 내 회복')])
before('- 호흡기과민성',a11,b11,[(CU,'자극성 없음, Rabbit, 72시간 내 완전히 가역적')])
before('- 발암성',a11,b11,[(CU,'과민성 없음, Mouse, 국소 림프절 시험(LLNA), OECD TG 429')])
before('- 생식독성',a11,b11,[(CU,'음성(복귀돌연변이시험 OECD TG 471, 포유류 생식세포 유전자 돌연변이시험 OECD TG 484)'),(SX,'음성(복귀돌연변이시험, 염색체이상시험)')])
before('- 특정 표적장기 독성 (1회 노출)',a11,b11,[(CU,'영향 없음, 랫드, NOAEL = 1000 mg/kg bw/day (OECD TG 421, GLP)')])
before('- 특정 표적장기 독성 (반복 노출)',a11,b11,[('카브아졸 다이옥사진 바이올렛(C.I. 색소 보라색 23)','흡입시 기도를 자극함')])
before('- 갑각류',a12,b12,[(CU,'NOEC ≥ 100 ㎎/ℓ 96 hr Danio rerio (OECD TG 203)'),(SX,'LC50 100 ㎎/ℓ 96 hr')])
before('- 조류',a12,b12,[(CU,'EC0 ≥ 500 ㎎/ℓ 48 hr Daphnia magna'),(SX,'EC50 92.2 ㎎/ℓ 48 hr Daphnia magna')])
before('나. 잔류성 및 분해성',a12,b12,[(CU,'EC50 > 100 ㎎/ℓ 72 hr Desmodesmus subspicatus (OECD TG 201)')])
before('- 분해성',a12,b12,[(CU,'log Kow 6.6 (예측값)'),(SX,'log Kow 4.95 (25 ℃)')])
before('나. 화학물질관리법에 의한 규제',a15,b15,[(CU,'관리대상유해물질')])
before('바. 기타 국내 및 외국법에 의한 규제',a15,b15,[(CU,'지정폐기물'),(SX,'지정폐기물')])
def insert_rows(before_row,items):
    n=len(items); tpl=before_row-1
    merges=[CellRange(str(m)) for m in ws.merged_cells.ranges]
    for m in merges: ws.unmerge_cells(str(m))
    hs={r:d.height for r,d in ws.row_dimensions.items() if d.height}
    ws.insert_rows(before_row,n)
    for r in sorted(hs,reverse=True):
        if r>=before_row: ws.row_dimensions[r+n].height=hs[r]
    tmerge=[m for m in merges if m.min_row==m.max_row==tpl]
    for m in merges:
        if m.min_row>=before_row: m.shift(row_shift=n)
        ws.merge_cells(str(m))
    brks=[b.id for b in ws.row_breaks.brk]; ws.row_breaks=RowBreak()
    for b in brks: ws.row_breaks.append(Break(id=b+n if b>=before_row else b))
    for i,(a,b) in enumerate(items):
        r=before_row+i
        for c in range(1,6): ws.cell(r,c)._style=copy.copy(ws.cell(tpl,c)._style)
        ws.cell(r,1).value=IND+a; ws.cell(r,2).value=b
        ws.row_dimensions[r].height=hs.get(tpl) or 20
        for m in tmerge: ws.merge_cells(start_row=r,start_column=m.min_col,end_row=r,end_column=m.max_col)
for row,items in sorted(OPS,reverse=True): insert_rows(row,items)

wb.save('DY#1-BL141_MSDS_초안.xlsx')
for i,n in enumerate(NEW): print(38+i,n[0][:30],n[2],rng(n[3]))
