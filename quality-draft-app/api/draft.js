// POST /api/draft  -> { cause, draft, source }
// ANTHROPIC_API_KEY 가 있으면 Claude API로, 없거나 실패하면 템플릿으로 초안을 만든다.
const TITLES = {
  "소음 불량": "소음 발생 조건 재확인 요청",
  "진동 불량": "진동 측정 환경 점검 요청",
  "치수 불량": "치수 측정 장비 교정 상태 확인 요청",
  "외관 불량": "표면 손상 발생 공정 확인 요청",
};
const CAUSES = {
  "소음 불량": "부품 체결 상태 / 구동 조건 차이 (가설)",
  "진동 불량": "고정 지그 헐거움 / 측정 환경 차이 (가설)",
  "치수 불량": "측정 장비 교정 주기 / 기준 불일치 (가설)",
  "외관 불량": "이송 구간 접촉 / 세척 절차 누락 (가설)",
};
const ASKS = {
  "소음 불량": "구동 조건별 소음 측정 기준과 측정 절차를 문서로 공유해 주세요.",
  "진동 불량": "측정 환경(고정 지그 상태, 주변 설비 가동)을 점검하고 결과를 회신해 주세요.",
  "치수 불량": "측정 장비 교정 이력과 판정 기준 버전을 확인해 회신해 주세요.",
  "외관 불량": "이송·세척 구간의 접촉 가능 지점을 점검하고 작업 표준을 확인해 주세요.",
};

const clip = (v, n) => String(v ?? "").slice(0, n);

function template(r) {
  const t = TITLES[r.type] || "불량 원인 확인 요청";
  const cause = CAUSES[r.type] || "정보·절차·도구·기준 중 확인이 필요한 항목 (가설)";
  const ask = ASKS[r.type] || "관련 기준과 절차를 확인해 회신해 주세요.";
  const s = r.summary || {};
  const stat = s.rows ? `분석 데이터 ${s.rows}행, 최댓값 ${s.max}${s.unit || ""}, 기준 ${s.criterion || "미확인"}.` : "";
  return {
    cause,
    draft: `[${t}]\n현상: ${r.phenomenon || "-"} (${r.measure || "-"}, 발생 ${r.occurredAt || "-"})\n${stat}\n원인 후보: ${cause}\n요청: ${ask}\n참고: 분석 데이터의 불량 표시는 참고용이며 현장 확인이 필요합니다.`.replace(/\n\n/g, "\n"),
  };
}

function buildPrompt(r) {
  const s = r.summary || {};
  return `너는 제조 현장 품질 엔지니어를 돕는 글쓰기 보조야. 아래 분석 데이터 요약을 바탕으로 '불량 원인 후보 1줄'과 '개선 요청서 초안'을 써 줘.

규칙:
- 원인은 사람 탓이 아니라 정보·절차·도구·기준의 문제로만 쓴다. 확정하지 말고 끝에 (가설)을 붙인다.
- 아래에 주어진 값만 쓴다. 숫자나 사실을 지어내지 않는다.
- 분석 데이터의 '불량' 표시는 참고용이라는 문장을 초안에 넣는다.
- 초안은 6줄 이내, 줄마다 '현상:', '원인 후보:', '요청:', '확인 필요:' 같은 머리말로 시작한다. 제목 한 줄을 맨 위에 둔다.
- 원인 후보는 50자 이내.
- 출력은 JSON 한 개만: {"cause":"...","draft":"..."} (코드블록, 설명 금지)

입력:
불량 유형: ${clip(r.type, 40)}
발생 시각: ${clip(r.occurredAt, 40)}
불량 현상: ${clip(r.phenomenon, 200)}
주요 측정값: ${clip(r.measure, 100)}
분석 데이터: ${s.rows ? `${s.rows}행, 항목 ${clip(s.item, 40)}, 최댓값 ${s.max}${clip(s.unit, 10)}, 최솟값 ${s.min}${clip(s.unit, 10)}, 기준 ${clip(s.criterion, 40)}, 참고용 불량 표시 ${s.flagged ?? 0}행` : "업로드된 데이터 없음"}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const r = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return res.status(200).json({ ...template(r), source: "template", note: "ANTHROPIC_API_KEY 미설정" });
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 25000);
    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
        max_tokens: 700,
        messages: [{ role: "user", content: buildPrompt(r) }],
      }),
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error("api " + resp.status);
    const data = await resp.json();
    const text = (data.content || []).map((b) => b.text || "").join("").trim();
    const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
    if (!json.cause || !json.draft) throw new Error("bad shape");
    return res.status(200).json({ cause: clip(json.cause, 120), draft: clip(json.draft, 1500), source: "claude" });
  } catch (e) {
    return res.status(200).json({ ...template(r), source: "template", note: "Claude 호출 실패로 템플릿 사용: " + e.message });
  }
}
