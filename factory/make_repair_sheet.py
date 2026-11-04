from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import FormulaRule
from openpyxl.utils import get_column_letter as L

OUT = "/home/user/daeyang-pnt/factory/공장 하자 보수 기록표.xlsx"
N = 200  # 입력 줄 수
F = "맑은 고딕"
thin = Side(style="thin", color="999999")
box = Border(left=thin, right=thin, top=thin, bottom=thin)
head_fill = PatternFill("solid", fgColor="1F4E78")
sub_fill = PatternFill("solid", fgColor="DDEBF7")
center = Alignment(horizontal="center", vertical="center", wrap_text=True)
left = Alignment(horizontal="left", vertical="center", wrap_text=True)

wb = Workbook()

# ---------- 목록 (드롭다운 항목) ----------
lists = {
    "공장": ["제1공장", "제2공장", "창고", "사무동", "기타"],
    "분류": ["건축(지붕·벽체)", "바닥", "누수·배관", "전기·배선", "조명", "공조·환기",
           "집진기", "생산설비", "소방·안전시설", "출입문·셔터", "도로·주차장", "기타"],
    "긴급도": ["긴급", "높음", "보통", "낮음"],
    "상태": ["접수", "견적·검토", "진행 중", "보류", "완료"],
}
ws_l = wb.active
ws_l.title = "목록"
ws_l["A1"] = "드롭다운 항목 (빈 칸에 추가하면 하자 기록 시트에서 바로 고를 수 있음)"
ws_l["A1"].font = Font(name=F, bold=True)
for c, (k, vals) in enumerate(lists.items(), start=1):
    h = ws_l.cell(row=2, column=c, value=k)
    h.font = Font(name=F, bold=True, color="FFFFFF"); h.fill = head_fill; h.alignment = center; h.border = box
    for r in range(3, 23):
        cell = ws_l.cell(row=r, column=c, value=vals[r-3] if r-3 < len(vals) else None)
        cell.font = Font(name=F); cell.border = box
    ws_l.column_dimensions[L(c)].width = 20

# ---------- 하자 기록 ----------
ws = wb.create_sheet("하자 기록", 0)
cols = [  # (제목, 너비)
    ("No", 5), ("접수일", 12), ("공장", 9), ("세부 위치", 16), ("분류", 14),
    ("하자 내용", 34), ("긴급도", 7), ("발견자", 8), ("원인", 20), ("조치 내용", 30),
    ("담당자·업체", 12), ("완료 예정일", 12.5), ("완료일", 12), ("비용(원)", 11),
    ("상태", 9), ("경과일", 7), ("비고·사진", 16),
]
last = L(len(cols))
ws.merge_cells(f"A1:{last}1")
ws["A1"] = "대양피앤티㈜ 공장 하자 보수 기록표"
ws["A1"].font = Font(name=F, size=16, bold=True); ws["A1"].alignment = center
ws.row_dimensions[1].height = 30
ws.merge_cells(f"A2:{last}2")
ws["A2"] = '=" 오늘 "&TEXT(TODAY(),"yyyy-mm-dd")&"   ·   전체 "&COUNTA(F5:F%d)&"건  /  미완료 "&(COUNTA(F5:F%d)-COUNTIF(O5:O%d,"완료"))&"건  /  예정일 지남 "&SUMPRODUCT((L5:L%d<>"")*(L5:L%d<TODAY())*(O5:O%d<>"완료"))&"건"' % ((N+4,)*6)
ws["A2"].font = Font(name=F, size=10, color="555555"); ws["A2"].alignment = Alignment(horizontal="right")

for c, (t, w) in enumerate(cols, start=1):
    cell = ws.cell(row=4, column=c, value=t)
    cell.font = Font(name=F, bold=True, color="FFFFFF"); cell.fill = head_fill
    cell.alignment = center; cell.border = box
    ws.column_dimensions[L(c)].width = w
ws.row_dimensions[4].height = 24
ws.merge_cells("A3:Q3")
ws["A3"] = "※ 흰 칸만 입력. No·경과일은 자동. 공장·분류·긴급도·상태는 목록에서 선택(목록 시트에서 항목 추가 가능). 완료일을 넣으면 상태를 '완료'로."
ws["A3"].font = Font(name=F, size=9, color="7F7F7F")

auto_fill = PatternFill("solid", fgColor="F2F2F2")
for r in range(5, N+5):
    ws.row_dimensions[r].height = 30
    for c in range(1, len(cols)+1):
        cell = ws.cell(row=r, column=c)
        cell.border = box; cell.font = Font(name=F, size=10)
        cell.alignment = left if cols[c-1][0] in ("세부 위치","하자 내용","원인","조치 내용","비고·사진","담당자·업체") else center
    ws.cell(row=r, column=1, value=f'=IF(F{r}="","",ROW()-4)').fill = auto_fill
    ws.cell(row=r, column=16, value=f'=IF(B{r}="","",IF(M{r}<>"",M{r}-B{r},TODAY()-B{r}))').fill = auto_fill
    for c in (2, 12, 13):
        ws.cell(row=r, column=c).number_format = "yyyy-mm-dd"
    ws.cell(row=r, column=14).number_format = "#,##0"
    ws.cell(row=r, column=16).number_format = "0"

