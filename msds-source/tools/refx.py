import openpyxl,glob,sys,json,zipfile
def ext(f):
  ws=openpyxl.load_workbook(f,data_only=True).worksheets[0]
  rows=[[str(c.value).strip() for c in r if c.value is not None and str(c.value).strip()] for r in ws.iter_rows()]
  no=[r for r in rows if r and 'MSDS NO' in r[0]][0][0].split()[-1]
  nm=rows[2][1]; code=rows[5][1].split('(')[-1].rstrip(')').strip()
  ix=lambda p: next(i for i,r in enumerate(rows) if r and r[0].startswith(p))
  i2,i3,i4=ix('2.'),ix('3.'),ix('4.')
  sec2=[x for r in rows[i2+1:i3] for x in r if x[:2] not in('가.','나.') and x not in('그림문자','신호어','유해·위험문구','예방조치문구','예방','대응','저장','폐기')]
  sec3=[r if len(r)==4 else [r[0],None,r[1],r[2]] for r in rows[i3+2:i4] if r]
  s16={r[0].replace('나. ',''):(r[1].split()[0] if len(r)>1 else '') for r in rows if r and r[0] in('나. 최초작성일','개정횟수','최종개정일자')}
  if s16.get('개정횟수') and '회' not in s16['개정횟수']: s16['개정횟수']+=' 회'
  col=[r[1] for r in rows if r and r[0]=='색상']
  s8=[r[0] for r in rows[ix('8.'):ix('9.')] if len(r)>1 and not r[0].startswith(('가.','나.','다.'))]
  imgs=len([n for n in zipfile.ZipFile(f).namelist() if 'media' in n])
  return dict(code=code,name=nm,msds_no=no,sec2=sec2,sec3=sec3,sec16=s16,color=col[0] if col else None,sec8=s8,imgs=imgs)
if __name__=='__main__':
  for f in sorted(glob.glob(sys.argv[1]+'/*.xlsx')):
    d=ext(f); print('==',d['code'],d['name'],d['msds_no'],d['sec16'],d['color'],'imgs',d['imgs']); print('  2:',' / '.join(x[:14] for x in d['sec2'])); [print('  ',x[0][:40],'|',(x[1] or '')[:30],'|',x[2],'|',x[3]) for x in d['sec3']]; print('  8:',d['sec8'])
