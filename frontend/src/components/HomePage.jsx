import { useState, useRef } from "react";
import {User, Lock } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import "./HomePage.css";

export default function HomePage() {
  const [hasEntered, setHasEntered] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const containerRef = useRef(null);
  const layer1Ref = useRef(null);
  const layer2Ref = useRef(null);
  const uiRef = useRef(null);
  const overlayRef = useRef(null);

  const { contextSafe } = useGSAP({ scope: containerRef });

  const handleEnterClick = contextSafe(() => {
    if (hasEntered) return;
    setHasEntered(true);

    const tl = gsap.timeline();
    tl.to(uiRef.current, { opacity: 0, duration: 0.3, ease: "power2.out" });
    tl.to(layer1Ref.current, { scale: 3.5, opacity: 0, duration: 1.8, ease: "power2.inOut" }, 0);
    tl.fromTo(layer2Ref.current,
      { scale: 1.1, opacity: 0.5 },
      { scale: 1, opacity: 1, duration: 1.8, ease: "power2.inOut" },
      0
    );
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      // navigate("/lobby");
    }
  };

  return (
    <div
      className="scene-container"
      ref={containerRef}
      onClick={!hasEntered ? handleEnterClick : undefined}
    >
      <div className="scene-layer layer-2" ref={layer2Ref}
        style={{ backgroundImage: "url('/homePage2.png')" }} />
      <div className="scene-layer layer-1" ref={layer1Ref}
        style={{ backgroundImage: "url('/homePage.png')" }} />

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
          <span className="prompt-text"> 任意點選進入 </span>
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
        <p className="modal-subtitle">進入故事之境，拼湊每一段真相</p>

        <form className="login-form" onSubmit={handleLogin}>
          <div className="input-wrapper">
            <User className="input-icon" size={16} strokeWidth={1.5} />
            <input
              className="login-input"
              type="text"
              placeholder="用戶名 / 郵箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
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
          <button className="login-btn" type="submit">
            <span>登 入</span>
          </button>
          <p className="forgot-password">忘記密碼？</p>
        </form>
      </div>
    </div>
  );
}