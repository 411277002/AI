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

const ROOM_IMAGE = "/cases/case_001_specimen/stills/ui/room.png";

function resolveAsset(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildDefaultIntro(npc) {
  const role = npc.role ? `${npc.name}，${npc.role}。` : `${npc.name}。`;
  const background =
    npc.public_background ||
    npc.publicBackground ||
    npc.background ||
    "他正在偵訊室裡等待你的問題。";

  return `${role}${background}`;
}

function normalizeMentionsForApi(text, aiNpcs = []) {
  const aliasToId = new Map([
    ["谷林", "A"],
    ["谷月", "B"],
    ["韓醫", "C"],
    ["韩医", "C"],
    ["齊莫", "D"],
    ["齐莫", "D"],
  ]);

  aiNpcs.forEach((npc) => {
    if (npc?.name && npc?.id) {
      aliasToId.set(String(npc.name).trim(), npc.id);
    }
  });

  return Array.from(aliasToId.entries()).reduce((nextText, [alias, id]) => {
    const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return nextText.replace(new RegExp(`([@＠])${escapedAlias}`, "g"), `@${id}`);
  }, text);
}

function getActiveMention(text) {
  const atIndex = Math.max(text.lastIndexOf("@"), text.lastIndexOf("＠"));
  if (atIndex < 0) return null;

  const query = text.slice(atIndex + 1);
  if (/\s/.test(query)) return null;

  return {
    start: atIndex,
    query,
  };
}

export default function DiscussionPanel({
  gameId,
  aiNpcs,
  messages,
  setMessages,
  discoveredEvidence,
  selectedEvidenceId,
  setSelectedEvidenceId,
  setDiscoveredEvidence,
  currentPhase,
  aiUsage,
  setAiUsage,
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const interrogationRemaining = aiUsage?.interrogationRemaining;
  const interrogationLimit = aiUsage?.interrogationLimit;

  const selectedEvidence = useMemo(() => {
    return discoveredEvidence.find((item) => item.id === selectedEvidenceId);
  }, [discoveredEvidence, selectedEvidenceId]);

  const displayMessages = useMemo(() => messages || [], [messages]);
  const activeMention = useMemo(() => getActiveMention(input), [input]);
  const mentionOptions = useMemo(() => {
    if (!activeMention) return [];

    const query = activeMention.query.trim().toLowerCase();
    return (aiNpcs || [])
      .filter((npc) => {
        const name = String(npc?.name || "");
        const role = String(npc?.role || "");
        const id = String(npc?.id || "");
        const searchable = `${name} ${role} ${id}`.toLowerCase();
        return !query || searchable.includes(query);
      })
      .slice(0, 6);
  }, [activeMention, aiNpcs]);

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
    if (!rawText || sending) return;

    if (interrogationRemaining !== undefined && interrogationRemaining <= 0) {
      showNotice("本階段偵訊次數已用完，請根據目前線索推進劇情。");
      return;
    }

    try {
      setSending(true);

      setMessages((prev) => [
        ...prev,
        {
          id: `player-${Date.now()}`,
          type: "player",
          speaker: "你",
          content: rawText,
          evidence: selectedEvidence || null,
        },
      ]);
      setInput("");

      const data = await groupChat({
        gameId,
        message: normalizeMentionsForApi(rawText, aiNpcs),
        evidenceId: selectedEvidenceId || undefined,
        currentPhase,
      });

      if (data.usage && setAiUsage) {
        setAiUsage(data.usage);
      }

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
    if (event.key === "Escape" && activeMention) {
      event.preventDefault();
      setInput((current) => `${current.slice(0, activeMention.start)}${current.slice(activeMention.start + 1)}`);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey && mentionOptions.length > 0) {
      event.preventDefault();
      handleSelectMention(mentionOptions[0]);
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  function handleSelectMention(npc) {
    if (!activeMention || !npc?.name) return;

    setInput((current) => {
      const mention = getActiveMention(current);
      if (!mention) return current;
      return `${current.slice(0, mention.start)}@${npc.name} `;
    });

    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  const portrait = resolveAsset(ROOM_IMAGE);

  return (
    <section className="discussion-panel gothic-chat">
      <header className="gothic-chat-head">
        <div className="gothic-chat-portrait">
          {portrait && <img src={portrait} alt="" />}
        </div>
        <div className="gothic-chat-title">
          <div className="gothic-chat-name-row">
            <strong>偵訊室</strong>
            <span>GROUP CHAT</span>
          </div>
          <p>直接輸入會讓所有嫌疑人回應；輸入 @名字 會只詢問指定對象。</p>
        </div>
      </header>

      {aiUsage && (
        <div className="usage-meta">
          偵訊剩餘：{interrogationRemaining} / {interrogationLimit}
        </div>
      )}

      <div className="discussion-messages">
        {displayMessages.length === 0 ? (
          <p className="empty-message">偵訊室尚未留下紀錄。</p>
        ) : (
          displayMessages.map((message) => {
            const messageNpc = (aiNpcs || []).find((npc) => npc.id === message.npcId);
            const messagePortrait = resolveAsset(
              messageNpc?.image || CHARACTER_IMAGE_MAP[message.npcId]
            );

            return (
              <div key={message.id} className={`discussion-message ${message.type}`}>
                {message.type === "npc" && (
                  <div className="discussion-message-avatar" aria-hidden="true">
                    {messagePortrait && <img src={messagePortrait} alt="" />}
                  </div>
                )}
                <div className="discussion-bubble-wrap">
                  {message.type === "npc" && (
                    <div className="discussion-message-meta">
                      <strong>{message.speaker}</strong>
                      {message.role && <span>{message.role}</span>}
                    </div>
                  )}
                  <div className="discussion-bubble">
                    {message.evidence && <div className="evidence-tag">出示線索：{message.evidence.name}</div>}
                    <p>{message.content}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {sending && (
          <div className="discussion-message npc">
            <div className="discussion-message-avatar" aria-hidden="true">
              {portrait && <img src={portrait} alt="" />}
            </div>
            <div className="discussion-bubble-wrap">
              <div className="discussion-message-meta">
                <strong>偵訊室</strong>
              </div>
              <div className="discussion-bubble">
                <p>......</p>
              </div>
            </div>
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
        {mentionOptions.length > 0 && (
          <div className="mention-picker" role="listbox" aria-label="選擇角色">
            {mentionOptions.map((npc) => (
              <button
                key={npc.id || npc.name}
                type="button"
                className="mention-option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelectMention(npc)}
              >
                <span>{npc.name}</span>
                {npc.role && <small>{npc.role}</small>}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="輸入問題 或用@角色"
        />
        <button
          type="button"
          className="send-btn"
          disabled={
            sending ||
            !input.trim() ||
            (interrogationRemaining !== undefined && interrogationRemaining <= 0)
          }
          onClick={handleSend}
        >
          <Send size={16} />
          送出
        </button>
      </div>
      {interrogationRemaining !== undefined && interrogationRemaining <= 0 && (
        <p className="usage-warning">偵訊次數已用完，請整理目前線索或推進下一階段。</p>
      )}
    </section>
  );
}
