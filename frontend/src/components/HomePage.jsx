import { useState } from "react";
import { LogIn, Search } from "lucide-react";

export default function HomePage({ onLogin }) {
  const [name, setName] = useState("");

  function handleSubmit(e) {
    e.preventDefault();

    if (!name.trim()) {
      alert("請輸入玩家暱稱");
      return;
    }

    onLogin(name.trim());
  }

  return (
    <div className="home-page">
      <div className="home-card">
        <div className="home-icon">
          <Search size={42} />
        </div>

        <p className="eyebrow">AI Interactive Mystery</p>
        <h1>虛擬真相</h1>
        <p className="home-desc">
          進入由生成式 AI 驅動的互動式推理劇本。選擇你的角色，閱讀劇本，搜查線索，偵訊嫌疑人，找出真正的兇手。
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          <label>玩家暱稱</label>
          <input
            value={name}
            placeholder="請輸入你的名字"
            onChange={(e) => setName(e.target.value)}
          />

          <button className="primary-btn" type="submit">
            <LogIn size={16} />
            進入系統
          </button>
        </form>
      </div>
    </div>
  );
}