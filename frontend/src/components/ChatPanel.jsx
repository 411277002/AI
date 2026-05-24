import { useState } from "react";
import { Send, MessageSquare } from "lucide-react";
import { chatWithNpc } from "../api/gameApi";

export default function ChatPanel({
  gameId,
  selectedNpc,
  messages,
  setMessages,
  selectedEvidenceId,
  setSelectedEvidenceId,
  setDiscoveredEvidence,
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pressure, setPressure] = useState(0);

  async function handleSend() {
    if (!selectedNpc || !input.trim()) return;

    const userText = input.trim();

    const userMessage = {
      id: Date.now(),
      role: "player",
      speaker: "你",
      text: userText,
      evidenceId: selectedEvidenceId || null,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setSending(true);

    try {
      const data = await chatWithNpc({
        gameId,
        npcId: selectedNpc.id,
        message: userText,
        evidenceId: selectedEvidenceId || undefined,
      });

      const npcMessage = {
        id: Date.now() + 1,
        role: "npc",
        speaker: data.npc,
        text: data.reply,
      };

      setMessages((prev) => [...prev, npcMessage]);
      setPressure(data.pressure || 0);
      setDiscoveredEvidence(data.discoveredEvidence || []);
      setSelectedEvidenceId("");
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
          role: "system",
          speaker: "系統",
          text: err.message,
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <section className="panel chat-panel">
      <div className="panel-title">
        <MessageSquare size={18} />
        <h2>偵訊室</h2>
      </div>

      {selectedNpc ? (
        <div className="npc-header">
          <div>
            <h3>{selectedNpc.name}</h3>
            <p>{selectedNpc.speech_style}</p>
          </div>
          <div className="pressure">
            壓力值 <strong>{pressure}</strong>
          </div>
        </div>
      ) : (
        <p>請先選擇一位 NPC。</p>
      )}

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-message">
            請輸入問題開始偵訊，例如：「你昨晚在哪？」
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <strong>{msg.speaker}</strong>
              <p>{msg.text}</p>
            </div>
          ))
        )}
      </div>

      {selectedEvidenceId && (
        <div className="evidence-tag">
          本次將出示證據：{selectedEvidenceId}
        </div>
      )}

      <div className="chat-input">
        <textarea
          value={input}
          placeholder={
            selectedNpc ? `質問 ${selectedNpc.name}...` : "請先選擇 NPC"
          }
          disabled={!selectedNpc || sending}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />

        <button
          className="primary-btn"
          disabled={!selectedNpc || sending || !input.trim()}
          onClick={handleSend}
        >
          <Send size={16} />
          {sending ? "等待回覆..." : "送出"}
        </button>
      </div>
    </section>
  );
}