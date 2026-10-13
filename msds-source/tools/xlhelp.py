import copy, re
from openpyxl.worksheet.pagebreak import Break, RowBreak
from openpyxl.worksheet.cell_range import CellRange
IND=' '*17
def norm(v): return re.sub(r'\s+',' ',str(v or '').strip())
def _snap(ws):
    merges=[CellRange(str(m)) for m in ws.merged_cells.ranges]
    for m in merges: ws.unmerge_cells(str(m))
    hs={r:d.height for r,d in ws.row_dimensions.items() if d.height}
    brks=[b.id for b in ws.row_breaks.brk]
    return merges,hs,brks
def _restore(ws,merges,hs,brks,at,n):
    # rows >= at shift by n (n<0: deletion of rows at..at-n-1)
    for r in list(ws.row_dimensions.keys()):
        ws.row_dimensions[r].height=None
    for r,h in hs.items():
        if n<0 and at<=r<at-n: continue
        ws.row_dimensions[r+n if r>=at else r].height=h
    for m in merges:
        if n<0 and m.min_row>=at and m.max_row<at-n: continue
        if m.min_row>=at: m.shift(row_shift=n)
        ws.merge_cells(str(m))
    ws.row_breaks=RowBreak()
    for b in brks: ws.row_breaks.append(Break(id=b+n if b>=at else b))
def delete_row(ws,r):
    merges,hs,brks=_snap(ws); ws.delete_rows(r,1); _restore(ws,merges,hs,brks,r,-1)
def insert_before(ws,r,items,tpl=None):
    tpl=tpl or r-1; n=len(items)
    merges,hs,brks=_snap(ws)
    tmerge=[(m.min_col,m.max_col) for m in merges if m.min_row==m.max_row==tpl]
    ws.insert_rows(r,n); _restore(ws,merges,hs,brks,r,n)
    for i,(a,b) in enumerate(items):
        rr=r+i
        for c in range(1,6): ws.cell(rr,c)._style=copy.copy(ws.cell(tpl,c)._style)
        ws.cell(rr,1).value=(IND+a) if a else None; ws.cell(rr,2).value=b
        ws.row_dimensions[rr].height=hs.get(tpl) or 20
        for c1,c2 in tmerge: ws.merge_cells(start_row=rr,start_column=c1,end_row=rr,end_column=c2)
def sec_range(ws,n):
    a=next(k for k in range(1,ws.max_row+1) if re.match(rf'^{n}\.\s*',norm(ws.cell(k,1).value)) and ws.cell(k,1).fill.fgColor.rgb.endswith('E6E6FA'))
    b=next((k for k in range(a+1,ws.max_row+1) if re.match(rf'^{n+1}\.\s*',norm(ws.cell(k,1).value))),ws.max_row)
    return a,b
def row_of(ws,pred,lo,hi):
    for k in range(lo,hi):
        if pred(norm(ws.cell(k,1).value)): return k
    raise KeyError(pred)
def rng(v):
    """작업지시서 백분율 → MSDS 함유량 범위 (EAGON WHITE 지정값에서 뽑은 기준, 함유량-범위-기준.md 참고)
    가운데값 c = 단위(step)로 반올림(0.5는 내림), 범위 = c-step ∽ c+step
      50 이상: 정수, ±2        (57 → 55 ∽ 59)
      1~50  : 정수, ±1        (22.5 → 21 ∽ 23, 7.56 → 7 ∽ 9, 4.8 → 4 ∽ 6, 3 → 2 ∽ 4)
      0.1~1 : 소수 첫째, ±0.1  (0.85 → 0.7 ∽ 0.9, 0.3 → 0.2 ∽ 0.4)
      0.01~0.1 : 소수 둘째, ±0.01 (0.05 → 0.04 ∽ 0.06)
      소수 셋째 자리 이상 값은 둘째 자리까지 버리고 ±0.01 (0.1392 → 0.12 ∽ 0.14)
      하한은 단위 1칸 아래로 내려가지 않음 / 0.01 미만은 KEEP()에서 제외"""
    import math
    s=repr(v); d=len(s.split('.')[1].rstrip('0')) if '.' in s else 0
    if d>=3: v=int(v*100+1e-9)/100; st=0.01
    else: st=2 if v>=50 else 1 if v>=1 else 0.1 if v>=0.1 else 0.01
    u=1 if st==2 else st
    c=math.ceil(round(v/u-0.5,9))*u
    lo=max(c-st,u); hi=c+st
    dp=0 if u>=1 else (1 if u==0.1 else 2)
    return f'{lo:.{dp}f} ∽ {hi:.{dp}f}'
