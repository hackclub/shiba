import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import AppHead from "@/components/AppHead";
import GameCarousel from "@/components/GameCarousel";
import GameDetails from "@/components/GameDetails";
import useAudioManager from "@/components/AudioManager";

export function MovingBackground() {
  const ICON_SIZE = 64;
  const GAP = 32;
  const SPEED_PX_PER_SECOND = 20; // Adjust to control animation speed
  const [grid, setGrid] = useState({ cols: 0, rows: 0 });

  useEffect(() => {
    const computeGrid = () => {
      const perCol = ICON_SIZE + GAP;
      const perRow = ICON_SIZE + GAP;
      const cols = Math.ceil((window.innerWidth + GAP) / perCol);
      const rows = Math.ceil((window.innerHeight + GAP) / perRow);
      setGrid({ cols, rows });
    };

    computeGrid();
    window.addEventListener("resize", computeGrid);
    return () => window.removeEventListener("resize", computeGrid);
  }, []);

  const columns = Array.from({ length: grid.cols });
  const rows = Array.from({ length: grid.rows });

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        flexWrap: "nowrap",
        overflow: "hidden",
        pointerEvents: "none",
        gap: GAP,
      }}
    >
      {columns.map((_, colIndex) => {
        const rowsCount = grid.rows || 0;
        const scrollDistance = rowsCount * (ICON_SIZE + GAP);
        const direction = colIndex % 2 === 0 ? "bgScrollUp" : "bgScrollDown";
        const durationSeconds = Math.max(
          1,
          scrollDistance / SPEED_PX_PER_SECOND,
        );
        return (
          <div
            key={colIndex}
            style={{
              height: "100%",
              width: ICON_SIZE,
              minWidth: ICON_SIZE,
              flex: `0 0 ${ICON_SIZE}px`,
              overflow: "hidden",
              display: "flex",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: GAP,
                willChange: "transform",
                animationName: direction,
                animationDuration: `${durationSeconds}s`,
                animationTimingFunction: "linear",
                animationIterationCount: "infinite",
                "--scrollDistance": `${scrollDistance}px`,
              }}
            >
              {rows.map((_, rowIndex) => {
                const isSword = (colIndex + rowIndex) % 2 === 0;
                const src = isSword ? "/sword.svg" : "/heart.svg";
                return (
                  <img
                    key={`a-${rowIndex}`}
                    src={src}
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    alt=""
                    style={{
                      opacity: 0.3,
                      transformOrigin: "center center",
                      willChange: "transform",
                      animationName: "pulseScale",
                      animationDuration: "2.4s",
                      animationTimingFunction:
                        "cubic-bezier(0.34, 1.56, 0.64, 1)",
                      animationIterationCount: "infinite",
                      animationDelay: `-${(colIndex * 0.15 + rowIndex * 0.1).toFixed(2)}s`,
                    }}
                  />
                );
              })}
              {rows.map((_, rowIndex) => {
                const isSword = (colIndex + rowIndex) % 2 === 0;
                const src = isSword ? "/sword.svg" : "/heart.svg";
                return (
                  <img
                    key={`b-${rowIndex}`}
                    src={src}
                    width={ICON_SIZE}
                    height={ICON_SIZE}
                    alt=""
                    style={{
                      opacity: 0.3,
                      transformOrigin: "center center",
                      willChange: "transform",
                      animationName: "pulseScale",
                      animationDuration: "2.4s",
                      animationTimingFunction:
                        "cubic-bezier(0.34, 1.56, 0.64, 1)",
                      animationIterationCount: "infinite",
                      animationDelay: `-${(colIndex * 0.15 + rowIndex * 0.1 + 1.2).toFixed(2)}s`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      <style jsx>{`
        @keyframes bgScrollUp {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(calc(-1 * var(--scrollDistance)));
          }
        }
        @keyframes bgScrollDown {
          0% {
            transform: translateY(calc(-1 * var(--scrollDistance)));
          }
          100% {
            transform: translateY(0);
          }
        }
        @keyframes pulseScale {
          0% {
            transform: scale(0.5);
          }
          40% {
            transform: scale(1.05);
          }
          55% {
            transform: scale(0.95);
          }
          70% {
            transform: scale(1.02);
          }
          100% {
            transform: scale(0.5);
          }
        }
      `}</style>
    </div>
  );
}

function ProfileModal({
  isOpen,
  onClose,
  slackProfile,
  onLogout,
  initialProfile,
  token,
  onUpdated,
}) {
  const [shouldRender, setShouldRender] = useState(Boolean(isOpen));
  const [isExiting, setIsExiting] = useState(false);
  const [githubUsername, setGithubUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthday, setBirthday] = useState("");
  const [street1, setStreet1] = useState("");
  const [street2, setStreet2] = useState("");
  const [city, setCity] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => setIsExiting(false));
    } else if (shouldRender) {
      setIsExiting(true);
      const t = setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
      }, 260);
      return () => clearTimeout(t);
    }
  }, [isOpen, shouldRender]);

  useEffect(() => {
    if (!isOpen) return;
    const p = initialProfile || {};
    setGithubUsername(p.githubUsername || "");
    setFirstName(p.firstName || "");
    setLastName(p.lastName || "");
    setBirthday(p.birthday || "");
    setStreet1((p.address && p.address.street1) || "");
    setStreet2((p.address && p.address.street2) || "");
    setCity((p.address && p.address.city) || "");
    setZipcode((p.address && p.address.zipcode) || "");
    setCountry((p.address && p.address.country) || "");
    setSaving(false);
  }, [isOpen, initialProfile]);

  const hasChanges = useMemo(() => {
    return Boolean(
      githubUsername ||
        firstName ||
        lastName ||
        birthday ||
        street1 ||
        street2 ||
        city ||
        zipcode ||
        country,
    );
  }, [
    githubUsername,
    firstName,
    lastName,
    birthday,
    street1,
    street2,
    city,
    zipcode,
    country,
  ]);

  if (!shouldRender) return null;

  const displayName = slackProfile?.displayName || "";
  const image = slackProfile?.image || "";

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`modal-card ${isExiting ? "exit" : "enter"}`}
        style={{
          backgroundColor: "rgba(255, 255, 255, 0.92)",
          padding: 20,
          borderRadius: 12,
          minWidth: 320,
          maxWidth: 420,
          width: "90%",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          border: "1px solid rgba(0, 0, 0, 0.12)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>Profile</p>
          <button
            onClick={onClose}
            className="icon-btn"
            aria-label="Close"
            title="Close"
            style={{
              appearance: "none",
              border: "1px solid rgba(0,0,0,0.12)",
              background: "rgba(255,255,255,0.7)",
              width: 32,
              height: 32,
              borderRadius: 9999,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "rgba(0,0,0,0.65)",
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {initialProfile?.slackId ? (
            <>
              <div
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.18)",
                  overflow: "hidden",
                  backgroundColor: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {image ? (
                  <img
                    src={image}
                    alt={displayName || "Slack Avatar"}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div style={{ fontSize: 12, opacity: 0.6 }}>No Avatar</div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 700 }}>{displayName || ""}</span>
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  Signed in via Slack
                </span>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                const base = window.location.origin;
                const w = window.open(
                  `${base}/api/slack/oauthStart?state=${encodeURIComponent(token || "")}`,
                  "slack_oauth",
                  "width=600,height=700",
                );
                const listener = async (evt) => {
                  if (!evt || !evt.data || evt.data.type !== "SLACK_CONNECTED")
                    return;
                  try {
                    const id = String(evt.data.slackId || "");
                    if (!id) return;
                    // Re-fetch profile to get canonical state from server
                    try {
                      const res = await fetch("/api/getMyProfile", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ token }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && data?.ok) {
                        onUpdated?.(data.profile);
                      } else {
                        onUpdated?.({ ...(initialProfile || {}), slackId: id });
                      }
                    } catch (_) {
                      onUpdated?.({ ...(initialProfile || {}), slackId: id });
                    }
                  } catch (_) {}
                  window.removeEventListener("message", listener);
                  try {
                    w && w.close && w.close();
                  } catch (_) {}
                };
                window.addEventListener("message", listener);
              }}
              style={{
                appearance: "none",
                border: 0,
                background: "linear-gradient(180deg, #ff8ec3 0%, #ff6fa5 100%)",
                color: "#fff",
                borderRadius: 10,
                padding: "10px 14px",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Connect to Slack
            </button>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginTop: 8,
          }}
        >
          <span style={{ fontSize: 12, opacity: 0.7 }}>GitHub</span>
          <input
            type="text"
            placeholder="GitHub Username"
            value={githubUsername}
            onChange={(e) => setGithubUsername(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "rgba(255,255,255,0.8)",
              outline: "none",
            }}
          />
          <span style={{ fontSize: 12, opacity: 0.7 }}>Name</span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.18)",
                background: "rgba(255,255,255,0.8)",
                outline: "none",
              }}
            />
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.18)",
                background: "rgba(255,255,255,0.8)",
                outline: "none",
              }}
            />
          </div>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Birthday</span>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            placeholder="YYYY-MM-DD"
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid rgba(0,0,0,0.18)",
              background: "rgba(255,255,255,0.8)",
              outline: "none",
            }}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 4,
            }}
          >
            <span style={{ fontSize: 12, opacity: 0.7 }}>Address</span>
            <input
              type="text"
              placeholder="Street Address"
              value={street1}
              onChange={(e) => setStreet1(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.18)",
                background: "rgba(255,255,255,0.8)",
                outline: "none",
              }}
            />
            <input
              type="text"
              placeholder="Street Address #2"
              value={street2}
              onChange={(e) => setStreet2(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.18)",
                background: "rgba(255,255,255,0.8)",
                outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="City"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{
                  flex: 1,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "rgba(255,255,255,0.8)",
                  outline: "none",
                }}
              />
              <input
                type="text"
                placeholder="Zipcode"
                value={zipcode}
                onChange={(e) => setZipcode(e.target.value)}
                style={{
                  width: 140,
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "rgba(255,255,255,0.8)",
                  outline: "none",
                }}
              />
            </div>
            <input
              type="text"
              placeholder="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(0,0,0,0.18)",
                background: "rgba(255,255,255,0.8)",
                outline: "none",
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          {(hasChanges || saving) && (
            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const payload = {
                    githubUsername,
                    firstName,
                    lastName,
                    birthday,
                    address: { street1, street2, city, zipcode, country },
                  };
                  const res = await fetch("/api/updateMyProfile", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token, profile: payload }),
                  });
                  const data = await res.json().catch(() => ({}));
                  if (res.ok && data?.ok && data?.profile) {
                    onUpdated?.(data.profile);
                  }
                } finally {
                  setSaving(false);
                }
              }}
              style={{
                appearance: "none",
                border: 0,
                background: "linear-gradient(180deg, #ff8ec3 0%, #ff6fa5 100%)",
                color: "#fff",
                borderRadius: 10,
                padding: "10px 14px",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 800,
                flex: 1,
                opacity: saving ? 0.8 : 1,
              }}
            >
              {saving ? "Updating..." : "Update"}
            </button>
          )}
          <button
            onClick={onLogout}
            className="logout-btn"
            style={{
              appearance: "none",
              border: "1px solid rgba(0,0,0,0.18)",
              background: "rgba(0,0,0,0.06)",
              color: "rgba(0,0,0,0.75)",
              borderRadius: 10,
              padding: "10px 14px",
              cursor: "pointer",
              fontWeight: 700,
              flex: 1,
            }}
          >
            Logout
          </button>
        </div>
      </div>
      <style jsx>{`
        .modal-overlay {
          background-color: rgba(255, 255, 255, 0);
          backdrop-filter: blur(0px);
          -webkit-backdrop-filter: blur(0px);
          transition:
            backdrop-filter 240ms ease,
            -webkit-backdrop-filter 240ms ease,
            background-color 240ms ease;
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
          transition:
            transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1),
            opacity 220ms ease;
        }
        .modal-card.enter {
          transform: translateY(0) scale(1);
          opacity: 1;
        }
        .modal-card.exit {
          transform: translateY(6px) scale(0.98);
          opacity: 0;
        }
        .big-cta-btn {
          appearance: none;
          width: 100%;
          padding: 14px 16px;
          border-radius: 14px;
          border: 0;
          cursor: pointer;
          color: #fff;
          font-weight: 800;
          font-size: 16px;
          letter-spacing: 0.2px;
          background: linear-gradient(180deg, #ff8ec3 0%, #ff6fa5 100%);
          transform: translateY(0);
          transition:
            transform 120ms ease,
            opacity 120ms ease;
        }
        .big-cta-btn:hover {
          transform: translateY(-1px);
        }
        .big-cta-btn:active {
          transform: translateY(1px);
        }
        .big-cta-btn:disabled {
          opacity: 0.8;
          cursor: not-allowed;
          transform: none;
          color: rgba(255, 255, 255, 0.9);
          background: linear-gradient(
            180deg,
            rgba(219, 37, 112, 0.45) 0%,
            rgba(176, 22, 89, 0.45) 100%
          );
        }
      `}</style>
    </div>
  );
}

