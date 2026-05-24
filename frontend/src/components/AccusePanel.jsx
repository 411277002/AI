import { useState } from "react";
import { Gavel } from "lucide-react";
import { accuseSuspect } from "../api/gameApi";

export default function AccusePanel({ gameId, aiNpcs, report, setReport }) {
  const [suspectId, setSuspectId] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultCorrect, setResultCorrect] = useState(null);

  async function handleAccuse() {
    if (!suspectId) {
      alert("請選擇要指認的嫌疑人");
      return;
    }

    if (!reason.trim()) {
      alert("請填寫你的推理理由");
      return;
    }

    try {
      setLoading(true);

      const data = await accuseSuspect({
        gameId,
        suspectId,
        reason,
      });

      setResultCorrect(data.correct);
      setReport(data.report);
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel accuse-panel">
      <div className="panel-title">
        <Gavel size={18} />
        <h2>最終指認</h2>
      </div>

      {!report ? (
        <>
          <label className="form-label">選擇你認為的兇手</label>
          <select
            value={suspectId}
            onChange={(e) => setSuspectId(e.target.value)}
          >
            <option value="">請選擇嫌疑人</option>
            {aiNpcs.map((npc) => (
              <option key={npc.id} value={npc.id}>
                {npc.name} / {npc.role}
              </option>
            ))}
          </select>

          <label className="form-label">你的推理理由</label>
          <textarea
            value={reason}
            placeholder="請說明你為什麼認為他/她是真兇，例如：哪個證據、哪段供詞或哪個矛盾點讓你做出判斷？"
            onChange={(e) => setReason(e.target.value)}
          />

          <button
            className="danger-btn"
            disabled={loading}
            onClick={handleAccuse}
          >
            {loading ? "生成報告中..." : "提交最終指認"}
          </button>
        </>
      ) : (
        <div className="report">
          <h3>{resultCorrect ? "指認正確" : "指認錯誤"}</h3>
          <pre>{report}</pre>
        </div>
      )}
    </section>
  );
}