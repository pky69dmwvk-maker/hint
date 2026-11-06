// GET  /api/records            -> { records, storage }
// POST /api/records {record}   -> 저장(추가/갱신)
// POST /api/records {action:"reset"} -> 시드 데이터로 되돌리기
import { put, list } from "@vercel/blob";
import SEED from "./_seed.js";

const PATH = "quality-draft/records-v2.json"; // 시연 데이터 버전이 바뀌면 파일 이름을 바꿔 새로 시작
const seed = () => JSON.parse(JSON.stringify(SEED));
const hasStore = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

async function load() {
  const { blobs } = await list({ prefix: PATH, limit: 1 });
  if (!blobs.length) return null;
  const r = await fetch(blobs[0].url + "?t=" + Date.now(), { cache: "no-store" });
  return r.ok ? await r.json() : null;
}
async function save(records) {
  await put(PATH, JSON.stringify(records), { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json", cacheControlMaxAge: 60 });
}
const str = (v, n) => (v == null ? "" : String(v).slice(0, n));
function clean(r) {
  return {
    id: str(r.id, 40), type: str(r.type, 20), occurredAt: str(r.occurredAt, 40), fileName: str(r.fileName, 120),
    phenomenon: str(r.phenomenon, 300), measure: str(r.measure, 120),
    dept: str(r.dept, 40), toEmail: str(r.toEmail, 200), mailedAt: r.mailedAt ? str(r.mailedAt, 40) : null,
    startedAt: r.startedAt ? str(r.startedAt, 40) : null, finishedAt: r.finishedAt ? str(r.finishedAt, 40) : null,
    cause: str(r.cause, 200), aiDraft: str(r.aiDraft, 3000), finalText: str(r.finalText, 3000),
    usedAi: r.usedAi === true ? true : r.usedAi === false ? false : null,
    status: r.status === "done" ? "done" : "pending", source: r.source === "seed" ? "seed" : "user",
  };
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (!hasStore()) return res.status(200).json({ records: seed(), storage: "none" });
      const cur = await load();
      if (cur) return res.status(200).json({ records: cur, storage: "blob" });
      const s = seed();
      await save(s);
      return res.status(200).json({ records: s, storage: "blob" });
    }
    if (req.method === "POST") {
      if (!hasStore()) return res.status(503).json({ error: "no-storage" });
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
      if (body.action === "reset") {
        const s = seed();
        await save(s);
        return res.status(200).json({ records: s, storage: "blob" });
      }
      if (!body.record || !body.record.id) return res.status(400).json({ error: "record.id required" });
      const rec = clean(body.record);
      const cur = (await load()) || seed();
      const i = cur.findIndex((x) => x.id === rec.id);
      if (i >= 0) cur[i] = rec; else cur.push(rec);
      await save(cur);
      return res.status(200).json({ records: cur, storage: "blob" });
    }
    return res.status(405).json({ error: "method not allowed" });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
