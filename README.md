# 대양피앤티㈜ 웹사이트

분체도료 회사 소개 사이트. `index.html`을 브라우저로 열면 됩니다.

- `index.html` 홈 (제품군 + 칼라칩)
- `products.html` 제품 (내부용·외부용·무늬·기능성)
- `product-interior.html` 내부용
- `product-exterior.html` 외부용
- `product-pattern.html` 무늬
- `product-functional.html` 기능성
- `applications.html` 적용 분야
- `about.html` 회사소개 (소개·기업이념·비전)
- `partnership.html` 제휴문의
- `manager/` 관리자 페이지 (로그인 필요)

## 관리자 페이지

`manager/login.html`에서 로그인하면 `manager/index.html`에서 다음을 관리합니다.

- 공지사항 작성·수정·삭제 → `notices.html`에 표시
- 제휴문의 확인·처리 상태·메모 (제휴문의 폼 제출 내용)
- 채용 버튼 열기/닫기 → `careers.html`
- 자료실 파일 업로드·삭제 → 인증서는 `resources.html`, MSDS는 `msds.html`
- 장치 기록: 호기별 기록 데이터(날짜·품명·코드·축 각도·출력 속도·온도·완료 시간 등) 입력 → 값을 골라 확정 기준값으로 저장 → 현장용 출력·엑셀 저장. 측정 항목은 [항목 설정]에서 추가·변경. 처음 한 번 `supabase/device_logs.sql`을 SQL Editor에서 실행해야 함
- 라벨 출력: 품명·제품코드로 등록된 MSDS를 찾으면 MSDS의 유해·위험문구(H코드)로 GHS 그림문자·신호어, 권고 용도로 종류(예: 폴리에스테르계)를 불러오고, 유해·위험문구·예방조치문구·공급원도 MSDS에서 가져와 130×150mm 제품 라벨을 만든다. Zebra ZT421로 [인쇄](드라이버 용지 130×150mm) 또는 [ZPL 파일 저장](라벨 전체를 그림으로 바꾼 ZPL, 203/300dpi)

데이터는 Supabase 프로젝트 "대양피앤티 홈페이지"에 저장됩니다 (연결 설정: `js/sb.js`).
관리자 계정은 Supabase 대시보드 Authentication → Users에서 만들고, 같은 이메일을 `public.admins` 테이블에 넣어야 관리자 권한이 생깁니다.
