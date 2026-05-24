import { Users } from "lucide-react";

export default function NpcPanel({ aiNpcs, selectedNpc, onSelectNpc }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <Users size={18} />
        <h2>可偵訊角色</h2>
      </div>

      <div className="npc-list">
        {aiNpcs.map((npc) => (
          <button
            key={npc.id}
            className={`npc-card ${selectedNpc?.id === npc.id ? "active" : ""}`}
            onClick={() => onSelectNpc(npc)}
          >
            <strong>{npc.name}</strong>
            <span>{npc.role}</span>
            <small>{npc.public_background}</small>
          </button>
        ))}
      </div>
    </section>
  );
}