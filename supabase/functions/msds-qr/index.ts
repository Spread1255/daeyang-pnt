// 라벨 QR → 그 제품의 MSDS PDF 열기 (2026-11-04)
//  홈페이지 MSDS 목록이 비공개여도, 라벨 QR(재고 앱이 발급한 7자리 토큰)을 가진 사람은 그 제품 MSDS 한 개만 볼 수 있다.
//  1) 재고 앱 DB의 qr_public(토큰)으로 제품 코드를 확인 (공개 함수, 공개 anon 키)
//  2) 홈페이지 resources(category='msds')에서 그 코드의 파일을 찾아 5분짜리 서명 주소로 보낸다 (302)
//  찾지 못하면 안내 페이지. 다른 제품·목록은 볼 수 없다.
import { createClient } from "jsr:@supabase/supabase-js@2";

const INV_URL = "https://byvgrmihziqalticmyvc.supabase.co";
// 재고 앱의 브라우저 공개용(anon) 키: supabase-config.js 와 같은 값 (노출돼도 되는 키)
const INV_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5dmdybWloemlxYWx0aWNteXZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMjMxNzMsImV4cCI6MjEwNzY5OTE3M30.qwN7UcPEDTg2TU_YIIBtOH4VOYLKXTCFNGcH9V2Ky6s";
const TOKEN_RE = /^[2-9A-HJ-NP-Z]{7}$/;

function page(msg: string, status = 404) {
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MSDS</title>
<body style="font-family:-apple-system,'Malgun Gothic',sans-serif;background:#f3f5fa;margin:0;padding:24px;color:#0f172a">
<div style="max-width:420px;margin:40px auto;background:#fff;border-radius:16px;padding:24px;box-shadow:0 4px 16px rgba(15,23,42,.08)">
<h2 style="margin:0 0 10px;font-size:20px">📄 MSDS</h2><p style="line-height:1.6;margin:0 0 16px">${msg}</p>
<p style="margin:0;color:#475569;font-size:14px">(주)대양피앤티 포천공장 · <a href="tel:031-987-8587">031-987-8587</a></p></div></body></html>`;
  return new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

Deno.serve(async (req) => {
  const t = (new URL(req.url).searchParams.get("t") || "").trim().toUpperCase();
  if (!TOKEN_RE.test(t)) return page("라벨 QR 주소가 올바르지 않습니다.", 400);
  try {
    const r = await fetch(INV_URL + "/rest/v1/rpc/qr_public", {
      method: "POST",
      headers: { apikey: INV_ANON, Authorization: "Bearer " + INV_ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: t }),
    });
    const p = r.ok ? await r.json() : null;
    if (!p || !p.code) return page("등록되지 않은 라벨입니다.");
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const { data: rows } = await sb.from("resources").select("file_path, file_type").eq("category", "msds").eq("product_code", p.code)
      .not("file_path", "is", null).order("id", { ascending: false }).limit(1);
    const row = rows && rows[0];
    if (!row) return page(`${p.code} ${p.name || ""} 제품의 MSDS를 준비 중입니다. 필요하시면 아래 전화로 요청해 주세요.`);
    const { data: s, error } = await sb.storage.from("msds-files").createSignedUrl(row.file_path, 300);
    if (error || !s) return page("MSDS 파일을 열지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
    return new Response(null, { status: 302, headers: { Location: s.signedUrl, "Cache-Control": "no-store" } });
  } catch (_e) {
    return page("잠시 후 다시 시도해 주세요.", 500);
  }
});
