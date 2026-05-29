import { useEffect, useState } from "react";
import { getGameNote, saveGameNote } from "../api/gameApi";

export default function NotePanel({ gameId }) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("讀取中");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadNote() {
      try {
        setStatus("讀取中");
        setLoaded(false);
        const data = await getGameNote({ gameId });
        if (!ignore) {
          setContent(data.content || "");
          setLoaded(true);
          setStatus("已同步");
        }
      } catch (err) {
        console.error(err);
        if (!ignore) {
          setLoaded(true);
          setStatus("可書寫");
        }
      }
    }

    loadNote();

    return () => {
      ignore = true;
    };
  }, [gameId]);

  useEffect(() => {
    if (!gameId || !loaded) return;

    setStatus("等待儲存");
    const timer = window.setTimeout(async () => {
      try {
        setStatus("儲存中");
        await saveGameNote({ gameId, content });
        setStatus("已同步");
      } catch (err) {
        console.error(err);
        setStatus("稍後重試");
      }
    }, 650);

    return () => window.clearTimeout(timer);
  }, [gameId, content, loaded]);

  return (
    <section className="note-panel dossier-panel">
      <aside className="dossier-sidebar">
        <div className="dossier-title">
          <strong>筆記</strong>
          <span>NOTE</span>
        </div>
        <div className="note-status">{status}</div>
      </aside>

      <div className="dossier-paper">
        <textarea
          className="note-textarea"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="記下你的推理、矛盾、時間線..."
        />
      </div>
    </section>
  );
}
