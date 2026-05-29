import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquare, Send, X } from "lucide-react";
import { groupChat } from "../api/gameApi";

function buildDefaultIntro(npc) {
  if (npc.group_intro) return npc.group_intro;
  if (npc.introduction) return npc.introduction;

  const role = npc.role ? `我是${npc.name}，${npc.role}。` : `我是${npc.name}。`;
  const background = npc.public_background
    ? `${npc.public_background}`
    : "我也是今晚被困在這裡的人之一。";

  return `${role}${background}`;
}

export default function DiscussionPanel({
  gameId,
  aiNpcs,
  targetNpc,
  messages,
  setMessages,
  discoveredEvidence,
  selectedEvidenceId,
  setSelectedEvidenceId,
  setDiscoveredEvidence,
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [npcPressure, setNpcPressure] = useState({});
  const bottomRef = useRef(null);

  const selectedEvidence = useMemo(() => {
    return discoveredEvidence.find((item) => item.id === selectedEvidenceId);
  }, [discoveredEvidence, selectedEvidenceId]);

  const displayMessages = useMemo(() => {
    if (!targetNpc?.id) return messages || [];

    return (messages || []).filter((message) => {
      if (message.type === "npc") return message.npcId === targetNpc.id;
      if (message.type === "player") return message.targetNpcId === targetNpc.id;
      return message.targetNpcId === targetNpc.id;
    });
  }, [messages, targetNpc]);

  useEffect(() => {
    if (!messages || messages.length > 0) return;

    const introMessages = [
      {
        id: `system-${Date.now()}`,
        type: "system",
        speaker: "系統",
        content:
          "所有嫌疑人已進入迴聲別墅臨時討論室。你可以直接向所有人提問，也可以使用 @角色名 指定某位玩家回答。",
      },
      ...(aiNpcs || []).map((npc) => ({
        id: `intro-${npc.id}-${Date.now()}`,
        type: "npc",
        npcId: npc.id,
        speaker: npc.name,
        role: npc.role || "",
        content: buildDefaultIntro(npc),
        pressure: 0,
      })),
    ];

    setMessages(introMessages);
  }, [aiNpcs, messages, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function insertMention(npc) {
    const mention = `@${npc.name} `;

    setInput((prev) => {
      if (!prev.trim()) return mention;
      if (prev.includes(`@${npc.name}`)) return prev;
      return `${mention}${prev}`;
    });
  }

  async function handleSend() {
    const text = input.trim();

    if (!text || sending) return;

    try {
      setSending(true);

      const playerMessage = {
        id: `player-${Date.now()}`,
        type: "player",
        speaker: "你",
        content: text,
        targetNpcId: targetNpc?.id || "",
        targetNpcName: targetNpc?.name || "",
        evidence: selectedEvidence || null,
      };

      setMessages((prev) => [...prev, playerMessage]);
      setInput("");

      const data = await groupChat({
        gameId,
        message: text,
        evidenceId: selectedEvidenceId || undefined,
      });

      const replyMessages = (data.replies || []).map((reply, index) => ({
        id: `npc-${reply.npcId}-${Date.now()}-${index}`,
        type: "npc",
        npcId: reply.npcId,
        speaker: reply.npc,
        role: reply.role || "",
        content: reply.reply,
        pressure: reply.pressure || 0,
      }));

      setMessages((prev) => [...prev, ...replyMessages]);

      if (data.discoveredEvidence) {
        setDiscoveredEvidence(data.discoveredEvidence);
      }

      if (data.npcPressure) {
        setNpcPressure(data.npcPressure);
      }

      // 送出一次後自動取消出示，避免下一句誤用同一個證據
      if (selectedEvidenceId) {
        setSelectedEvidenceId("");
      }
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  return (
    <section className="panel discussion-panel">
      <div className="discussion-header">
        <div className="panel-title">
          <MessageSquare size={18} />
          <h2>{targetNpc ? "角色對話" : "群組偵訊室"}</h2>
        </div>
      </div>

      <div className="discussion-messages">
        {displayMessages.length === 0 ? (
          <p className="empty-message">
            {targetNpc
              ? `你與${targetNpc.name}的對話尚未開始。`
              : "群組偵訊室已建立，請輸入問題開始討論。"}
          </p>
        ) : (
          displayMessages.map((message) => (
            <div
              key={message.id}
              className={`discussion-message ${message.type}`}
            >
              <div className="discussion-message-meta">
                <strong>{message.speaker}</strong>
                {message.role && <span>{message.role}</span>}
              </div>

              {message.evidence && (
                <div className="evidence-tag">
                  出示證據：{message.evidence.name}
                </div>
              )}

              <p>{message.content}</p>
            </div>
          ))
        )}

        {sending && (
          <div className="discussion-message system">
            <div className="discussion-message-meta">
              <strong>系統</strong>
            </div>
            <p>正在回覆中...</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {selectedEvidence && (
        <div className="selected-evidence-bar">
          <div>
            <span>本次出示證據</span>
            <strong>{selectedEvidence.name}</strong>
          </div>

          <button
            type="button"
            onClick={() => setSelectedEvidenceId("")}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="discussion-input">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={targetNpc ? `輸入你想問${targetNpc.name}的問題...` : "輸入問題，或用 @角色名 指定玩家回答..."}
        />

        <button
          type="button"
          className="primary-btn send-btn"
          disabled={sending || !input.trim()}
          onClick={handleSend}
        >
          <Send size={16} />
          送出
        </button>
      </div>
    </section>
  );
}