export default function HomeScreen({
  games,
  setAppOpen,
  selectedGame,
  setSelectedGame,
  SlackId,
  token,
  profile,
  setProfile,
}) {
  // selectedGame is now controlled by the parent (index.js)
  const [tokyoTime, setTokyoTime] = useState("");
  const [slackProfile, setSlackProfile] = useState({
    displayName: "",
    image: "",
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Preload SFX and game clip audios for instant playback
  const sfxFiles = ["next.mp3", "prev.mp3", "shiba-bark.mp3"];
  const clipFiles = games.map((g) => g.gameClipAudio).filter(Boolean);
  const {
    play: playSound,
    playClip,
    stopAll,
  } = useAudioManager([...sfxFiles, ...clipFiles]);

  // When selected game changes, play its clip immediately using the preloaded element
  useEffect(() => {
    const clip = games[selectedGame]?.gameClipAudio;
    if (clip) {
      playClip(clip);
    }
  }, [selectedGame]);

  useEffect(() => {
    const updateTokyoTime = () => {
      const now = new Date();
      const formatted = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Tokyo",
      }).format(now);
      setTokyoTime(formatted);
    };

    updateTokyoTime();
    const intervalId = setInterval(updateTokyoTime, 60 * 1000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchSlack = async () => {
      if (!SlackId) return;
      try {
        const res = await fetch(
          `https://cachet.dunkirk.sh/users/${encodeURIComponent(SlackId)}`,
        );
        const json = await res.json().catch(() => ({}));
        if (!cancelled && json && (json.displayName || json.image)) {
          setSlackProfile({
            displayName: json.displayName || "",
            image: json.image || "",
          });
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    };
    fetchSlack();
    return () => {
      cancelled = true;
    };
  }, [SlackId]);

  return (
    <>
      <AppHead title="Shiba" />
      <main
        style={{
          position: "relative",
          backgroundColor: games[selectedGame].bgColor,
          transition: "background-color 0.5s ease-in-out",
          minHeight: "100vh",
        }}
      >
        <MovingBackground />
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 64,
            width: "calc(100% - 128px)",
            borderRadius: 16,
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "rgba(255, 255, 255, 0.51)",
            backdropFilter: "saturate(180%) blur(14px)",
            WebkitBackdropFilter: "saturate(180%) blur(4px)",
            border: "1px solid rgba(255, 255, 255, 0.35)",
            boxShadow:
              "inset 0 1px 1.5px rgba(255, 255, 255, 0.6), inset 0 -8px 16px rgba(255, 255, 255, 0.6)",
            borderBottom: "0px solid rgba(0, 0, 0, 0)",
            justifyContent: "space-between",
            padding: 16,
            paddingLeft: 24,
            paddingRight: 24,
          }}
        >
          <div
            onClick={() => setIsProfileOpen(true)}
            style={{
              display: "flex",
              height: 32,
              width: 32,
              aspectRatio: 1,
              backgroundColor: "white",
              border: "1px solid rgba(0, 0, 0, 0.3)",
              overflow: "hidden",
              alignItems: "center",
              borderRadius: 8,
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            {slackProfile.image ? (
              <img
                src={slackProfile.image}
                alt={slackProfile.displayName || "Slack Avatar"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : null}
          </div>
          <p style={{ fontFamily: "GT Maru", fontWeight: "bold" }}>
            Shiba Arcade
          </p>
          <p style={{ margin: 0 }}>{tokyoTime}</p>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            height: "100vh",
            justifyContent: "center",
          }}
        >
          <GameCarousel
            games={games}
            onSelect={setSelectedGame}
            playSound={playSound}
            setAppOpen={setAppOpen}
            stopAll={stopAll}
            selectedIndex={selectedGame}
          />
          <GameDetails game={games[selectedGame]} />
        </div>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: "100%",
            display: "flex",
            backgroundColor: "rgba(255, 255, 255, 0.35)",
            alignItems: "center",
            backdropFilter: "saturate(180%) blur(14px)",
            WebkitBackdropFilter: "saturate(180%) blur(14px)",
            border: "1px solid #fff",
            boxShadow: "none",
            justifyContent: "space-between",
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 32,
            paddingBottom: 32,
            WebkitClipPath:
              "polygon(0 0, 88px 0, 88px 64px, calc(100% - 88px) 64px, calc(100% - 88px) 0, 100% 0, 100% 100%, 0 100%)",
            clipPath:
              "polygon(0 0, 88px 0, 88px 64px, calc(100% - 88px) 64px, calc(100% - 88px) 0, 100% 0, 100% 100%, 0 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              height: 48,
              marginTop: -24,
              width: 48,
              backgroundColor: "rgba(255, 255, 255, 0.5)",
              aspectRatio: 1,
              border: "1px solid rgba(0, 0, 0, 0.1)",
              borderRadius: "4px",
              padding: 8,
              boxSizing: "border-box",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="./ChatMessage.svg"
              alt="Chat Message"
              style={{
                width: "100%",
                opacity: 0.85,
                height: "100%",
                objectFit: "contain",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              height: 64,
              width: "100%",
              marginLeft: 24,
              marginRight: 24,
              borderRadius: "0px 0px 16px 16px",
              marginTop: -33,
              backgroundColor: "transparent",
            }}
          ></div>
          <div
            onClick={() => playSound("shiba-bark.mp3")}
            style={{
              display: "flex",
              height: 48,
              width: 48,
              marginTop: -24,
              backgroundImage: `url(./shiba-photo.png)`,
              backgroundSize: "contain",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
              aspectRatio: 1,
              border: "1px solid rgba(0, 0, 0, 0.1)",
              borderRadius: 4,
            }}
          ></div>
        </div>
      </main>
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        slackProfile={slackProfile}
        initialProfile={profile}
        token={token}
        onLogout={() => {
          try {
            localStorage.removeItem("token");
          } catch (e) {}
          window.location.reload();
        }}
        onUpdated={(p) => setProfile?.(p)}
      />
    </>
  );
}
