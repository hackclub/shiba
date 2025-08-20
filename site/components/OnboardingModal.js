import { useState, useEffect } from "react";

export default function OnboardingModal({ isOpen, token, onCompleted, playSound, playClip, stopAll, isMuted }) {
  const [shouldRender, setShouldRender] = useState(Boolean(isOpen));
  const [isExiting, setIsExiting] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [textVisible, setTextVisible] = useState(false);
  const [buttonVisible, setButtonVisible] = useState(false);
  const [onboardingStage, setOnboardingStage] = useState(0);
  const [gameName, setGameName] = useState("");
  const [gameDescription, setGameDescription] = useState("");
  const [creatingGame, setCreatingGame] = useState(false);
  const [completingOnboarding, setCompletingOnboarding] = useState(false);
  const [devlogContent, setDevlogContent] = useState("");
  const [devlogFiles, setDevlogFiles] = useState([]);
  const [isPostingDevlog, setIsPostingDevlog] = useState(false);
  const [devlogMessage, setDevlogMessage] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const [createdGameId, setCreatedGameId] = useState(null);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        setIsExiting(false);
        // Delay text animation to start after modal enters
        setTimeout(() => setTextVisible(true), 300);
        // Delay button animation to start after text animation is complete
        setTimeout(() => setButtonVisible(true), 300 + (22 * 100) + 1200 + 500);
      });
    } else if (shouldRender) {
      setIsExiting(true);
      setTextVisible(false);
      setButtonVisible(false);
      setOnboardingStage(0);
      // Reset all form states when modal closes
      setGameName("");
      setGameDescription("");
      setCreatingGame(false);
      setCreatedGameId(null);
      setDevlogContent("");
      setDevlogFiles([]);
      setIsPostingDevlog(false);
      setDevlogMessage("");
      setCompletingOnboarding(false);
      setHasScrolledToBottom(false);
      const t = setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
      }, 260);
      return () => clearTimeout(t);
    }
  }, [isOpen, shouldRender]);

  const handleCreateGame = async () => {
    if (!token || !gameName.trim() || creatingGame || createdGameId) return; // Prevent double creation
    setCreatingGame(true);
    try {
      const res = await fetch("/api/CreateNewGame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          token, 
          name: gameName.trim(), 
          description: gameDescription 
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setCreatedGameId(data.game?.id);
        setOnboardingStage(9);
      } else {
        console.error('Failed to create game:', data?.message);
        // Reset creating state on error so user can try again
        setCreatingGame(false);
      }
    } catch (error) {
      console.error('Game creation error:', error);
      // Reset creating state on error so user can try again
      setCreatingGame(false);
    }
  };

  const handlePostDevlog = async () => {
    if (!token || !createdGameId || !devlogContent.trim() || isPostingDevlog) return;
    
    setIsPostingDevlog(true);
    setDevlogMessage("");
    try {
      const res = await fetch("/api/createPost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          gameId: createdGameId,
          content: devlogContent.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok) {
        setDevlogContent("");
        setDevlogMessage("Posted!");
        setTimeout(() => setDevlogMessage(""), 2000);
        setOnboardingStage(10);
      } else {
        setDevlogMessage(data?.message || "Failed to post");
        // Reset posting state on error so user can try again
        setIsPostingDevlog(false);
      }
    } catch (e) {
      console.error(e);
      setDevlogMessage("Failed to post");
      // Reset posting state on error so user can try again
      setIsPostingDevlog(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    if (!token || completingOnboarding) return;
    
    setCompletingOnboarding(true);
    try {
      const res = await fetch('/api/CompleteOnboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      
      if (res.ok && data?.ok && data?.profile) {
        onCompleted?.(data.profile);
      } else {
        console.error('Failed to complete onboarding:', data?.message);
      }
    } catch (error) {
      console.error('Onboarding completion error:', error);
    } finally {
      setCompletingOnboarding(false);
    }
  };

  // Play background music when modal opens
  useEffect(() => {
    if (isOpen && !isMuted) {
      // Stop any existing audio and play the Zelda song
      try { stopAll?.(); } catch (_) {}
      playClip?.("zeldaSong.mp3");
    }
  }, [isOpen, playClip, stopAll, isMuted]);

  // Handle Enter key for navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        
        // Handle different stages
        switch (onboardingStage) {
          case 0: // Get Started
            playSound?.("next.mp3");
            setOnboardingStage(1);
            break;
          case 1: // Continue to Slack
            playSound?.("next.mp3");
            setOnboardingStage(2);
            break;
          case 3: // Continue after Slack
            playSound?.("next.mp3");
            setOnboardingStage(4);
            break;
          case 4: // Continue to Hackatime
            playSound?.("next.mp3");
            setOnboardingStage(5);
            break;
          case 5: // Continue to Hour Botting Agreement
            playSound?.("next.mp3");
            setOnboardingStage(6);
            break;
          case 6: // Continue to Extension
            playSound?.("next.mp3");
            setOnboardingStage(7);
            break;
          case 7: // Continue to Create Game
            playSound?.("next.mp3");
            setOnboardingStage(8);
            break;
          case 8: // Create Game
            if (createdGameId) {
              // If game already exists, continue to next stage
              playSound?.("next.mp3");
              setOnboardingStage(9);
            } else if (gameName.trim() && !creatingGame) {
              // If no game exists yet, create one
              handleCreateGame();
            }
            break;
          case 9: // Post Devlog
            if (devlogContent.trim() && !isPostingDevlog) {
              handlePostDevlog();
            }
            break;
          case 10: // Complete Onboarding
            if (!completingOnboarding) {
              handleCompleteOnboarding();
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onboardingStage, gameName, devlogContent, creatingGame, isPostingDevlog, completingOnboarding, createdGameId, playSound, token, onCompleted, handleCreateGame, handlePostDevlog, handleCompleteOnboarding]);

  if (!shouldRender) return null;

  return (
    <div
      className={`modal-overlay ${isExiting ? "exit" : "enter"}`}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        className={`modal-card ${isExiting ? "exit" : "enter"}`}
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.92)",
          padding: "32px 20px 20px 20px",
          borderRadius: 12,
          width: "600px",
          height: "400px",
          maxWidth: "calc(100vw - 40px)",
          maxHeight: "calc(100vh - 40px)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          border: "1px solid rgba(0, 0, 0, 0.12)",
          position: "relative",
        }}
      >
        {/* Top Bar with Progress and Back Button */}
        {onboardingStage > 0 && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "60px",
            display: "flex",
            alignItems: "center",
            gap: "16px",
            padding: "0 20px",
            zIndex: 10,
            opacity: 0,
            animation: "fadeIn 0.3s ease forwards"
          }}>
            {/* Back Button */}
            <button
              onClick={() => {
                playSound?.("prev.mp3");
                // Reset states when going back from post creation stage
                if (onboardingStage === 10) {
                  setDevlogContent("");
                  setDevlogMessage("");
                }
                setOnboardingStage(onboardingStage - 1);
              }}
              style={{
                appearance: "none",
                border: "1px solid rgba(0,0,0,0.12)",
                background: "rgba(255,255,255,0.7)",
                width: "32px",
                height: "32px",
                borderRadius: "9999px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "rgba(0,0,0,0.65)",
                fontSize: "18px",
                lineHeight: 1,
                flexShrink: 0
              }}
            >
              <img 
                src="/arrow.svg" 
                alt="back" 
                style={{ 
                  width: "18px", 
                  height: "18px",
                  transform: "scaleX(-1)"
                }} 
              />
            </button>
            
            {/* Progress Bar */}
            <div style={{
              flex: 1,
              height: "4px",
              backgroundColor: "rgba(0, 0, 0, 0.1)",
              borderRadius: "2px",
              overflow: "hidden"
            }}>
              <div style={{
                width: `${((onboardingStage + 1) / 11) * 100}%`,
                height: "100%",
                backgroundColor: "var(--yellow)",
                transition: "width 0.3s ease"
              }} />
            </div>
          </div>
        )}
        {/* Debug: Current stage is {onboardingStage} */}
        {onboardingStage === 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              gap: "32px",
              marginTop: "79px", // Offset to keep text centered accounting for button space
            }}
          >
          <div
            style={{
              textAlign: "center",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
                        <div style={{ 
              margin: 0, 
              fontWeight: 700, 
              fontSize: "32px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}>
              {textVisible && (
                <>
                  {/* "Welcome to" - white with black outline */}
                  <div style={{ display: "flex" }}>
                    {"Welcome to".split('').map((char, index) => (
                      <span
                        key={`welcome-${index}`}
                        style={{
                          opacity: 0,
                          transform: "translateY(20px) scale(0.8)",
                          animation: textVisible ? `letterFadeIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.1}s forwards` : "none",
                          display: "inline-block",
                          color: "white",
                          textShadow: `
                            -1.5px 0 0 #000,
                            1.5px 0 0 #000,
                            0 -1.5px 0 #000,
                            0 1.5px 0 #000,
                            -1.5px -1.5px 0 #000,
                            1.5px -1.5px 0 #000,
                            -1.5px 1.5px 0 #000,
                            1.5px 1.5px 0 #000
                          `,
                        }}
                      >
                        {char === ' ' ? '\u00A0' : char}
                      </span>
                    ))}
                  </div>
                  
                  {/* "Shiba Arcade" - yellow with black outline */}
                  <div style={{ display: "flex" }}>
                    {"Shiba Arcade".split('').map((char, index) => (
                      <span
                        key={`shiba-${index}`}
                        style={{
                          opacity: 0,
                          transform: "translateY(20px) scale(0.8)",
                          animation: textVisible ? `letterFadeIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${(index + 11) * 0.1}s forwards` : "none",
                          display: "inline-block",
                          color: "var(--yellow)",
                          fontStyle: "italic",
                          textShadow: `
                            -1.5px 0 0 #000,
                            1.5px 0 0 #000,
                            0 -1.5px 0 #000,
                            0 1.5px 0 #000,
                            -1.5px -1.5px 0 #000,
                            1.5px -1.5px 0 #000,
                            -1.5px 1.5px 0 #000,
                            1.5px 1.5px 0 #000
                          `,
                        }}
                      >
                        {char === ' ' ? '\u00A0' : char}
                      </span>
                    ))}
                  </div>
                </>
              )}
                          </div>
            </div>
            
          {/* Bottom Row - Button */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              opacity: buttonVisible ? 1 : 0,
              transition: "opacity 0.8s ease",
            }}
          >
              <button
                onClick={() => {
                  playSound?.("next.mp3");
                  setOnboardingStage(1);
                }}
                style={{
                  appearance: "none",
                  border: "2px solid black",
                  background: "var(--yellow)",
                  color: "black",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#f7b748";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "var(--yellow)";
                }}
              >
                Get Started
                <img src="/arrow.svg" alt="arrow" style={{ width: "18px", height: "18px" }} />
              </button>
            </div>
          </div>
        )}
        {onboardingStage === 1 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flex: 1,
              padding: "20px",
            }}
          >
            <h1 style={{ margin: 0, color: "black", fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
              Join the Community
            </h1>
            <div style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "16px",
              maxWidth: "500px"
            }}>
              <p style={{ 
                margin: 0, 
                color: "black", 
                fontSize: "14px", 
                lineHeight: "1.5",
                flex: 1
              }}>
                Shiba is part of the{" "}
                <a 
                  href="http://hackclub.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{
                    color: "#ff6fa5",
                    textDecoration: "underline",
                    fontWeight: "bold"
                  }}
                >
                  Hack Club community
                </a>
                . You received an email invite to join the Hack Club Slack. 
                Joining is required to participate in the Game Jam. Once you've joined, tap continue.
              </p>
              <img 
                src="/JoinSlack.png" 
                alt="Join Slack" 
                style={{
                  width: "120px",
                  height: "auto",
                  border: "2px solid black",
                  borderRadius: "8px",
                  flexShrink: 0
                }}
              />
            </div>
            
            {/* Warning above Continue button */}
            <div style={{
              marginTop: "20px",
              padding: "12px",
              backgroundColor: "#fff3cd",
              border: "2px solid #ffc107",
              borderRadius: "8px",
              borderLeft: "4px solid #ffc107"
            }}>
              <p style={{
                margin: 0,
                color: "#856404",
                fontSize: "14px",
                fontWeight: "bold",
                lineHeight: "1.4"
              }}>
                ⚠️ Hack Club & Shiba are only for those 18 and under! If you're older than 18, this community isn't for you.
              </p>
            </div>
            
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "center" }}>
              <button
                onClick={() => {
                  playSound?.("next.mp3");
                  setOnboardingStage(2);
                }}
                style={{
                  appearance: "none",
                  border: "2px solid black",
                  background: "var(--yellow)",
                  color: "black",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#f7b748";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "var(--yellow)";
                }}
              >
                Continue
              </button>
            </div>
          </div>
        )}
        {onboardingStage === 2 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flex: 1,
              padding: "20px",
              maxHeight: "100%",
            }}
          >
            <h1 style={{ margin: 0, color: "black", fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
              Connect your Slack Account
            </h1>
            <p style={{ 
              margin: 0, 
              color: "black", 
              fontSize: "14px", 
              lineHeight: "1.5",
              marginBottom: "16px",
              maxWidth: "500px"
            }}>
              Once you've joined the slack, head over to{" "}
              <a 
                href="https://hackclub.slack.com/archives/C039PAG1AV7" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  color: "#ff6fa5",
                  textDecoration: "underline",
                  fontWeight: "bold"
                }}
              >
                #slack-welcome-start
              </a>
              {" "}to become a full user.               Once you're a full user, tap Login with Slack to connect your Shiba account to the Hack Club Slack.

            </p>
            
            <img 
              src="/slack-welcome-start.png" 
              alt="Slack Welcome Start Channel" 
              style={{
                width: "100%",
                maxWidth: "200px",
                height: "auto",
                border: "2px solid black",
                borderRadius: "8px",
                marginBottom: "20px"
              }}
            />

            <div style={{ display: "flex", gap: "12px", justifyContent: "center", width: "100%" }}>
              <button
                type="button"
                onClick={() => {
                  const base = window.location.origin;
                  const w = window.open(`${base}/api/slack/oauthStart?state=${encodeURIComponent(token || '')}` , 'slack_oauth', 'width=600,height=700');
                  const listener = async (evt) => {
                    if (!evt || !evt.data || evt.data.type !== 'SLACK_CONNECTED') return;
                    try {
                      const id = String(evt.data.slackId || '');
                      if (!id) return;
                      // Re-fetch profile to get canonical state from server
                      try {
                        const res = await fetch('/api/getMyProfile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
                        const data = await res.json().catch(() => ({}));
                        if (res.ok && data?.ok) {
                          setOnboardingStage(3); // Move to next stage instead of completing
                        } else {
                          setOnboardingStage(3);
                        }
                      } catch (_) {
                        setOnboardingStage(3);
                      }
                    } catch (_) {}
                    window.removeEventListener('message', listener);
                    try { w && w.close && w.close(); } catch (_) {}
                  };
                  window.addEventListener('message', listener);
                }}
                style={{
                  appearance: 'none',
                  border: '2px solid black',
                  background: '#4A154B',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#5a1a5b';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#4A154B';
                }}
              >
                Login with Slack
              </button>
              
              <button
                onClick={() => {
                  playSound?.("next.mp3");
                  setOnboardingStage(4); // Skip to the next stage (Godot download)
                }}
                style={{
                  appearance: 'none',
                  border: '2px solid black',
                  background: 'white',
                  color: 'black',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#f5f5f5';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'white';
                }}
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
        
        {/* Stage 3: Congrats Slack Login */}
        {onboardingStage === 3 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              padding: "20px",
            }}
          >
            <h1 style={{ 
              margin: 0, 
              color: "black", 
              fontSize: "28px", 
              fontWeight: "bold", 
              marginBottom: "32px",
              opacity: 0,
              animation: "fadeIn 1s ease forwards"
            }}>
              Congrats, you're logged into the Hack Club Slack!
            </h1>
            
            <div style={{ marginTop: "24px", display: "flex", justifyContent: "center" }}>
              <button
                onClick={() => {
                  playSound?.("next.mp3");
                  setOnboardingStage(4);
                }}
                style={{
                  appearance: "none",
                  border: "2px solid black",
                  background: "var(--yellow)",
                  color: "black",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#f7b748";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "var(--yellow)";
                }}
              >
                Continue
              </button>
            </div>
          </div>
        )}
        
        {/* Stage 4: Download Godot */}
        {onboardingStage === 4 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flex: 1,
              padding: "20px",
            }}
          >
            <div>
              <h1 style={{ margin: 0, color: "black", fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
                Download Godot
              </h1>
              
              <img 
                src="/godot.jpeg" 
                alt="Godot Game Engine" 
                style={{
                  width: "100%",
                  maxWidth: "160px",
                  height: "auto",
                  border: "2px solid black",
                  borderRadius: "8px",
                  marginBottom: "16px"
                }}
              />
              
              <p style={{ 
                margin: 0, 
                color: "black", 
                fontSize: "14px", 
                lineHeight: "1.5",
                marginBottom: "24px",
                maxWidth: "500px"
              }}>
                Godot is the game engine for the Shiba Game Jam. It's free, open-source, and works on all platforms. Download GoDot & create your first project
              </p>
            </div>
            
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", width: "100%" }}>
              <button
                onClick={() => window.open('https://godotengine.org/download', '_blank')}
                style={{
                  appearance: "none",
                  border: "2px solid black",
                  background: "black",
                  color: "var(--yellow)",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#333";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "black";
                }}
              >
                Download Godot
              </button>
              <button
                onClick={() => {
                  playSound?.("next.mp3");
                  setOnboardingStage(5);
                }}
                style={{
                  appearance: "none",
                  border: "2px solid black",
                  background: "var(--yellow)",
                  color: "black",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#f7b748";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "var(--yellow)";
                }}
              >
                Continue
                <img src="/arrow.svg" alt="arrow" style={{ width: "18px", height: "18px" }} />
              </button>
            </div>
          </div>
        )}
        
        {/* Stage 5: Setup Hackatime */}
        {onboardingStage === 5 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flex: 1,
              padding: "20px",
            }}
          >
            <div>
              <h1 style={{ margin: 0, color: "black", fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
                Setup Hackatime for Time Logging
              </h1>
              <p style={{ 
                margin: 0, 
                color: "black", 
                fontSize: "14px", 
                lineHeight: "1.5",
                marginBottom: "16px",
                maxWidth: "500px"
              }}>
                Hackatime tracks your coding time and awards play tickets. Set it up to start earning playtest tickets for your time spent on your game. Make sure to login with Slack
              </p>
              
              <iframe 
                width="200" 
                height="120" 
                src="https://www.youtube.com/embed/eFVA_ZWnzDk?si=z_HsFWNBop5T_K2x" 
                title="YouTube video player" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                referrerPolicy="strict-origin-when-cross-origin" 
                allowFullScreen
                style={{
                  border: "2px solid black",
                  borderRadius: "8px",
                  marginBottom: "24px"
                }}
              />
            </div>
            
            <div style={{ display: "flex", gap: "12px", justifyContent: "center", width: "100%" }}>
              <button
                onClick={() => window.open('https://hackatime.hackclub.com', '_blank')}
                style={{
                  appearance: "none",
                  border: "2px solid black",
                  background: "white",
                  color: "black",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#f5f5f5";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "white";
                }}
              >
                Take me to Hackatime
              </button>
              <button
                onClick={() => {
                  playSound?.("next.mp3");
                  setOnboardingStage(6);
                }}
                style={{
                  appearance: "none",
                  border: "2px solid black",
                  background: "var(--yellow)",
                  color: "black",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#f7b748";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "var(--yellow)";
                }}
              >
                Continue
                <img src="/arrow.svg" alt="arrow" style={{ width: "18px", height: "18px" }} />
              </button>
            </div>
          </div>
        )}
        
        {/* Stage 6: Hour Botting Agreement */}
        {onboardingStage === 6 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              flex: 1,
              padding: "20px",
            }}
          >
            <div style={{ textAlign: "center", maxWidth: "500px" }}>
              <h1 style={{ 
                margin: 0, 
                color: "black", 
                fontSize: "28px", 
                fontWeight: "bold", 
                marginBottom: "16px",
                letterSpacing: "1px"
              }}>
                Hackatime Integrity Agreement
              </h1>
              
              <div 
                onScroll={(e) => {
                  const { scrollTop, scrollHeight, clientHeight } = e.target;
                  if (scrollTop + clientHeight >= scrollHeight - 5) {
                    setHasScrolledToBottom(true);
                  }
                }}
                style={{
                  backgroundColor: "#f8f9fa",
                  border: "2px solid #343a40",
                  borderRadius: "8px",
                  padding: "20px",
                  marginBottom: "16px",
                  fontFamily: "Georgia, serif",
                  fontSize: "16px",
                  lineHeight: "1.6",
                  textAlign: "left",
                  maxHeight: "160px",
                  overflowY: "auto"
                }}
              >
                <p style={{ margin: "0 0 16px 0", fontWeight: "bold" }}>
                  WHEREAS, hours logged constitute the fundamental economic input to the Shiba ecosystem;
                </p>
                
                <p style={{ margin: "0 0 16px 0" }}>
                  AND WHEREAS, The Hack Foundation (Hack Club) maintains strict integrity standards for time tracking;
                </p>
                
                <p style={{ margin: "0 0 16px 0" }}>
                  NOW THEREFORE, you hereby acknowledge and agree that any attempt to deceive The Hack Foundation through automated time logging, scripted heartbeat emissions, repeated fake key presses, UI manipulation, or any other form of time tracking manipulation (including but not limited to performing small actions in the interface to trigger fake heartbeats) shall result in immediate and permanent termination of your access to Hackatime and all associated programs, including but not limited to Shiba Arcade.
                </p>
                
                <p style={{ margin: "0 0 16px 0", fontWeight: "bold" }}>
                  FURTHER, you understand that our systems are specifically trained to detect automated heartbeat emissions and that such detection will result in immediate account termination.
                </p>
                
                <p style={{ margin: "0", fontStyle: "italic" }}>
                  By proceeding, you acknowledge full understanding of these terms and accept all consequences of violation.
                </p>
                
                <div style={{ 
                  marginTop: "20px", 
                  padding: "16px", 
                  backgroundColor: "#e9ecef", 
                  border: "1px solid #dee2e6", 
                  borderRadius: "6px",
                  borderLeft: "4px solid #007bff"
                }}>
                  <p style={{ 
                    margin: "0 0 8px 0", 
                    fontWeight: "bold", 
                    fontSize: "14px",
                    color: "#495057"
                  }}>
                    TL;DR:
                  </p>
                  <p style={{ 
                    margin: "0", 
                    fontSize: "14px", 
                    lineHeight: "1.4",
                    color: "#495057"
                  }}>
                    Don't cheat the time tracking system. No bots, no fake key presses, no UI manipulation. If you do, you'll be banned from Hackatime and Shiba permanently.
                  </p>
                </div>
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "center", width: "100%", position: "relative" }}>
              <button
                onClick={() => {
                  if (hasScrolledToBottom) {
                    playSound?.("next.mp3");
                    setOnboardingStage(7);
                  }
                }}
                disabled={!hasScrolledToBottom}
                title={!hasScrolledToBottom ? "Please read the entire agreement before agreeing" : ""}
                style={{
                  appearance: "none",
                  border: "3px solid #343a40",
                  background: hasScrolledToBottom ? "#28a745" : "#6c757d",
                  color: "white",
                  borderRadius: "8px",
                  padding: "16px 32px",
                  fontSize: "18px",
                  fontWeight: "bold",
                  cursor: hasScrolledToBottom ? "pointer" : "not-allowed",
                  transition: "all 0.2s ease",
                  letterSpacing: "1px",
                  opacity: hasScrolledToBottom ? 1 : 0.6
                }}
                onMouseEnter={(e) => {
                  if (hasScrolledToBottom) {
                    e.target.style.background = "#218838";
                    e.target.style.borderColor = "#218838";
                  }
                }}
                onMouseLeave={(e) => {
                  if (hasScrolledToBottom) {
                    e.target.style.background = "#28a745";
                    e.target.style.borderColor = "#28a745";
                  }
                }}
              >
                Agree to Terms
              </button>
            </div>
          </div>
        )}
        
        {/* Stage 7: Download Extension & Connect Hackatime */}
        {onboardingStage === 7 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flex: 1,
              padding: "20px",
            }}
          >
            <div>
              <h1 style={{ margin: 0, color: "black", fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
                Download Extension & Connect Hackatime
              </h1>
              <p style={{ 
                margin: 0, 
                color: "black", 
                fontSize: "14px", 
                lineHeight: "1.5",
                marginBottom: "16px",
                maxWidth: "500px"
              }}>
                Install the Godot extension to track your time and connect it to Hackatime for automatic time logging.
              </p>
            </div>
            
            <div style={{ 
              display: "flex", 
              alignItems: "flex-start", 
              gap: "20px", 
              justifyContent: "center", 
              width: "100%",
              flexWrap: "wrap"
            }}>
              <img 
                src="/hackatimeExtension.png" 
                alt="Hackatime Godot Extension" 
                style={{
                  width: "200px",
                  height: "auto",
                  border: "2px solid black",
                  borderRadius: "8px",
                  flexShrink: 0
                }}
              />
              
              <div style={{ 
                display: "flex", 
                flexDirection: "column", 
                gap: "12px",
                minWidth: "200px"
              }}>
                <button
                  onClick={() => window.open('https://godotengine.org/asset-library/asset/3484', '_blank')}
                  style={{
                    appearance: "none",
                    border: "2px solid black",
                    background: "white",
                    color: "black",
                    borderRadius: "8px",
                    padding: "12px 24px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    transition: "background-color 0.2s ease",
                    width: "100%"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "#f5f5f5";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "white";
                  }}
                >
                  Download Extension
                </button>
                <button
                  onClick={() => window.open('https://hackatime.hackclub.com/docs/editors/godot', '_blank')}
                  style={{
                    appearance: "none",
                    border: "2px solid black",
                    background: "white",
                    color: "black",
                    borderRadius: "8px",
                    padding: "12px 24px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    transition: "background-color 0.2s ease",
                    width: "100%"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "#f5f5f5";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "white";
                  }}
                >
                  Setup Guide
                </button>
                <button
                  onClick={() => {
                  playSound?.("next.mp3");
                  setOnboardingStage(8);
                }}
                  style={{
                    appearance: "none",
                    border: "2px solid black",
                    background: "var(--yellow)",
                    color: "black",
                    borderRadius: "8px",
                    padding: "12px 24px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    transition: "background-color 0.2s ease",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "#f7b748";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "var(--yellow)";
                  }}
                >
                  Continue
                  <img src="/arrow.svg" alt="arrow" style={{ width: "18px", height: "18px" }} />
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Stage 8: Create Your Game */}
        {onboardingStage === 8 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flex: 1,
              padding: "20px",
            }}
          >
            <div>
              <h1 style={{ margin: 0, color: "black", fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
                Create Your Game
              </h1>
              <p style={{ 
                margin: 0, 
                color: "black", 
                fontSize: "14px", 
                lineHeight: "1.5",
                marginBottom: "24px",
                maxWidth: "500px"
              }}>
                Give your game a name and description. You can always change this later.
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%", maxWidth: "400px" }}>
                <input
                  type="text"
                  placeholder="Game Name"
                  value={gameName}
                  onChange={(e) => setGameName(e.target.value)}
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: "rgba(255,255,255,0.8)",
                    outline: "none",
                    fontSize: "14px"
                  }}
                />
                <textarea
                  rows={3}
                  placeholder="Game Description"
                  value={gameDescription}
                  onChange={(e) => setGameDescription(e.target.value)}
                  style={{
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid rgba(0,0,0,0.18)",
                    background: "rgba(255,255,255,0.8)",
                    outline: "none",
                    fontSize: "14px",
                    resize: "vertical"
                  }}
                />
              </div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
              {createdGameId ? (
                // Show Continue button if game already exists
                <button
                  onClick={() => {
                    playSound?.("next.mp3");
                    setOnboardingStage(9);
                  }}
                  style={{
                    appearance: "none",
                    border: "2px solid black",
                    background: "var(--yellow)",
                    color: "black",
                    borderRadius: "8px",
                    padding: "12px 24px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: "pointer",
                    transition: "background-color 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "#f7b748";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "var(--yellow)";
                  }}
                >
                  Continue
                  <img src="/arrow.svg" alt="arrow" style={{ width: "18px", height: "18px" }} />
                </button>
              ) : (
                // Show Create Game button if no game exists yet
                <button
                  onClick={handleCreateGame}
                  disabled={!gameName.trim() || creatingGame}
                  style={{
                    appearance: "none",
                    border: "2px solid black",
                    background: gameName.trim() && !creatingGame ? "var(--yellow)" : "#ccc",
                    color: "black",
                    borderRadius: "8px",
                    padding: "12px 24px",
                    fontSize: "16px",
                    fontWeight: "bold",
                    cursor: gameName.trim() && !creatingGame ? "pointer" : "not-allowed",
                    transition: "background-color 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px"
                  }}
                  onMouseEnter={(e) => {
                    if (gameName.trim() && !creatingGame) {
                      e.target.style.background = "#f7b748";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (gameName.trim() && !creatingGame) {
                      e.target.style.background = "var(--yellow)";
                    }
                  }}
                >
                  {creatingGame ? "Creating..." : "Create Game"}
                  {!creatingGame && gameName.trim() && (
                    <img src="/arrow.svg" alt="arrow" style={{ width: "18px", height: "18px" }} />
                  )}
                </button>
              )}
            </div>
          </div>
        )}
        
        {/* Stage 9: Log your first Devlog */}
        {onboardingStage === 9 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between",
              flex: 1,
              padding: "20px",
            }}
          >
            <div>
              <h1 style={{ margin: 0, color: "black", fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
                Log your first Devlog
              </h1>
              <p style={{ 
                margin: 0, 
                color: "black", 
                fontSize: "14px", 
                lineHeight: "1.5",
                marginBottom: "24px",
                maxWidth: "500px"
              }}>
                Make devlogs every time you make progress on your game. Share screenshots, videos, and updates with the community.
              </p>
              
              <div
                style={{
                  border: "1px solid rgba(0, 0, 0, 0.18)",
                  borderRadius: "10px",
                  overflow: "hidden",
                  background: "rgba(255, 255, 255, 0.75)",
                  width: "100%",
                  maxWidth: "500px"
                }}
              >
                <textarea
                  placeholder={`I setup GoDot + Hackatime and I am ready to begin working on my game, ${gameName || "My Game"}!`}
                  value={devlogContent}
                  onChange={(e) => setDevlogContent(e.target.value)}
                  style={{
                    width: "100%",
                    minHeight: "120px",
                    resize: "vertical",
                    fontSize: "14px",
                    boxSizing: "border-box",
                    padding: "10px",
                    outline: "none",
                    border: "0",
                    borderRadius: "10px 10px 0 0",
                    background: "transparent"
                  }}
                />

                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px",
                  background: "rgba(255, 255, 255, 0.65)",
                  borderRadius: "0 0 10px 10px"
                }}>
                  <div style={{ flex: 1 }} />
                  <button
                    onClick={handlePostDevlog}
                    disabled={isPostingDevlog || !devlogContent.trim()}
                    style={{
                      appearance: "none",
                      border: "0",
                      background: isPostingDevlog || !devlogContent.trim() ? "#ccc" : "linear-gradient(180deg, #ff8ec3 0%, #ff6fa5 100%)",
                      color: "#fff",
                      borderRadius: "10px",
                      padding: "10px 14px",
                      cursor: isPostingDevlog || !devlogContent.trim() ? "not-allowed" : "pointer",
                      fontWeight: "800",
                      fontSize: "13px"
                    }}
                  >
                    {isPostingDevlog ? "Posting…" : "Post Devlog"}
                  </button>
                </div>
              </div>
              
              {devlogMessage && (
                <p style={{ marginTop: "8px", opacity: 0.7, fontSize: "14px" }}>{devlogMessage}</p>
              )}
            </div>
          </div>
        )}
        
        {/* Stage 10: You're done! */}
        {onboardingStage === 10 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flex: 1,
              padding: "20px",
            }}
          >
            <h1 style={{ 
              margin: 0, 
              color: "black", 
              fontSize: "28px", 
              fontWeight: "bold", 
              marginBottom: "32px",
              opacity: 0,
              animation: "fadeIn 1s ease forwards"
            }}>
              Congrats, your Shiba adventure begins... TODAY
            </h1>
            
            <div style={{ marginTop: "24px", display: "flex", justifyContent: "center" }}>
              <button
                onClick={handleCompleteOnboarding}
                disabled={completingOnboarding}
                style={{
                  appearance: "none",
                  border: "2px solid black",
                  background: completingOnboarding ? "#ccc" : "var(--yellow)",
                  color: "black",
                  borderRadius: "8px",
                  padding: "12px 24px",
                  fontSize: "16px",
                  fontWeight: "bold",
                  cursor: completingOnboarding ? "not-allowed" : "pointer",
                  transition: "background-color 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  if (!completingOnboarding) {
                    e.target.style.background = "#f7b748";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!completingOnboarding) {
                    e.target.style.background = "var(--yellow)";
                  }
                }}
              >
                {completingOnboarding ? "Opening the door..." : "Go Explore"}
              </button>
            </div>
          </div>
        )}


      </div>
      <style jsx>{`
        .modal-overlay {
          background-color: rgba(255, 255, 255, 0);
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
          transition: backdrop-filter 240ms ease, -webkit-backdrop-filter 240ms ease, background-color 240ms ease;
        }
        .modal-overlay.enter {
          background-color: rgba(255, 255, 255, 0.3);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        .modal-overlay.exit {
          background-color: rgba(255, 255, 255, 0);
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
        }
        .modal-card {
          transform: translateY(6px) scale(0.98);
          opacity: 0;
          transition: transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 220ms ease;
        }
        .modal-card.enter { transform: translateY(0) scale(1); opacity: 1; }
        .modal-card.exit { transform: translateY(6px) scale(0.98); opacity: 0; }
        
        @keyframes letterFadeIn {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.8);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes fadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
