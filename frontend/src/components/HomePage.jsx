import { useState, useRef } from "react";
import { AtSign, Lock, Mail, User, UserPlus } from "lucide-react";
import gsap from "gsap";
import { API_BASE } from "../api/config";
import "./HomePage.css";

export default function HomePage({ onLogin }) {
  const [hasEntered, setHasEntered] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const containerRef = useRef(null);
  const layer1Ref = useRef(null);
  const layer2Ref = useRef(null);
  const uiRef = useRef(null);
  const overlayRef = useRef(null);

  const isRegister = authMode === "register";

  function handleEnterClick() {
    if (hasEntered) return;
    setHasEntered(true);

    const tl = gsap.timeline();
    tl.to(uiRef.current, { opacity: 0, duration: 0.3, ease: "power2.out" });
    tl.to(layer1Ref.current, { scale: 3.5, opacity: 0, duration: 1.8, ease: "power2.inOut" }, 0);
    tl.fromTo(
      layer2Ref.current,
      { scale: 1.1, opacity: 0.5 },
      { scale: 1, opacity: 1, duration: 1.8, ease: "power2.inOut" },
      0
    );
  }

  function switchAuthMode(nextMode) {
    setAuthMode(nextMode);
    setAuthMessage("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleAuthSubmit(e) {
    e.preventDefault();
    setAuthMessage("");

    if (!email.trim() || !password.trim()) {
      setAuthMessage("請輸入郵件與密碼。");
      return;
    }
    if (isRegister) {
      if (!userName.trim()) {
        setAuthMessage("請輸入用戶名稱。");
        return;
      }
      if (password !== confirmPassword) {
        setAuthMessage("兩次輸入的密碼不一致。");
        return;
      }
    }

    try {
      setSubmitting(true);

      const res = await fetch(`${API_BASE}/api/${isRegister ? "register" : "login"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRegister
            ? {
                email,
                userName,
                password,
              }
            : {
                account: email,
                password,
              }
        ),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "驗證失敗。");
      }

      if (isRegister) {
        switchAuthMode("login");
        setEmail(email);
        setUserName("");
        setAuthMessage("註冊成功，請使用新帳號登入。");
        return;
      }

      onLogin?.({
        token: data.token,
        user: data.user,
      });
    } catch (err) {
      setAuthMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="scene-container"
      ref={containerRef}
      onClick={!hasEntered ? handleEnterClick : undefined}
    >
      <div
        className="scene-layer layer-2"
        ref={layer2Ref}
        style={{ backgroundImage: "url('/homePage2.png')" }}
      />
      <div
        className="scene-layer layer-1"
        ref={layer1Ref}
        style={{ backgroundImage: "url('/homePage.png')" }}
      />

      <div className="interaction-ui" ref={uiRef}>
        <div className="title-core">
          <h1 className="home-title-zh">
            <span>敘</span>
            <span>境</span>
          </h1>

          <p className="home-title-en">NARRIVE</p>
          <div className="system-lines">
            <span>CASE FILE / MEMORY TRACE / AI WITNESS</span>
          </div>
        </div>

        <p className="home-prompt floor-prompt">
          <span className="prompt-bracket">&gt;</span>
          <span className="prompt-text">點擊進入</span>
          <span className="prompt-bracket">&lt;</span>
        </p>
      </div>

      <div
        ref={overlayRef}
        className={`login-modal-overlay ${hasEntered ? "visible" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="login-title-container">
          <h1 className="login-ch-title">敘境</h1>
          <span className="login-en-title">NARRATIVE</span>
        </div>
        <p className="modal-subtitle">
          {isRegister ? "CREATE TRACE / REGISTER USER" : "ACCESS TRACE / LOGIN USER"}
        </p>

        <div className="auth-mode-tabs" role="tablist" aria-label="登入或註冊">
          <button
            className={!isRegister ? "active" : ""}
            type="button"
            onClick={() => switchAuthMode("login")}
          >
            登入
          </button>
          <button
            className={isRegister ? "active" : ""}
            type="button"
            onClick={() => switchAuthMode("register")}
          >
            註冊
          </button>
        </div>

        <form className="login-form" onSubmit={handleAuthSubmit}>
          <div className="input-wrapper">
            <Mail className="input-icon" size={16} strokeWidth={1.5} />
            <input
              className="login-input"
              type={isRegister ? "email" : "text"}
              placeholder={isRegister ? "郵件" : "用戶名稱或郵件"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>

          {isRegister && (
            <div className="input-wrapper">
              <AtSign className="input-icon" size={16} strokeWidth={1.5} />
              <input
                className="login-input"
                type="text"
                placeholder="用戶名稱"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
              />
            </div>
          )}

          <div className="input-wrapper">
            <Lock className="input-icon" size={16} strokeWidth={1.5} />
            <input
              className="login-input"
              type="password"
              placeholder="密碼"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {isRegister && (
            <div className="input-wrapper">
              <User className="input-icon" size={16} strokeWidth={1.5} />
              <input
                className="login-input"
                type="password"
                placeholder="確認密碼"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          {authMessage && <p className="auth-message">{authMessage}</p>}

          <button className="login-btn" type="submit" disabled={submitting}>
            {isRegister ? <UserPlus size={16} /> : <Lock size={16} />}
            <span>{submitting ? "處理中" : isRegister ? "註冊" : "登入"}</span>
          </button>

          <button
            className="auth-switch-link"
            type="button"
            onClick={() => switchAuthMode(isRegister ? "login" : "register")}
          >
            {isRegister ? "已有帳號，返回登入" : "尚未建立記憶檔案，前往註冊"}
          </button>
        </form>
      </div>
    </div>
  );
}