def KEEP(v): return v>=0.01

# 2번 유해성·위험성 (KOSHA 문구; '…' 빈칸은 채움) — IV064 틀의 16~34행 구조 기준
SEC2_CLASS=['급성 독성(경구) : 구분4','피부 부식성/피부 자극성 : 구분2','발암성 : 구분2']
SEC2_H=['H351 암을 일으킬 것으로 의심됨','H315 피부에 자극을 일으킴','H302 삼키면 유해함']
SEC2_PREV=['P201 사용 전 취급 설명서를 확보하시오.','P202 모든 안전 예방조치 문구를 읽고 이해하기 전에는 취급하지 마시오.',
 'P264 취급 후에는 손을 철저히 씻으시오.','P270 이 제품을 사용할 때에는 먹거나, 마시거나 흡연하지 마시오.','P280 보호장갑/보호의/보안경/안면보호구를(을)착용하시오.']
SEC2_RESP=['P301+P312 삼켰다면: 불편함을 느끼면 의료기관/의사의 진찰을 받으시오.','P302+P352 피부에 묻으면: 다량의 물로 씻으시오.',
 'P308+P313 노출되거나 노출이 우려되면:의학적인 조치/조언을 받으시오.','P321 적절한 처치를 하시오.','P330 입을 씻어내시오.',
 'P332+P313 피부 자극이 나타나면: 의학적인 조치/조언을 받으시오.','P362+P364 오염된 의류를 벗고 다시 사용 전 세척하시오.']
def apply_sec2(ws):
    a,b=sec_range(ws,2)
    assert norm(ws.cell(a+1,1).value).startswith('가.') and a==15
    for i,t in enumerate(SEC2_CLASS): ws.cell(16+i,2).value=t
    for i,t in enumerate(SEC2_H): ws.cell(23+i,2).value=t
    r_resp=row_of(ws,lambda t:t=='대응',a,b); r_store=row_of(ws,lambda t:t=='저장',a,b); r_prev=row_of(ws,lambda t:t=='예방',a,b)
    n_prev=r_resp-r_prev; n_resp=r_store-r_resp
    insert_before(ws,r_store,[(None,None)]*(len(SEC2_RESP)-n_resp))
    insert_before(ws,r_resp,[(None,None)]*(len(SEC2_PREV)-n_prev))
    r_prev=row_of(ws,lambda t:t=='예방',a,b+20); r_resp=row_of(ws,lambda t:t=='대응',a,b+20)
    for i,t in enumerate(SEC2_PREV): ws.cell(r_prev+i,2).value=t
    for i,t in enumerate(SEC2_RESP): ws.cell(r_resp+i,2).value=t

# 수지(폴리에스테르·에폭시·아크릴 수지) — 1 이상이면 정수로 버린 값 ±2 (22 → 20 ∽ 24, 18.6 → 16 ∽ 20, 57 → 55 ∽ 59)
RESIN_CAS={'27923-68-8','114267-10-6','25036-25-3','40471-09-8','37953-21-2','25214-38-4'}
def rng_item(cas,v):
    if cas in RESIN_CAS and v>=1:
        c=int(v+1e-9); return f'{max(c-2,1)} ∽ {c+2}'
    return rng(v)
