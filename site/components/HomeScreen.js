import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import AppHead from "@/components/AppHead";
import GameCarousel from "@/components/GameCarousel";
import GameDetails from "@/components/GameDetails";
import useAudioManager from "@/components/useAudioManager";
import OnboardingModal from "@/components/OnboardingModal";

// Cookie utility functions
const getCookie = (name) => {
  if (typeof document === "undefined") return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(";").shift();
  return null;
};

const setCookie = (name, value, days = 365) => {
  if (typeof document === "undefined") return;
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

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

function EventsModal({ isOpen, onClose, token }) {
  const [shouldRender, setShouldRender] = useState(Boolean(isOpen));
  const [isExiting, setIsExiting] = useState(false);
  const [userRSVPs, setUserRSVPs] = useState([]);
  const [isRSVPing, setIsRSVPing] = useState(false);
  const [rsvpMessage, setRsvpMessage] = useState("");

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

  // Fetch user's RSVPs when modal opens
  useEffect(() => {
    if (!isOpen || !token) return;

    const fetchRSVPs = async () => {
      try {
        const res = await fetch("/api/GetRSVPs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.ok) {
          setUserRSVPs(data.rsvps || []);
        }
      } catch (error) {
        console.error("Failed to fetch RSVPs:", error);
      }
    };

    fetchRSVPs();
  }, [isOpen, token]);

  const hasRSVPedForShibaDirect = userRSVPs.some(
    (rsvp) => rsvp.event === "Shiba-Direct",
  );
  const hasRSVPedForShibaWorkshop = userRSVPs.some(
    (rsvp) => rsvp.event === "Shiba-Workshop",
  );
  const hasRSVPedForClickerWorkshop = userRSVPs.some(
    (rsvp) => rsvp.event === "Shiba-Clicker-Workshop",
  );

  const handleRSVP = async (eventName) => {
    if (!token || isRSVPing) return;

    setIsRSVPing(true);
    setRsvpMessage("");

    try {
      const res = await fetch("/api/CreateRSVP", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, event: eventName }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data?.ok) {
        setRsvpMessage(
          "RSVP successful! You'll receive an email 30 minutes before the event.",
        );
        // Refresh RSVPs
        const rsvpRes = await fetch("/api/GetRSVPs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const rsvpData = await rsvpRes.json().catch(() => ({}));
        if (rsvpRes.ok && rsvpData?.ok) {
          setUserRSVPs(rsvpData.rsvps || []);
        }
      } else if (res.status === 409) {
        setRsvpMessage("You've already RSVPed for this event!");
      } else {
        setRsvpMessage(data?.message || "Failed to RSVP");
      }
    } catch (error) {
      console.error("RSVP error:", error);
      setRsvpMessage("Failed to RSVP");
    } finally {
      setIsRSVPing(false);
    }
  };

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
          maxHeight: "90vh",
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
          <p style={{ margin: 0, fontWeight: 600 }}>Upcoming Events</p>
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
            gap: 16,
            alignItems: "center",
            textAlign: "center",
            overflowY: "auto",
            flex: 1,
            paddingRight: 8,
            paddingBottom: 4,
          }}
        >
          <div
            style={{
              border: "4px solid #FF2200",
              borderRadius: "8px",
              background: "linear-gradient(to bottom, #ffb7b5, #ed7874)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: "8px",
              padding: "16px",
              width: "100%",
            }}
          >
            <img
              src="/landing/shiba_direct.png"
              style={{ width: "80%", marginBottom: "8px" }}
            />
            <p style={{ margin: 0, fontSize: "14px" }}>
              22 august · 4:30pm – 5:30pm PST
            </p>
            <p style={{ margin: 0, fontSize: "14px" }}>
              our kickoff event where we'll release features & many surpises
            </p>
            {hasRSVPedForShibaDirect ? (
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.8)",
                  border: "2px dotted #006600",
                  borderRadius: "8px",
                  padding: "12px",
                  margin: "8px 0",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#006600",
                  }}
                >
                  You're RSVPed, you'll automatically receive an email with the
                  zoom link 30 minutes before.
                </p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleRSVP("Shiba-Direct")}
                  disabled={isRSVPing}
                  style={{
                    appearance: "none",
                    border: "2px solid #FF2200",
                    background: "#ffffff",
                    color: "#FF2200",
                    borderRadius: 10,
                    padding: "10px 14px",
                    cursor: isRSVPing ? "not-allowed" : "pointer",
                    fontWeight: 800,
                    fontSize: "14px",
                    opacity: isRSVPing ? 0.8 : 1,
                    transition:
                      "opacity 0.2s ease, background-color 0.2s ease, color 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isRSVPing) {
                      e.target.style.background = "#FF2200";
                      e.target.style.color = "#ffffff";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isRSVPing) {
                      e.target.style.background = "#ffffff";
                      e.target.style.color = "#FF2200";
                    }
                  }}
                >
                  {isRSVPing ? "RSVPing..." : "RSVP"}
                </button>
              </>
            )}
          </div>

          <div
            style={{
              border: "4px solid #4A90E2",
              borderRadius: "8px",
              background: "linear-gradient(to bottom, #b8d4f0, #9bc2e6)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: "8px",
              padding: "16px",
              width: "100%",
            }}
          >
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>
              Shiba Workshop: Setting up Godot and Hackatime
            </p>
            <p style={{ margin: 0, fontSize: "14px" }}>
              19 august · 11am–12pm PT
            </p>
            <p style={{ margin: 0, fontSize: "14px" }}>
              learn to set up godot and hackatime so you can start programming!
            </p>
            {hasRSVPedForShibaWorkshop ? (
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.8)",
                  border: "2px dotted #006600",
                  borderRadius: "8px",
                  padding: "12px",
                  margin: "8px 0",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#006600",
                  }}
                >
                  You're RSVPed! We'll remind you to join the Slack huddle.
                </p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleRSVP("Shiba-Workshop")}
                  disabled={isRSVPing}
                  style={{
                    appearance: "none",
                    border: "2px solid #4A90E2",
                    background: "#ffffff",
                    color: "#4A90E2",
                    borderRadius: 10,
                    padding: "10px 14px",
                    cursor: isRSVPing ? "not-allowed" : "pointer",
                    fontWeight: 800,
                    fontSize: "14px",
                    opacity: isRSVPing ? 0.8 : 1,
                    transition:
                      "opacity 0.2s ease, background-color 0.2s ease, color 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isRSVPing) {
                      e.target.style.background = "#4A90E2";
                      e.target.style.color = "#ffffff";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isRSVPing) {
                      e.target.style.background = "#ffffff";
                      e.target.style.color = "#4A90E2";
                    }
                  }}
                >
                  {isRSVPing ? "RSVPing..." : "RSVP"}
                </button>
              </>
            )}
          </div>

          <div
            style={{
              border: "4px solid #8B5CF6",
              borderRadius: "8px",
              background: "linear-gradient(to bottom, #d8c7f8, #c4b5fd)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              gap: "8px",
              padding: "16px",
              width: "100%",
            }}
          >
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>
              Shiba Workshop: Let's Make a Clicker Game!
            </p>
            <p style={{ margin: 0, fontSize: "14px" }}>
              19 august · 3pm–4pm PT
            </p>
            <p style={{ margin: 0, fontSize: "14px" }}>
              let's make a godot clicker game together to learn the basics of godot!
            </p>
            {hasRSVPedForClickerWorkshop ? (
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.8)",
                  border: "2px dotted #006600",
                  borderRadius: "8px",
                  padding: "12px",
                  margin: "8px 0",
                }}
              >
                <p
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    fontWeight: "bold",
                    color: "#006600",
                  }}
                >
                  You're RSVPed! We'll remind you to join the Slack huddle.
                </p>
              </div>
            ) : (
              <>
                <button
                  onClick={() => handleRSVP("Shiba-Clicker-Workshop")}
                  disabled={isRSVPing}
                  style={{
                    appearance: "none",
                    border: "2px solid #8B5CF6",
                    background: "#ffffff",
                    color: "#8B5CF6",
                    borderRadius: 10,
                    padding: "10px 14px",
                    cursor: isRSVPing ? "not-allowed" : "pointer",
                    fontWeight: 800,
                    fontSize: "14px",
                    opacity: isRSVPing ? 0.8 : 1,
                    transition:
                      "opacity 0.2s ease, background-color 0.2s ease, color 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isRSVPing) {
                      e.target.style.background = "#8B5CF6";
                      e.target.style.color = "#ffffff";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isRSVPing) {
                      e.target.style.background = "#ffffff";
                      e.target.style.color = "#8B5CF6";
                    }
                  }}
                >
                  {isRSVPing ? "RSVPing..." : "RSVP"}
                </button>
              </>
            )}
          </div>

          <p style={{ margin: 0, fontSize: "14px", opacity: 0.7, marginTop: 8 }}>
            More events to be announced soon
          </p>
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
  const [state, setState] = useState("");
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
    setState((p.address && p.address.state) || "");
    setZipcode((p.address && p.address.zipcode) || "");
    setCountry((p.address && p.address.country) || "");
    setSaving(false);
  }, [isOpen, initialProfile]);

  const hasChanges = useMemo(() => {
    const p = initialProfile || {};
    return (
      githubUsername !== (p.githubUsername || "") ||
      firstName !== (p.firstName || "") ||
      lastName !== (p.lastName || "") ||
      birthday !== (p.birthday || "") ||
      street1 !== ((p.address && p.address.street1) || "") ||
      street2 !== ((p.address && p.address.street2) || "") ||
      city !== ((p.address && p.address.city) || "") ||
      state !== ((p.address && p.address.state) || "") ||
      zipcode !== ((p.address && p.address.zipcode) || "") ||
      country !== ((p.address && p.address.country) || "")
    );
  }, [
    githubUsername,
    firstName,
    lastName,
    birthday,
    street1,
    street2,
    city,
    state,
    zipcode,
    country,
    initialProfile,
  ]);

  const handleCloseAttempt = () => {
    if (hasChanges) {
      const confirmed = confirm(
        "You haven't saved your changes. Tap update to save your changes",
      );
      if (confirmed) {
        onClose?.();
      }
    } else {
      onClose?.();
    }
  };

  if (!shouldRender) return null;

  const displayName = slackProfile?.displayName || "";
  const image = slackProfile?.image || "";

  const inputStyle = {
    padding: 10,
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.18)",
    background: "rgba(255,255,255,0.8)",
    outline: "none",
    boxSizing: "border-box",
  };

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
        if (e.target === e.currentTarget) handleCloseAttempt();
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
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
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
            onClick={handleCloseAttempt}
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

        {/* Slack Connect */}
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
                {/* <span style={{ fontSize: 12, opacity: 0.7 }}>
                  Signed in via Slack
                </span> */}
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
                  if (!evt?.data || evt.data.type !== "SLACK_CONNECTED") return;
                  const id = String(evt.data.slackId || "");
                  if (!id) return;
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
                  window.removeEventListener("message", listener);
                  try {
                    w?.close();
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

        {/* Inputs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* GitHub and Referral Code */}
          <div style={{ display: "flex", gap: 8 }}>
            {/* GitHub */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>GitHub</span>
                {!githubUsername && (
                  <span
                    style={{ fontSize: 10, color: "#FF0000", fontWeight: "bold" }}
                  >
                    (missing required field)
                  </span>
                )}
              </div>
              <input
                type="text"
                placeholder="GitHub Username"
                value={githubUsername}
                onChange={(e) => setGithubUsername(e.target.value)}
                style={{ ...inputStyle, width: "100%" }}
              />
            </div>

            {/* Referral Code */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, opacity: 0.7 }}>Share Code</span>
                {initialProfile?.referralNumber !== undefined && (
                  <span style={{ fontSize: 11, opacity: 0.6, fontWeight: 500 }}>
                    ({initialProfile.referralNumber} onboarded)
                  </span>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  background: "rgba(255,255,255,0.8)",
                  cursor: "pointer",
                  transition: "background-color 0.2s ease",
                }}
                onClick={() => {
                  if (initialProfile?.referralCode) {
                    const baseUrl = window.location.origin;
                    const referralUrl = `${baseUrl}?sentby=${initialProfile.referralCode}`;
                    
                    // Track referral code copy with Plausible
                    if (window.plausible) {
                      window.plausible('Referral Code Copied', {
                        props: {
                          referralCode: initialProfile.referralCode,
                          location: 'profile-modal'
                        }
                      });
                    }
                    
                    navigator.clipboard.writeText(referralUrl).then(() => {
                      // Show a brief success message
                      const originalText = document.querySelector('.referral-copy-text')?.textContent;
                      const copyText = document.querySelector('.referral-copy-text');
                      if (copyText) {
                        copyText.textContent = 'Copied!';
                        setTimeout(() => {
                          copyText.textContent = originalText || initialProfile.referralCode;
                        }, 1000);
                      }
                    }).catch(err => {
                      console.error('Failed to copy: ', err);
                    });
                  }
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "rgba(255,255,255,0.95)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "rgba(255,255,255,0.8)";
                }}
              >
                <span 
                  className="referral-copy-text"
                  style={{ 
                    flex: 1, 
                    fontSize: "14px",
                    color: initialProfile?.referralCode ? "rgba(0,0,0,0.8)" : "rgba(0,0,0,0.4)",
                    fontFamily: "monospace",
                    fontWeight: "600"
                  }}
                >
                  {initialProfile?.referralCode || "No referral code"}
                </span>
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                  style={{ 
                    color: "rgba(0,0,0,0.6)",
                    flexShrink: 0
                  }}
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </div>
            </div>
          </div>

          {/* Name */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Name</span>
            {(!firstName || !lastName) && (
              <span
                style={{ fontSize: 10, color: "#FF0000", fontWeight: "bold" }}
              >
                (missing required field)
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="text"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            />
            <input
              type="text"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            />
          </div>

          {/* Birthday */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Birthday</span>
            {!birthday && (
              <span
                style={{ fontSize: 10, color: "#FF0000", fontWeight: "bold" }}
              >
                (missing required field)
              </span>
            )}
          </div>
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            style={{ ...inputStyle, width: "100%" }}
          />

          {/* Address */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12, opacity: 0.7 }}>Address</span>
            {(!street1 || !city || !state || !zipcode || !country) && (
              <span
                style={{ fontSize: 10, color: "#FF0000", fontWeight: "bold" }}
              >
                (missing required field)
              </span>
            )}
          </div>
          
          {/* Street Addresses - Side by side */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Street Address"
              value={street1}
              onChange={(e) => setStreet1(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: "calc(50% - 4px)" }}
            />
            <input
              type="text"
              placeholder="Street Address #2"
              value={street2}
              onChange={(e) => setStreet2(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: "calc(50% - 4px)" }}
            />
          </div>
          
          {/* City and Zipcode - Side by side */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              style={{ ...inputStyle, flex: 2, minWidth: "calc(60% - 4px)" }}
            />
            <input
              type="text"
              placeholder="Zipcode"
              value={zipcode}
              onChange={(e) => setZipcode(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: "calc(40% - 4px)" }}
            />
          </div>
          
          {/* State and Country - Side by side */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="State / Province"
              value={state}
              onChange={(e) => setState(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: "calc(50% - 4px)" }}
            />
            <input
              type="text"
              placeholder="Country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              style={{ ...inputStyle, flex: 1, minWidth: "calc(50% - 4px)" }}
            />
          </div>
        </div>

        {/* Buttons */}
        <div
          style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}
        >
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
                    address: {
                      street1,
                      street2,
                      city,
                      state,
                      zipcode,
                      country,
                    },
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

      {/* Styles */}
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
      `}</style>
    </div>
  );
}



export default function HomeScreen({ games, setAppOpen, selectedGame, setSelectedGame, SlackId, token, profile, setProfile, autoOpenProfile }) {


  // selectedGame is now controlled by the parent (index.js)
  const [tokyoTime, setTokyoTime] = useState("");
  const [slackProfile, setSlackProfile] = useState({
    displayName: "",
    image: "",
  });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isEventsOpen, setIsEventsOpen] = useState(false);
  const [hasOpenedEventsNotification, setHasOpenedEventsNotification] = useState(false);
  const [hasOnboarded, setHasOnboarded] = useState(true);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Preload SFX and game clip audios for instant playback
  const sfxFiles = ["next.mp3", "prev.mp3", "shiba-bark.mp3"];
  const clipFiles = games.map((g) => g.gameClipAudio).filter(Boolean);
  const {
    play: playSound,
    playClip,
    stopAll,
  } = useAudioManager([...sfxFiles, ...clipFiles, "zeldaSong.mp3"]);

  // Check if user has opened events notification
  useEffect(() => {
    const hasOpened = getCookie("hasOpenedEventsNotification");
    setHasOpenedEventsNotification(hasOpened === "true");
  }, []);

  // Set cookie when events modal is opened
  useEffect(() => {
    if (isEventsOpen && !hasOpenedEventsNotification) {
      setCookie("hasOpenedEventsNotification", "true");
      setHasOpenedEventsNotification(true);
    }
  }, [isEventsOpen, hasOpenedEventsNotification]);

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

  // Auto-open profile modal if requested
  useEffect(() => {
    if (autoOpenProfile) {
      setIsProfileOpen(true);
    }
  }, [autoOpenProfile]);

  // Check onboarding status when profile is loaded
  useEffect(() => {
    if (profile && profile.hasOnboarded === false) {
      setHasOnboarded(false);
      setIsOnboardingOpen(true);
    } else if (profile) {
      setHasOnboarded(true);
    }
  }, [profile]);

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
              overflow: "visible",
              alignItems: "center",
              borderRadius: 8,
              justifyContent: "center",
              cursor: "pointer",
              position: "relative",
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: 8,
                overflow: "hidden",
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
            {(() => {
              if (!profile) return null;

              const missingFields = [
                !profile.firstName && "firstName",
                !profile.lastName && "lastName",
                !profile.email && "email",
                !profile.githubUsername && "githubUsername",
                !profile.birthday && "birthday",
                !profile.slackId && "slackId",
                !profile.address?.street1 && "street1",
                !profile.address?.city && "city",
                !profile.address?.zipcode && "zipcode",
                !profile.address?.country && "country",
              ].filter(Boolean);

              const missingCount = missingFields.length;

              if (missingCount === 0) return null;

              return (
                <div
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    width: 16,
                    height: 16,
                    backgroundColor: "#FF0000",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontSize: "10px",
                    fontWeight: "bold",
                    border: "1px solid white",
                    pointerEvents: "none",
                  }}
                >
                  {missingCount > 9 ? "9+" : missingCount}
                </div>
              );
            })()}
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
            isProfileOpen={isProfileOpen}
            isEventsOpen={isEventsOpen}
            isOnboardingOpen={isOnboardingOpen}
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
            onClick={() => setIsEventsOpen(true)}
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
              cursor: "pointer",
              transition: "background-color 0.2s ease",
              position: "relative",
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = "rgba(255, 255, 255, 0.7)";
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = "rgba(255, 255, 255, 0.5)";
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
            {!hasOpenedEventsNotification && (
              <div
                style={{
                  position: "absolute",
                  top: -4,
                  right: -4,
                  width: 20,
                  height: 20,
                  backgroundColor: "#FF0000",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "12px",
                  fontWeight: "bold",
                  border: "2px solid white",
                  pointerEvents: "none",
                }}
              >
                1
              </div>
            )}
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
      <EventsModal
        isOpen={isEventsOpen}
        onClose={() => setIsEventsOpen(false)}
        token={token}
      />
      <OnboardingModal
        isOpen={isOnboardingOpen}
        token={token}
        playSound={playSound}
        playClip={playClip}
        stopAll={stopAll}
        onCompleted={(updatedProfile) => {
          setProfile?.(updatedProfile);
          setHasOnboarded(true);
          setIsOnboardingOpen(false);
        }}
      />
    </>
  );
}
