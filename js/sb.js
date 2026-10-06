/*
  Supabase 연결 설정
  ------------------------------------------------------------
  공지사항·제휴문의·채용 상태·자료실 데이터를 Supabase(대양피앤티 홈페이지 프로젝트)에서 읽고 씁니다.
  아래 키는 브라우저 공개용(publishable) 키라서 코드에 있어도 괜찮습니다.
  실제 권한은 Supabase의 RLS 정책(관리자만 수정 가능)으로 막혀 있습니다.
*/
(function () {
  var SUPABASE_URL = "https://sdcffvigzrczixbdvkzu.supabase.co";
  var SUPABASE_KEY = "sb_publishable_VRNSegvHcAk8Rh9RSoHzDQ_2WRBaEiN";

  window.DY_SB = window.supabase && window.supabase.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
    : null;

  // downloadName을 주면 파일을 바로 내려받는 주소(페이지 이동 없음)를 돌려준다.
  window.DY_RESOURCE_URL = function (path, downloadName) {
    if (!window.DY_SB) {
      return "";
    }
    var opts = downloadName ? { download: downloadName } : undefined;
    return window.DY_SB.storage.from("resources").getPublicUrl(path, opts).data.publicUrl;
  };

  // MSDS 파일은 비공개 저장소에 있다. 홈페이지 공개 중일 때만 잠깐(60초) 쓸 수 있는 주소를 받아 내려받는다.
  window.DY_MSDS_BUCKET = "msds-files";
  window.DY_MSDS_DOWNLOAD = function (path, downloadName) {
    if (!window.DY_SB) {
      return Promise.reject(new Error("no client"));
    }
    return window.DY_SB.storage
      .from(window.DY_MSDS_BUCKET)
      .createSignedUrl(path, 60, downloadName ? { download: downloadName } : undefined)
      .then(function (res) {
        if (res.error || !res.data) {
          throw res.error || new Error("no url");
        }
        window.location.href = res.data.signedUrl;
      });
  };

  // MSDS 다운로드 파일 이름: "제품코드 제품명.확장자"
  window.DY_MSDS_FILENAME = function (row) {
    var ext = (String(row.file_path || "").match(/\.([a-z0-9]+)$/i) || [, "pdf"])[1];
    var base = [row.product_code, row.product_name || row.title].filter(Boolean).join(" ") || "MSDS";
    return base.replace(/[\\/:*?"<>|]+/g, "_") + "." + ext;
  };
})();
