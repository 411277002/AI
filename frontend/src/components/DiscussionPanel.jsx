import { useEffect, useMemo, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import { groupChat } from "../api/gameApi";
import { API_BASE } from "../api/config";
import { showNotice } from "../utils/notice";

const CHARACTER_IMAGE_MAP = {
  A: "/cases/case_001_specimen/evidence/谷林.png",
  B: "/cases/case_001_specimen/evidence/谷月.png",
  C: "/cases/case_001_specimen/evidence/韓醫.png",
  D: "/cases/case_001_specimen/evidence/齊莫.png",
};

function resolveAsset(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildDefaultIntro(npc) {
  const role = npc.role ? `我是${npc.name}，${npc.role}。` : `我是${npc.name}。`;
  const background =
    npc.public_background ||
    npc.publicBackground ||
    npc.background ||
    "我正在等待你的問題。";

  return `${role}${background}`;
}

function buildProfileText(npc) {
  return (
    npc.public_background ||
    npc.publicBackground ||
    npc.background ||
    npc.appearance ||
    "此角色檔案尚未公開。"
  );
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
  const bottomRef = useRef(null);

  const selectedEvidence = useMemo(() => {
    return discoveredEvidence.find((item) => item.id === selectedEvidenceId);
  }, [discoveredEvidence, selectedEvidenceId]);

  const displayMessages = useMemo(() => {
    if (!targetNpc?.id) return messages || [];

    return (messages || []).filter((message) => {
      if (message.type === "npc") return message.npcId === targetNpc.id;
      if (message.type === "player") return message.targetNpcId === targetNpc.id;
      return false;
    });
  }, [messages, targetNpc]);

  useEffect(() => {
    if (!messages || messages.length > 0) return;

    setMessages(
      (aiNpcs || []).map((npc) => ({
        id: `intro-${npc.id}-${Date.now()}`,
        type: "npc",
        npcId: npc.id,
        speaker: npc.name,
        role: npc.role || "",
        content: buildDefaultIntro(npc),
        pressure: 0,
      }))
    );
  }, [aiNpcs, messages, setMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages, sending]);

  async function handleSend() {
    const rawText = input.trim();
    if (!rawText || sending || !targetNpc) return;

    const messageForAi = rawText.includes(`@${targetNpc.name}`)
      ? rawText
      : `@${targetNpc.name} ${rawText}`;

    try {
      setSending(true);

      setMessages((prev) => [
        ...prev,
        {
          id: `player-${Date.now()}`,
          type: "player",
          speaker: "你",
          content: rawText,
          targetNpcId: targetNpc.id,
          targetNpcName: targetNpc.name,
          evidence: selectedEvidence || null,
        },
      ]);
      setInput("");

      const data = await groupChat({
        gameId,
        message: messageForAi,
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

      if (selectedEvidenceId) {
        setSelectedEvidenceId("");
      }
    } catch (err) {
      console.error(err);
      showNotice(err.message);
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

  const portrait = resolveAsset(targetNpc?.image || CHARACTER_IMAGE_MAP[targetNpc?.id]);

  return (
    <section className="discussion-panel gothic-chat">
      <header className="gothic-chat-head">
        <div className="gothic-chat-portrait">
          {portrait && <img src={portrait} alt={targetNpc?.name || ""} />}
        </div>
        <div className="gothic-chat-title">
          <div className="gothic-chat-name-row">
            <strong>{targetNpc?.name || "角色"}</strong>
            {targetNpc?.role && <span>{targetNpc.role}</span>}
          </div>
          <p>{targetNpc ? buildProfileText(targetNpc) : "選擇一名角色開始對話。"}</p>
        </div>
      </header>

      <div className="discussion-messages">
        {displayMessages.length === 0 ? (
          <p className="empty-message">你想問我們什麼？</p>
        ) : (
          displayMessages.map((message) => (
            <div key={message.id} className={`discussion-message ${message.type}`}>
              <div className="discussion-message-meta">
                <strong>{message.type === "player" ? "你" : message.speaker}</strong>
                {message.role && <span>{message.role}</span>}
              </div>
              {message.evidence && <div className="evidence-tag">出示線索：{message.evidence.name}</div>}
              <p>{message.content}</p>
            </div>
          ))
        )}

        {sending && (
          <div className="discussion-message npc">
            <div className="discussion-message-meta">
              <strong>{targetNpc?.name}</strong>
            </div>
            <p>......</p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {selectedEvidence && (
        <div className="selected-evidence-bar">
          <div>
            <span>準備出示線索</span>
            <strong>{selectedEvidence.name}</strong>
          </div>
          <button type="button" onClick={() => setSelectedEvidenceId("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="discussion-input">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="輸入你的問題..."
        />
        <button type="button" className="send-btn" disabled={sending || !input.trim()} onClick={handleSend}>
          <Send size={16} />
          發送
        </button>
      </div>
    </section>
  );
}