rng = lambda col: f"{col}5:{col}{N+4}"
for col, key, li in (("C","공장",1), ("E","분류",2), ("G","긴급도",3), ("O","상태",4)):
    dv = DataValidation(type="list", formula1=f"=목록!${L(li)}$3:${L(li)}$22", allow_blank=True,
                        showErrorMessage=True, errorTitle="목록에 없음",
                        error="목록 시트에 있는 항목만 고를 수 있습니다.")
    ws.add_data_validation(dv); dv.add(rng(col))
dvd = DataValidation(type="date", operator="greaterThan", formula1="DATE(2000,1,1)", allow_blank=True,
                     showErrorMessage=True, error="날짜로 입력하세요 (예: 2026-11-04)")
ws.add_data_validation(dvd)
for col in "BLM": dvd.add(rng(col))

body = f"A5:{last}{N+4}"
cf = ws.conditional_formatting
cf.add(body, FormulaRule(formula=['$O5="완료"'], fill=PatternFill("solid", fgColor="E2EFDA"), font=Font(color="7F7F7F"), stopIfTrue=True))
cf.add(rng("G"), FormulaRule(formula=['G5="긴급"'], fill=PatternFill("solid", fgColor="FF7C80"), font=Font(bold=True)))
cf.add(rng("G"), FormulaRule(formula=['G5="높음"'], fill=PatternFill("solid", fgColor="FFD966")))
cf.add(rng("L"), FormulaRule(formula=['AND(L5<>"",L5<TODAY(),$O5<>"완료")'], font=Font(color="C00000", bold=True)))
cf.add(rng("O"), FormulaRule(formula=['O5="진행 중"'], fill=PatternFill("solid", fgColor="DDEBF7")))
cf.add(rng("O"), FormulaRule(formula=['O5="보류"'], fill=PatternFill("solid", fgColor="EDEDED")))

ws.freeze_panes = "C5"
ws.auto_filter.ref = f"A4:{last}{N+4}"
ws.print_title_rows = "4:4"
ws.print_area = f"A1:{last}{N+4}"
ws.page_setup.orientation = "landscape"; ws.page_setup.paperSize = ws.PAPERSIZE_A4
ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
ws.sheet_properties.pageSetUpPr.fitToPage = True
ws.page_margins.left = ws.page_margins.right = 0.3
ws.page_margins.top = ws.page_margins.bottom = 0.5
ws.oddFooter.center.text = "&P / &N"
ws.print_options.horizontalCentered = True

# ---------- 요약 ----------
wsum = wb.create_sheet("요약", 1)
wsum["A1"] = "하자 보수 현황 요약"; wsum["A1"].font = Font(name=F, size=14, bold=True)
wsum["A2"] = '="기준일 "&TEXT(TODAY(),"yyyy-mm-dd")'; wsum["A2"].font = Font(name=F, color="555555")
R = "'하자 기록'!"
def table(r0, title, key_col, keys):
    hdr = [title, "전체", "미완료", "완료", "비용 합계(원)"]
    for i, h in enumerate(hdr):
        c = wsum.cell(row=r0, column=1+i, value=h)
        c.font = Font(name=F, bold=True, color="FFFFFF"); c.fill = head_fill; c.alignment = center; c.border = box
    for j, k in enumerate(keys):
        r = r0+1+j
        kc = f"{R}${key_col}$5:${key_col}${N+4}"; st = f"{R}$O$5:$O${N+4}"; cost = f"{R}$N$5:$N${N+4}"
        vals = [k, f'=COUNTIF({kc},A{r})', f'=B{r}-D{r}', f'=COUNTIFS({kc},A{r},{st},"완료")', f'=SUMIF({kc},A{r},{cost})']
        for i, v in enumerate(vals):
            c = wsum.cell(row=r, column=1+i, value=v); c.border = box; c.font = Font(name=F)
            c.alignment = left if i == 0 else center
        wsum.cell(row=r, column=5).number_format = "#,##0"
    return r0 + len(keys) + 2

r = 4
r = table(r, "긴급도", "G", lists["긴급도"])
r = table(r, "공장", "C", lists["공장"])
r = table(r, "분류", "E", lists["분류"])
# 상태
for i, h in enumerate(["상태", "건수"]):
    c = wsum.cell(row=r, column=1+i, value=h)
    c.font = Font(name=F, bold=True, color="FFFFFF"); c.fill = head_fill; c.alignment = center; c.border = box
for j, k in enumerate(lists["상태"]):
    rr = r+1+j
    wsum.cell(row=rr, column=1, value=k).border = box
    c = wsum.cell(row=rr, column=2, value=f"=COUNTIF({R}$O$5:$O${N+4},A{rr})"); c.border = box; c.alignment = center
    wsum.cell(row=rr, column=1).font = Font(name=F)
for c, w in zip("ABCDE", (18, 9, 9, 9, 15)):
    wsum.column_dimensions[c].width = w
wsum.page_setup.paperSize = wsum.PAPERSIZE_A4
wsum.sheet_properties.pageSetUpPr.fitToPage = True
wsum.page_setup.fitToHeight = 1

wb.active = 0
wb.save(OUT)
print("saved", OUT)
