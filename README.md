# 대양피엔티㈜ 웹사이트

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

데이터는 Supabase 프로젝트 "대양피앤티 홈페이지"에 저장됩니다 (연결 설정: `js/sb.js`).
관리자 계정은 Supabase 대시보드 Authentication → Users에서 만들고, 같은 이메일을 `public.admins` 테이블에 넣어야 관리자 권한이 생깁니다.
