# 품질 개선 요청서 도우미 (교육용 가상 데이터)

분석된 검사 데이터를 올리면 그래프로 확인하고, AI가 불량 원인 후보와 개선 요청서 초안을 만들어 주는 웹앱입니다.
작성 시작·완료 시각, 소요시간, AI 초안 활용 여부를 기록해 활용률과 작성 시간 단축률을 보여 줍니다.
모든 데이터는 교육용 가상 데이터입니다.

## 구성
- `index.html` 입력 화면 / 목록·요약 화면 (Chart.js, SheetJS는 CDN)
- `api/draft.js` AI 초안 생성 (`ANTHROPIC_API_KEY`가 없으면 템플릿으로 대체)
- `api/records.js` 작성 기록 저장 (Vercel Blob, `BLOB_READ_WRITE_TOKEN`이 없으면 브라우저 저장으로 대체)
- `api/_seed.js` 시연 데이터 30건 (과거 이력 25건 + 작성 전 시연용 5건)
- `sample-data/` 시연용 분석 데이터(검사001~005)와 시트 샘플

## 배포 (Vercel)
- Root Directory: `quality-draft-app`, Framework Preset: Other
- 환경변수: `ANTHROPIC_API_KEY` (선택 `ANTHROPIC_MODEL`), Blob 저장소를 프로젝트에 연결하면 `BLOB_READ_WRITE_TOKEN`이 자동 설정됩니다.
