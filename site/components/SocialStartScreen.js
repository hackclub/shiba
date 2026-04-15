import { useState, useRef, useEffect } from "react";
import dynamic from 'next/dynamic';
import { useActivityTracker } from './useActivityTracker';
import UploadModal from './UploadModal';

const PostAttachmentRenderer = dynamic(() => import('@/components/utils/PostAttachmentRenderer'), { ssr: false });
const PlayGameComponent = dynamic(() => import('@/components/utils/playGameComponent'), { ssr: false });

function SignupModal({ onClose, onSignupSuccess, requestOtp, verifyOtp, theme }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState("email"); // whether user is inputting email or otp
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const emailInputRef = useRef(null);

  useEffect(() => {
    if (stage === "email" && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [stage]);

  const onRequest = async () => {
    if (!requestOtp) return;
    setLoading(true);
    setMessage("");
    // Get sentby from URL parameters like StartScreen does
    const urlParams = new URLSearchParams(window.location.search);
    const sentby = urlParams.get('sentby');
    const result = await requestOtp(email, sentby);
    if (result?.ok) {
      setStage("otp");
      setMessage("");
    } else {
      setMessage(result?.message || "Failed to request code.");
    }
    setLoading(false);
  };

  const onVerify = async () => {
    if (!verifyOtp) return;
    setLoading(true);
    setMessage("");
    const result = await verifyOtp(email, otp);
    if (result?.ok && result?.token) {
      onSignupSuccess?.(result.token);
      onClose();
    } else {
      // If verification fails, automatically request a new OTP
      alert("Verification failed. A new code has been sent to your email.");
      setOtp(""); // Clear the OTP input
      if (requestOtp) {
        // Get sentby from URL parameters like StartScreen does
        const urlParams = new URLSearchParams(window.location.search);
        const sentby = urlParams.get('sentby');
        const newOtpResult = await requestOtp(email, sentby);
        if (newOtpResult?.ok) {
          setMessage("New code sent. Check your email.");
        } else {
          setMessage("Failed to send new code. Please try again.");
        }
      } else {
        setMessage("Verification failed. Please request a new code.");
      }
    }
    setLoading(false);
  };

  const handleSlackLogin = () => {
    window.open(
      "https://slack.com/oauth/v2/authorize?client_id=2210535565.9361842154099&user_scope=users:read,users:read.email&redirect_uri=https://shiba.hackclub.com",
      "_blank",
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: theme.surface,
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "500px",
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)"
        }}
      >
        {/* Header */}
        <div style={{ 
          display: "flex", 
          flexDirection: "row", 
          alignItems: "center", 
          justifyContent: "space-between",
          marginBottom: "20px" 
        }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold", color: theme.text }}>
            Join Shiba Arcade
          </h3>
          <button
            onClick={onClose}
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

        {/* Email Input */}
        {stage === "email" && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: theme.text }}>
              Email Address:
            </label>
            <div style={{
              display: "flex",
              border: "1px solid rgba(0, 0, 0, 0.18)",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.75)",
              overflow: "hidden"
            }}>
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="orpheus@hackclub.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onRequest();
                  }
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  outline: "none",
                  border: "none",
                  background: "transparent",
                  fontFamily: "inherit"
                }}
              />
              <button
                onClick={onRequest}
                disabled={loading || !email.trim()}
                style={{
                  appearance: "none",
                  border: "none",
                  background: loading || !email.trim() ? "#ccc" : "linear-gradient(180deg, #ff8ec3 0%, #ff6fa5 100%)",
                  color: "#fff",
                  padding: "10px 16px",
                  cursor: loading || !email.trim() ? "not-allowed" : "pointer",
                  fontWeight: "800",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  opacity: loading || !email.trim() ? 0.5 : 1,
                  borderLeft: "1px solid rgba(0, 0, 0, 0.1)"
                }}
              >
                {loading ? "Sending..." : "Send Code"}
              </button>
            </div>
          </div>
        )}

        {/* OTP Input */}
        {stage === "otp" && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: theme.text }}>
              Enter 6-digit code:
            </label>
            <div style={{
              display: "flex",
              border: "1px solid rgba(0, 0, 0, 0.18)",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.75)",
              overflow: "hidden"
            }}>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                inputMode="numeric"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onVerify();
                  }
                }}
                maxLength={6}
                style={{
                  flex: 1,
                  padding: "10px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  outline: "none",
                  border: "none",
                  background: "transparent",
                  fontFamily: "inherit"
                }}
              />
              <button
                onClick={onVerify}
                disabled={loading || !otp.trim() || otp.length !== 6}
                style={{
                  appearance: "none",
                  border: "none",
                  background: loading || !otp.trim() || otp.length !== 6 ? "#ccc" : "linear-gradient(180deg, #ff8ec3 0%, #ff6fa5 100%)",
                  color: "#fff",
                  padding: "10px 16px",
                  cursor: loading || !otp.trim() || otp.length !== 6 ? "not-allowed" : "pointer",
                  fontWeight: "800",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  opacity: loading || !otp.trim() || otp.length !== 6 ? 0.5 : 1,
                  borderLeft: "1px solid rgba(0, 0, 0, 0.1)"
                }}
              >
                {loading ? "Verifying..." : "Verify & Login"}
              </button>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div style={{ 
            marginBottom: "16px", 
            padding: "8px 12px", 
            borderRadius: "6px",
            fontSize: "13px",
            backgroundColor: stage === "otp" && message.includes("New code sent") ? "#d4edda" : "#f8d7da",
            color: stage === "otp" && message.includes("New code sent") ? "#155724" : "#721c24",
            border: stage === "otp" && message.includes("New code sent") ? "1px solid #c3e6cb" : "1px solid #f5c6cb"
          }}>
            {message}
          </div>
        )}

      </div>
    </div>
  );
}

function LoginModal({ onClose, onLoginSuccess, requestOtp, verifyOtp, theme }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState("email"); // whether user is inputting email or otp
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const emailInputRef = useRef(null);

  useEffect(() => {
    if (stage === "email" && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [stage]);

  const onRequest = async () => {
    if (!requestOtp) return;
    setLoading(true);
    setMessage("");
    // Get sentby from URL parameters like StartScreen does
    const urlParams = new URLSearchParams(window.location.search);
    const sentby = urlParams.get('sentby');
    const result = await requestOtp(email, sentby);
    if (result?.ok) {
      setStage("otp");
      setMessage("");
    } else {
      setMessage(result?.message || "Failed to request code.");
    }
    setLoading(false);
  };

  const onVerify = async () => {
    if (!verifyOtp) return;
    setLoading(true);
    setMessage("");
    const result = await verifyOtp(email, otp);
    if (result?.ok && result?.token) {
      onLoginSuccess?.(result.token);
      onClose();
    } else {
      // If verification fails, automatically request a new OTP
      alert("Verification failed. A new code has been sent to your email.");
      setOtp(""); // Clear the OTP input
      if (requestOtp) {
        // Get sentby from URL parameters like StartScreen does
        const urlParams = new URLSearchParams(window.location.search);
        const sentby = urlParams.get('sentby');
        const newOtpResult = await requestOtp(email, sentby);
        if (newOtpResult?.ok) {
          setMessage("New code sent. Check your email.");
        } else {
          setMessage("Failed to send new code. Please try again.");
        }
      } else {
        setMessage("Verification failed. Please request a new code.");
      }
    }
    setLoading(false);
  };

  const handleSlackLogin = () => {
    window.open(
      "https://slack.com/oauth/v2/authorize?client_id=2210535565.9361842154099&user_scope=users:read,users:read.email&redirect_uri=https://shiba.hackclub.com",
      "_blank",
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: theme.surface,
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "500px",
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)"
        }}
      >
        {/* Header */}
        <div style={{ 
          display: "flex", 
          flexDirection: "row", 
          alignItems: "center", 
          justifyContent: "space-between",
          marginBottom: "20px" 
        }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold", color: theme.text }}>
            Login to Shiba Arcade
          </h3>
          <button
            onClick={onClose}
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

        {/* Email Input */}
        {stage === "email" && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: theme.text }}>
              Email Address:
            </label>
            <div style={{
              display: "flex",
              border: "1px solid rgba(0, 0, 0, 0.18)",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.75)",
              overflow: "hidden"
            }}>
              <input
                ref={emailInputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="orpheus@hackclub.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onRequest();
                  }
                }}
                style={{
                  flex: 1,
                  padding: "10px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  outline: "none",
                  border: "none",
                  background: "transparent",
                  fontFamily: "inherit"
                }}
              />
              <button
                onClick={onRequest}
                disabled={loading || !email.trim()}
                style={{
                  appearance: "none",
                  border: "none",
                  background: loading || !email.trim() ? "#ccc" : "linear-gradient(180deg, #ff8ec3 0%, #ff6fa5 100%)",
                  color: "#fff",
                  padding: "10px 16px",
                  cursor: loading || !email.trim() ? "not-allowed" : "pointer",
                  fontWeight: "800",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  opacity: loading || !email.trim() ? 0.5 : 1,
                  borderLeft: "1px solid rgba(0, 0, 0, 0.1)"
                }}
              >
                {loading ? "Sending..." : "Send Code"}
              </button>
            </div>
          </div>
        )}

        {/* OTP Input */}
        {stage === "otp" && (
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: theme.text }}>
              Enter 6-digit code:
            </label>
            <div style={{
              display: "flex",
              border: "1px solid rgba(0, 0, 0, 0.18)",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.75)",
              overflow: "hidden"
            }}>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="Enter 6-digit code"
                inputMode="numeric"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onVerify();
                  }
                }}
                maxLength={6}
                style={{
                  flex: 1,
                  padding: "10px",
                  fontSize: "14px",
                  boxSizing: "border-box",
                  outline: "none",
                  border: "none",
                  background: "transparent",
                  fontFamily: "inherit"
                }}
              />
              <button
                onClick={onVerify}
                disabled={loading || !otp.trim() || otp.length !== 6}
                style={{
                  appearance: "none",
                  border: "none",
                  background: loading || !otp.trim() || otp.length !== 6 ? "#ccc" : "linear-gradient(180deg, #ff8ec3 0%, #ff6fa5 100%)",
                  color: "#fff",
                  padding: "10px 16px",
                  cursor: loading || !otp.trim() || otp.length !== 6 ? "not-allowed" : "pointer",
                  fontWeight: "800",
                  fontSize: "13px",
                  fontFamily: "inherit",
                  opacity: loading || !otp.trim() || otp.length !== 6 ? 0.5 : 1,
                  borderLeft: "1px solid rgba(0, 0, 0, 0.1)"
                }}
              >
                {loading ? "Verifying..." : "Verify & Login"}
              </button>
            </div>
          </div>
        )}

        {/* Message */}
        {message && (
          <div style={{ 
            marginBottom: "16px", 
            padding: "8px 12px", 
            borderRadius: "6px",
            fontSize: "13px",
            backgroundColor: stage === "otp" && message.includes("New code sent") ? "#d4edda" : "#f8d7da",
            color: stage === "otp" && message.includes("New code sent") ? "#155724" : "#721c24",
            border: stage === "otp" && message.includes("New code sent") ? "1px solid #c3e6cb" : "1px solid #f5c6cb"
          }}>
            {message}
          </div>
        )}


        {/* Slack Login Button */}
        <div style={{ marginTop: "16px", textAlign: "center" }}>
          <button
            onClick={handleSlackLogin}
            style={{
              appearance: "none",
              border: "2px solid #2D0B2D",
              background: "#4A154B",
              color: "white",
              borderRadius: "8px",
              padding: "10px 16px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "13px",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              justifyContent: "center"
            }}
          >
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/d/d5/Slack_icon_2019.svg"
              alt="Slack"
              width="16"
              height="16"
              style={{ filter: "brightness(0) invert(1)" }}
            />
            Login with Slack
          </button>
        </div>
      </div>
    </div>
  );
}

function FeedbackModal({ gameId, game, onClose, token, slackProfile }) {
  const [message, setMessage] = useState("");
  const [starRating, setStarRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) {
      setSubmitMessage("Please enter a message");
      return;
    }
    if (starRating === 0) {
      setSubmitMessage("Please select a star rating");
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage("");

    try {
      const res = await fetch("/api/CreateGameFeedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          gameId,
          message: message.trim(),
          starRanking: starRating
        }),
      });

      const data = await res.json();
      
      if (data.ok) {
        setIsSent(true);
        setMessage("");
        setStarRating(0);
        setTimeout(() => {
          onClose();
          setIsSent(false);
        }, 1500);
      } else {
        setSubmitMessage(data.message || "Failed to send feedback");
      }
    } catch (error) {
      console.error("Error sending feedback:", error);
      setSubmitMessage("Failed to send feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = () => {
    return Array.from({ length: 5 }, (_, index) => {
      const starNumber = index + 1;
      const isSelected = starNumber <= starRating;
      
      return (
        <button
          key={starNumber}
          onClick={() => setStarRating(starNumber)}
          style={{
            background: "none",
            border: "none",
            padding: "4px",
            cursor: "pointer"
          }}
        >
          <img
            src="/SpeedyShibaShipper.png"
            alt={`${starNumber} star`}
            style={{
              width: "24px",
              height: "24px",
              opacity: isSelected ? 1.0 : 0.1,
              transition: "opacity 0.2s ease"
            }}
          />
        </button>
      );
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "24px",
          maxWidth: "500px",
          width: "100%",
          maxHeight: "80vh",
          overflow: "auto",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)"
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "bold", color: "#333" }}>
            Give yap (feedback) to{" "}
            {slackProfile?.image && (
              <img
                src={slackProfile.image}
                alt={slackProfile.displayName || "User"}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "4px",
                  marginRight: "8px",
                  verticalAlign: "middle"
                }}
              />
            )}
            {slackProfile?.displayName || "User"} for {game?.name || "this game"}
          </h3>
        </div>

        {/* Star Rating */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#333" }}>
            Star Rating (1-5):
          </label>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {renderStars()}
            <span style={{ marginLeft: "12px", fontSize: "14px", color: "#666" }}>
              {starRating > 0 ? `${starRating} star${starRating > 1 ? 's' : ''}` : "Select rating"}
            </span>
          </div>
        </div>

        {/* Message Text Area */}
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "600", color: "#333" }}>
            Your Feedback:
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share your thoughts about this game..."
            style={{
              width: "100%",
              minHeight: "120px",
              resize: "vertical",
              fontSize: "14px",
              boxSizing: "border-box",
              padding: "10px",
              outline: "none",
              border: "1px solid rgba(0, 0, 0, 0.18)",
              borderRadius: "10px",
              background: "rgba(255, 255, 255, 0.75)",
              fontFamily: "inherit"
            }}
          />
        </div>

        {/* Submit Message - only show error messages */}
        {submitMessage && !isSent && (
          <div style={{ 
            marginBottom: "16px", 
            padding: "8px 12px", 
            borderRadius: "6px",
            fontSize: "13px",
            backgroundColor: "#f8d7da",
            color: "#721c24",
            border: "1px solid #f5c6cb"
          }}>
            {submitMessage}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !message.trim() || starRating === 0 || isSent}
            style={{
              appearance: "none",
              border: "0",
              background: isSent 
                ? "#22c55e" 
                : isSubmitting || !message.trim() || starRating === 0 
                  ? "#ccc" 
                  : "linear-gradient(180deg, #ff8ec3 0%, #ff6fa5 100%)",
              color: "#fff",
              borderRadius: "10px",
              padding: "10px 16px",
              cursor: isSubmitting || !message.trim() || starRating === 0 || isSent ? "not-allowed" : "pointer",
              fontWeight: "800",
              fontSize: "13px",
              fontFamily: "inherit",
              opacity: isSubmitting || !message.trim() || starRating === 0 ? 0.5 : 1
            }}
          >
            {isSent ? "Sent" : isSubmitting ? "Sending..." : "Send Feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SocialStartScreen({ games: initialGames = [], gamesError: initialGamesError = null, onLoginClick, onSignupClick, token = null, profile = null, onEnterArcade = null, requestOtp = null, verifyOtp = null, setToken = null }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState('');
  const [displayCount, setDisplayCount] = useState(12);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState("Games");
  const [games, setGames] = useState(initialGames || []);
  const [gamesError, setGamesError] = useState(initialGamesError);
  const [gamesLoading, setGamesLoading] = useState(!initialGames || initialGames.length === 0);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [slackProfile, setSlackProfile] = useState(null);
  const [slackCode, setSlackCode] = useState(null);
  const [activeGameId, setActiveGameId] = useState(null);
  const [gameComponentKeys, setGameComponentKeys] = useState({});
  const [stampedGames, setStampedGames] = useState(new Set());
  const [selectedMessageProject, setSelectedMessageProject] = useState(null);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [userXP, setUserXP] = useState(0); // This comes from the API response
  const mountedRef = useRef(false);
  const profileDropdownRef = useRef(null);

  // Load stamped games from server (only for logged-in users)
  useEffect(() => {
    const loadStampedGames = async () => {
      if (typeof window !== 'undefined' && token) {
        // Add small delay to ensure games render first
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          const response = await fetch('/api/getMyPaws', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          });
          
          const result = await response.json();
          if (response.ok && result.ok) {
            setStampedGames(new Set(result.followingGames || []));
          }
        } catch (e) {
          console.error('Failed to load stamped games from server:', e);
        }
      } else {
        // Clear stamps for non-logged-in users
        setStampedGames(new Set());
      }
    };
    
    loadStampedGames();
  }, [token]);


  // Activity tracking
  const { isActive, totalTimeSpent, sessionId, logSpecificActivity, logGamePlayStart, logGamePlayStop, isGamePlaying } = useActivityTracker(
    'SocialStartScreen', 
    token, 
    {
      activityThreshold: 5, // Log every 5 seconds
      heartbeatInterval: 5000, // Check activity every 5 seconds
      inactivityTimeout: 30000 // Consider inactive after 30 seconds
    }
  );

  useEffect(() => {
    mountedRef.current = true;
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false);
      }
    };

    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  // Calculate level and title based on XP
  const calculateLevelAndTitle = (xp) => {
    const getTitle = (xpEarned) => {
      if (xpEarned >= 3000) return "Inu no Kami";
      if (xpEarned >= 1905) return "Shiba Daimyō";
      if (xpEarned >= 945) return "Inugami";
      if (xpEarned >= 465) return "Tenshin Shiba";
      if (xpEarned >= 225) return "Shiba Senshi";
      if (xpEarned >= 105) return "Yamainu";
      if (xpEarned >= 45) return "Inu no Deshi";
      if (xpEarned >= 15) return "Komamori";
      return "Koinu";
    };

    const getLevel = (xpEarned) => {
      if (xpEarned >= 3000) return 9;
      if (xpEarned >= 1905) return 8;
      if (xpEarned >= 945) return 7;
      if (xpEarned >= 465) return 6;
      if (xpEarned >= 225) return 5;
      if (xpEarned >= 105) return 4;
      if (xpEarned >= 45) return 3;
      if (xpEarned >= 15) return 2;
      return 1;
    };

    const getXPToNextLevel = (xpEarned) => {
      if (xpEarned >= 3000) return 0; // Max level
      if (xpEarned >= 1905) return 3000 - xpEarned;
      if (xpEarned >= 945) return 1905 - xpEarned;
      if (xpEarned >= 465) return 945 - xpEarned;
      if (xpEarned >= 225) return 465 - xpEarned;
      if (xpEarned >= 105) return 225 - xpEarned;
      if (xpEarned >= 45) return 105 - xpEarned;
      if (xpEarned >= 15) return 45 - xpEarned;
      return 15 - xpEarned;
    };

    return {
      title: getTitle(xp),
      level: getLevel(xp),
      xpToNext: getXPToNextLevel(xp)
    };
  };

  const levelInfo = calculateLevelAndTitle(userXP);

  // Debug: Track when active game changes
  useEffect(() => {
    // Active game changed
  }, [activeGameId]);

  // Game switching logic - handle start/stop logging when activeGameId changes
  const previousActiveGameRef = useRef(null);
  
  useEffect(() => {
    const previousGame = previousActiveGameRef.current;
    const currentGame = activeGameId;
    
    
    // If there was a previous game and now there's a different game, log stop for previous
    if (previousGame && previousGame !== currentGame) {
      const previousGameRecord = games.find(g => g.id === previousGame);
      
      logGamePlayStop({
        gameId: previousGame,
        gameName: previousGameRecord?.Name || 'Unknown Game',
        gameRecordId: previousGameRecord?.id || previousGame,
        reason: 'switched_to_new_game',
        timestamp: new Date().toISOString()
      });
      
      // Reset the previous game component
      setGameComponentKeys(prev => ({
        ...prev,
        [previousGame]: (prev[previousGame] || 0) + 1
      }));
    }
    
    // If there's a current game, log start for it
    if (currentGame) {
      const gameRecord = games.find(g => g.id === currentGame);
      
      logGamePlayStart({
        gameId: currentGame, // This is now the Airtable record ID
        gameName: gameRecord?.Name || 'Unknown Game',
        gameRecordId: gameRecord?.id || currentGame
      });
    }
    
    // If currentGame is null (game ended), reset the previous game
    if (!currentGame && previousGame) {
      setGameComponentKeys(prev => ({
        ...prev,
        [previousGame]: (prev[previousGame] || 0) + 1
      }));
    }
    
    // Update the ref
    previousActiveGameRef.current = currentGame;
  }, [activeGameId, logGamePlayStart, logGamePlayStop, games]);




  // Handle Slack OAuth code from URL parameters
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      if (code) {
        setSlackCode(code);
        // Clean up the URL
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }, []);

  // System theme detection
  useEffect(() => {
    const checkSystemTheme = () => {
      if (typeof window !== 'undefined') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDarkMode(prefersDark);
      }
    };

    checkSystemTheme();

    // Listen for system theme changes
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => setIsDarkMode(e.matches);
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  // Theme colors
  const theme = {
    background: isDarkMode ? '#1e1f22' : 'white',
    surface: isDarkMode ? '#313338' : 'white',
    text: isDarkMode ? '#ffffff' : 'black',
    textSecondary: isDarkMode ? '#b9bbbe' : '#666666',
    border: isDarkMode ? '#40444b' : '#e0e0e0',
    accent: '#F5994B', // Keep the orange accent color
    buttonSecondary: isDarkMode ? '#313338' : 'white',
    cardBackground: isDarkMode ? '#313338' : 'white',
    creatorTagBackground: isDarkMode ? 'rgba(49, 51, 56, 0.9)' : 'rgba(255, 255, 255, 0.9)',
  };

  // Fetch games client-side if not provided via props
  useEffect(() => {

    // Only fetch if we don't have games from props
    if (!initialGames || initialGames.length === 0) {
      let cancelled = false;
      const fetchGames = async () => {
        try {
          setGamesLoading(true);
          setGamesError(null);
          const res = await fetch('/api/GetAllGames?build=true&full=true');
          const data = await res.json().catch(() => []);
          if (!cancelled) {
            setGames(Array.isArray(data) ? data : []);
          }
        } catch (e) {
          console.error('🎮 Client-side games fetch failed:', e);
          if (!cancelled) setGamesError('Failed to load games');
        } finally {
          if (!cancelled) setGamesLoading(false);
        }
      };
      fetchGames();
      return () => {
        cancelled = true;
      };
    } else {
      // If we have games from props, use them and stop loading immediately
      setGames(initialGames);
      setGamesLoading(false);
      setGamesError(null);
    }
  }, [initialGames, initialGamesError]);

  // Fetch Slack profile when user has token
  useEffect(() => {
    if (!token || !mountedRef.current) {
      setSlackProfile(null);
      return;
    }

    let cancelled = false;
    const fetchSlackProfile = async () => {
      // Add small delay to ensure games render first
      await new Promise(resolve => setTimeout(resolve, 100));
      
      try {
        const res = await fetch('/api/getMySlackProfile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data.slackId) {
          setSlackProfile({
            displayName: data.displayName || '',
            image: data.image || '',
            slackId: data.slackId || ''
          });
          // Set the user's XP from the API response
          setUserXP(data.xpEarned || 0);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Failed to fetch Slack profile:', e);
          setSlackProfile(null);
        }
      }
    };
    
    fetchSlackProfile();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Handle Slack OAuth code processing
  useEffect(() => {
    if (!slackCode || !mountedRef.current) return;

    let cancelled = false;
    const processSlackCode = async () => {
      try {
        const res = await fetch('/api/slackLogin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: slackCode }),
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.token) {
          // Store token in localStorage
          localStorage.setItem('token', data.token);
          // Trigger a page refresh to pick up the new token
          window.location.reload();
        } else if (!cancelled) {
          console.error('Failed to process Slack code:', data.message || 'Unknown error');
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Error processing Slack code:', e);
        }
      }
    };
    
    processSlackCode();
    return () => {
      cancelled = true;
    };
  }, [slackCode]);

  // Fetch posts using the new preload API
  useEffect(() => {
    let cancelled = false;
    const fetchPosts = async () => {
      try {
        setPostsLoading(true);
        setPostsError('');
        const res = await fetch('/api/GetAllPostsPreload?limit=100');
        const data = await res.json().catch(() => []);
        if (!cancelled) {
          const normalized = Array.isArray(data)
            ? data.map((p) => ({
                createdAt: p['Created At'] || p.createdAt || '',
                PlayLink: typeof p.PlayLink === 'string' ? p.PlayLink : '',
                attachments: Array.isArray(p.Attachements) ? p.Attachements : [],
                slackId: p['slack id'] || '',
                gameName: p['Game Name'] || '',
                content: p.Content || '',
                postId: p.PostID || '',
                gameThumbnail: p.GameThumbnail || '',
                badges: Array.isArray(p.Badges) ? p.Badges : [],
                postType: p.postType || 'devlog',
                timelapseVideoId: p.timelapseVideoId || '',
                githubImageLink: p.githubImageLink || '',
                timeScreenshotId: p.timeScreenshotId || '',
                hoursSpent: p.hoursSpent || 0,
                minutesSpent: p.minutesSpent || 0,
                timeSpentOnAsset: p.timeSpentOnAsset || 0,
                posterShomatoSeeds: p.posterShomatoSeeds || 0,
              }))
            : [];
          setPosts(normalized);
          setHasMore(normalized.length >= 12);
        }
      } catch (e) {
        if (!cancelled) setPostsError('Failed to load posts');
      } finally {
        if (!cancelled) setPostsLoading(false);
      }
    };
    fetchPosts();
    return () => {
      cancelled = true;
    };
  }, []);


  const loadMore = () => {
    const newCount = displayCount + 12;
    setDisplayCount(newCount);
    setHasMore(newCount < posts.length);
    
    // Log specific activity for loading more content
    logSpecificActivity('load_more_posts', {
      newDisplayCount: newCount,
      totalPosts: posts.length
    });
  };

  // Handle successful signup
  const handleSignupSuccess = (newToken) => {
    setToken?.(newToken);
    localStorage.setItem('token', newToken);
    // Refresh the page to pick up the new token
    window.location.reload();
  };

  // Handle successful login
  const handleLoginSuccess = (newToken) => {
    setToken?.(newToken);
    localStorage.setItem('token', newToken);
    // Refresh the page to pick up the new token
    window.location.reload();
  };

  return (
    <div
      style={{
        backgroundColor: theme.background,
        width: "100vw",
        minHeight: "100vh",
        minWidth: "100vw",
        fontSize: "19.2px",
        color: theme.text,
      }}
    >
      <div
        style={{
          width: "100vw",
          minHeight: "100vh",
          minWidth: "100vw",
          position: "relative",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          backgroundColor: theme.background,
        }}
      >
        {/* Tokyo Arcade Banner */}
        <div 
          onClick={() => {
            if (token) {
              onEnterArcade?.();
            } else {
              onLoginClick();
            }
            logSpecificActivity('tokyo_arcade_banner_click', {
              action: token ? 'already_logged_in' : 'triggered_login'
            });
          }}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 11,
            backgroundColor: "#F5994B",
            color: "white",
            padding: "12px 20px",
            textAlign: "center",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "600",
            transition: "background-color 0.2s ease"
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "#e8853a";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "#F5994B";
          }}
        >
          We're opening an Arcade in Tokyo, <span style={{ textDecoration: "underline" }}>Check It Out</span>
        </div>

        {/* Top Bar - Fixed Position */}
        <div className="top-bar" style={{
          position: "fixed",
          top: "40px", // Positioned right below the banner (no gap)
          left: 0,
          right: 0,
          zIndex: 10,
          backgroundColor: theme.surface,
          padding: "16px 20px",
          borderBottom: `1px solid ${theme.border}`
        }}>
          <div style={{width: "100%", display: "flex", maxWidth: "1000px", margin: "0 auto"}}>
            <div style={{display: "flex", flexDirection: "row", alignItems: "center", width: "100%"}}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                <img 
                  src="/SpeedyShibaShipper.png" 
                  alt="Speedy Shiba Shipper" 
                  style={{ width: "32px", height: "32px" }}
                />
                <h1
                  style={{
                    color: theme.text,
                    fontSize: "24px",
                    fontWeight: "bold",
                    margin: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  Shiba Arcade
                </h1>
              </div>
              <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
                <p style={{
                  textAlign: "center", 
                  margin: 0,
                  fontSize: "16px",
                  color: theme.text
                }}>
                  build games, get feedback, & form friendships
                </p>
              </div>
              <div style={{display: "flex", flexDirection: "row", alignItems: "center", gap: "16px", flexShrink: 0}}>
                {/* Activity indicator (for development/debugging) */}
                {token ? (
                  <>
                    <button 
                      onClick={() => setShowUploadModal(true)}
                      style={{
                        padding: "8px 12px",
                        border: `1px solid ${theme.border}`,
                        borderRadius: "4px",
                        backgroundColor: theme.surface,
                        color: theme.text,
                        cursor: "pointer",
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}
                      title="Create Post"
                    >
                      <img 
                        src="/upload.svg" 
                        alt="Upload" 
                        style={{ width: "16px", height: "16px" }}
                      />
                      Post
                    </button>
                    <button 
                      onClick={onEnterArcade}
                      style={{
                        padding: "8px 16px",
                        border: `1px solid ${theme.border}`,
                        borderRadius: "4px",
                        backgroundColor: theme.accent,
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "14px"
                      }}
                    >
                      Visit Arcade
                    </button>
                    {/* Profile Picture with Dropdown */}
                    {slackProfile?.image && (
                      <div 
                        ref={profileDropdownRef}
                        style={{ position: "relative" }}
                      >
                        <div
                          onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 4,
                            border: `1px solid ${theme.border}`,
                            backgroundColor: theme.surface,
                            backgroundImage: `url(${slackProfile.image})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            backgroundRepeat: "no-repeat",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <img
                            src={slackProfile.image}
                            alt={slackProfile.displayName || "Profile"}
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 3 }}
                          />
                        </div>
                        
                        {/* Dropdown Menu */}
                        {showProfileDropdown && (
                          <div
                            style={{
                              position: "absolute",
                              top: "40px",
                              right: 0,
                              backgroundColor: theme.surface,
                              border: `1px solid ${theme.border}`,
                              borderRadius: "8px",
                              boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                              minWidth: "200px",
                              zIndex: 1000,
                              overflow: "hidden"
                            }}
                          >
                            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${theme.border}` }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                {/* Current Level */}
                                <div style={{ fontSize: "12px", color: theme.textSecondary }}>
                                  <p style={{ margin: "0 0 6px 0" }}>
                                    <span style={{ opacity: 0.6 }}>Current Level: </span>
                                    <span style={{ color: theme.text, opacity: 1 }}>{levelInfo.title}</span>
                                  </p>
                                </div>
                                
                                {/* XP Display */}
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <img 
                                    src="/xpOrb.gif" 
                                    alt="XP Orb" 
                                    style={{ 
                                      width: "16px", 
                                      height: "16px", 
                                      imageRendering: "pixelated"
                                    }} 
                                  />
                                  <p style={{ margin: 0, fontSize: "14px", color: theme.text, fontWeight: "bold" }}>
                                    {userXP}
                                  </p>
                                </div>
                                
                                {/* Additional Info */}
                                <div style={{ fontSize: "12px", color: theme.textSecondary }}>
                                  <p style={{ margin: "2px 0" }}>
                                    {levelInfo.xpToNext > 0 ? `XP to next level: ${levelInfo.xpToNext}` : "Max Level!"}
                                  </p>
                                  <p style={{ margin: "4px 0 0 0", fontSize: "10px", fontStyle: "italic", opacity: 0.5 }}>
                                    Every hour you spend, you'll gain 15 XP
                                  </p>
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                // Clear token and reload
                                localStorage.removeItem('token');
                                setToken?.(null);
                                window.location.reload();
                              }}
                              style={{
                                width: "100%",
                                padding: "12px 16px",
                                border: "none",
                                backgroundColor: "transparent",
                                color: theme.text,
                                fontSize: "14px",
                                textAlign: "left",
                                cursor: "pointer",
                                transition: "background-color 0.2s ease"
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = isDarkMode ? "#40444b" : "#f5f5f5";
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = "transparent";
                              }}
                            >
                              Logout
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => setShowSignupModal(true)}
                      style={{
                        padding: "8px 16px",
                        border: `1px solid ${theme.accent}`,
                        borderRadius: "4px",
                        backgroundColor: theme.buttonSecondary,
                        color: theme.accent,
                        cursor: "pointer",
                        fontSize: "14px"
                      }}
                    >
                      Signup
                    </button>
                    <button 
                      onClick={() => setShowLoginModal(true)}
                      style={{
                        padding: "8px 16px",
                        border: `1px solid ${theme.border}`,
                        borderRadius: "4px",
                        backgroundColor: theme.accent,
                        color: "#fff",
                        cursor: "pointer",
                        fontSize: "14px"
                      }}
                    >
                      Login
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content with padding to offset top bar and banner */}
        <div
          style={{
            minHeight: "100vh",
            minWidth: "100vw",
            padding: "148px 8vw 40px", // Increased from 100px to 148px to account for banner (48px) + top bar
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            width: "100%",
            overflow: "visible",
          }}
        >
          <div style={{
            width: "100%",
            maxWidth: "1000px",
            marginTop: "-16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "0px"
          }}>
                       <div style={{
             width: "100%",
             maxWidth: "1000px",
             display: "flex",
             flexDirection: "row",
             justifyContent: "center",
             gap: "20px"
            }}>
              <button 
                onClick={() => {
                  setActiveTab("Games");
                  logSpecificActivity('tab_switch', { 
                    fromTab: activeTab, 
                    toTab: "Games",
                    gamesCount: games.length
                  });
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: activeTab === "Games" ? theme.accent : theme.text,
                  fontSize: "16px",
                  margin: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  fontWeight: activeTab === "Games" ? "bold" : "normal",
                  textDecoration: activeTab === "Games" ? "underline" : "none",
                  textUnderlineOffset: "4px"
                }}
              >
                Games
              </button>
              <button 
                onClick={() => {
                  setActiveTab("Posts");
                  logSpecificActivity('tab_switch', { 
                    fromTab: activeTab, 
                    toTab: "Posts",
                    postsCount: posts.length
                  });
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: activeTab === "Posts" ? theme.accent : theme.text,
                  fontSize: "16px",
                  margin: 0,
                  textAlign: "left",
                  cursor: "pointer",
                  fontWeight: activeTab === "Posts" ? "bold" : "normal",
                  textDecoration: activeTab === "Posts" ? "underline" : "none",
                  textUnderlineOffset: "4px"
                }}
              >
                Posts
              </button>
</div>
            {/* Content Display */}
            {activeTab === "Posts" && (
              <>
                {postsLoading ? (
                  <p style={{ color: theme.text, textAlign: "center", marginTop: "20px" }}>
                    Loading posts...
                  </p>
                ) : postsError ? (
                  <p style={{ color: "#f04747", textAlign: "center", marginTop: "20px" }}>
                    {postsError}
                  </p>
                ) : (
                  <div
                    className="posts-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "16px",
                      marginTop: "20px",
                      width: "100%",
                    }}
                  >
                    {posts.slice(0, displayCount).map((p, idx) => (
                      <div
                        key={p.postId || idx}
                        style={{
                          border: `1px solid ${theme.border}`,
                          borderRadius: "10px",
                          background: theme.cardBackground,
                          padding: "12px",
                          position: "relative",
                          width: "100%",
                          minWidth: 0,
                          overflow: "hidden",
                          display: "flex",
                          flexDirection: "column",
                        }}
                      >
                        <div style={{ 
                          width: "100%", 
                          minWidth: 0, 
                          overflow: "hidden",
                          flex: 1,
                          display: "flex",
                          flexDirection: "column"
                        }}>
                          <PostAttachmentRenderer
                            content={p.content}
                            attachments={p.attachments}
                            playLink={p.PlayLink}
                            gameName={p.gameName}
                            thumbnailUrl={p.gameThumbnail || ''}
                            slackId={p.slackId}
                            createdAt={p.createdAt}
                            token={token}
                            badges={p.badges}
                            gamePageUrl={`https://shiba.hackclub.com/games/${p.slackId}/${encodeURIComponent(p.gameName || '')}`}
                            gitChanges={p.GitChanges}
                            onPlayCreated={(play) => {
                              // Play created by playGameComponent.js
                              console.log('Play created:', play);
                            }}
                            onGameStart={() => {
                              // Extract gameId from playLink for Posts
                              let postGameId = '';
                              if (p.PlayLink) {
                                try {
                                  const path = p.PlayLink.startsWith('http') ? new URL(p.PlayLink).pathname : p.PlayLink;
                                  const m = /\/play\/([^\/?#]+)/.exec(path);
                                  postGameId = m && m[1] ? decodeURIComponent(m[1]) : '';
                                } catch (_) {
                                  postGameId = '';
                                }
                              }
                              
                              // Find the game record to get the Airtable ID
                              const gameRecord = games.find(g => {
                                const playableURL = Array.isArray(g.playableURL) ? g.playableURL[0] : g.playableURL || '';
                                if (playableURL) {
                                  try {
                                    const path = playableURL.startsWith('http') ? new URL(playableURL).pathname : playableURL;
                                    const m = /\/play\/([^\/?#]+)/.exec(path);
                                    const extractedGameId = m && m[1] ? decodeURIComponent(m[1]) : '';
                                    return extractedGameId === postGameId;
                                  } catch (_) {
                                    return false;
                                  }
                                }
                                return false;
                              });
                              
                              
                              // Set the active game to the Airtable record ID
                              setActiveGameId(gameRecord?.id || postGameId);
                            }}
                            onGameEnd={(gameData) => {
                              // Reset active game (no logging)
                              setActiveGameId(null);
                            }}
                            activeGameId={activeGameId}
                            postType={p.postType}
                            timelapseVideoId={p.timelapseVideoId}
                            githubImageLink={p.githubImageLink}
                            timeScreenshotId={p.timeScreenshotId}
                            hoursSpent={p.hoursSpent}
                            timeSpentOnAsset={p.timeSpentOnAsset}
                            minutesSpent={p.minutesSpent}
                            postId={p.postId}
                            compact={true}
                            isFromMainPage={true}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Load More Button */}
                {hasMore && (
                  <div style={{ textAlign: "center", marginTop: "20px" }}>
                    <button
                      onClick={loadMore}
                      style={{
                        padding: "12px 24px",
                        backgroundColor: "#F5994B",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "600",
                      }}
                    >
                      Load More
                    </button>
                  </div>
                )}
              </>
            )}
            
            {activeTab === "Games" && (
              <>
                {gamesLoading ? (
                  <p style={{ color: theme.text, textAlign: "center", marginTop: "20px" }}>
                    Loading games...
                  </p>
                ) : gamesError ? (
                  <p style={{ color: "#f04747", textAlign: "center", marginTop: "20px" }}>
                    {gamesError}
                  </p>
                ) : (
                  <>
                  <div
                    style={{
                      textAlign: "center",
                      marginTop: "20px",
                      width: "100%",
                      padding: "12px 16px",
                      borderRadius: "8px",
                      backgroundColor: "rgba(245, 153, 75, 0.15)",
                      border: "1px solid rgba(245, 153, 75, 0.4)",
                      color: theme.text,
                    }}
                  >
                    The games are currently broken, but you can see more about Shiba {" "}
                    <a href="https://www.youtube.com/watch?v=kkbf092Los0" style={{ color: theme.accent, fontWeight: "bold" }}>
                      in this video
                    </a>
                  </div>
                  <div
                    className="games-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "16px",
                      marginTop: "20px",
                      width: "100%",
                    }}
                  >
                    {games && games.length > 0 ? games
                      .sort((a, b) => {
                        const aStamped = stampedGames.has(a.id);
                        const bStamped = stampedGames.has(b.id);
                        // Stamped games first (true comes before false)
                        if (aStamped && !bStamped) return -1;
                        if (!aStamped && bStamped) return 1;
                        return 0; // Keep original order for same stamp status
                      })
                      .map((game, idx) => {
                      
                      // Use the game data directly - now we have playableURL from the full API response
                      const slackId = game['slack id'] || game.slackId || '';
                      const gameName = game.Name || game.name || '';
                      
                      // Handle playableURL array like the individual game page does
                      const playableURL = Array.isArray(game.playableURL) ? game.playableURL[0] : game.playableURL || '';
                      
                      // Extract gameId from the playableURL like the individual game page does
                      let gameId = '';
                      try {
                        if (playableURL) {
                          const path = playableURL.startsWith('http') ? new URL(playableURL).pathname : playableURL;
                          const m = /\/play\/([^\/?#]+)/.exec(path);
                          gameId = m && m[1] ? decodeURIComponent(m[1]) : '';
                        }
                      } catch (_) {
                        gameId = '';
                      }
                      

                      return (
                        <div
                          key={game.id || idx}
                          data-game-id={gameId}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "12px",
                            position: "relative",
                            border: stampedGames.has(game.id) ? "3px solid #730000" : "3px solid transparent",
                            borderRadius: "12px",
                            transition: "border 0.3s ease"
                          }}
                        >

                          {/* Play Game Component */}
                          <div 
                            style={{ width: "100%" }}
                            onMouseEnter={() => {
                              // Preload the game URL when user hovers
                              if (playableURL && typeof window !== 'undefined') {
                                const link = document.createElement('link');
                                link.rel = 'prefetch';
                                link.href = playableURL;
                                document.head.appendChild(link);
                              }
                            }}
                            onClick={() => {
                            }}
                          >
                            {gameId ? (
                              <PlayGameComponent
                                key={`${game.id}-${gameComponentKeys[game.id] || 0}`}
                                gameId={gameId}
                                gameName={gameName}
                                thumbnailUrl={game.thumbnailUrl || ''}
                                animatedBackground={game.animatedBackground || ''}
                                token={token}
                                activeGameId={activeGameId}
                                onPlayCreated={(play) => {
                                  // Play created by playGameComponent.js
                                  console.log('Play created:', play);
                                }}
                                onGameStart={() => {
                                  // Find the game record to get the Airtable ID
                                  const gameRecord = games.find(g => {
                                    const playableURL = Array.isArray(g.playableURL) ? g.playableURL[0] : g.playableURL || '';
                                    if (playableURL) {
                                      try {
                                        const path = playableURL.startsWith('http') ? new URL(playableURL).pathname : playableURL;
                                        const m = /\/play\/([^\/?#]+)/.exec(path);
                                        const extractedGameId = m && m[1] ? decodeURIComponent(m[1]) : '';
                                        return extractedGameId === gameId;
                                      } catch (_) {
                                        return false;
                                      }
                                    }
                                    return false;
                                  });
                                  
                                  
                                  // Set the active game to the Airtable record ID
                                  setActiveGameId(gameRecord?.id || gameId);
                                  
                                  
                                  // Hide creator tag when game starts
                                  const creatorTag = document.querySelector(`[data-game-id="${gameId}"] .creator-tag`);
                                  if (creatorTag) {
                                    creatorTag.style.opacity = "0";
                                    creatorTag.style.pointerEvents = "none";
                                  }
                                  
                                  // Trigger fullscreen when game starts
                                  setTimeout(() => {
                                    const iframe = document.querySelector(`iframe[title="Play ${gameId}"]`);
                                    if (iframe && iframe.requestFullscreen) {
                                      iframe.requestFullscreen().catch((err) => {
                                      });
                                    }
                                  }, 200); // Reduced from 500ms to 200ms
                                }}
                                onGameEnd={(gameData) => {
                                  // Reset active game (no logging)
                                  setActiveGameId(null);
                                }}
                                gamePageUrl={playableURL}
                                compact={true}
                                isFromMainPage={true}
                              />
                            ) : (
                              <div style={{ 
                                padding: "10px", 
                                backgroundColor: theme.surface, 
                                borderRadius: "8px",
                                textAlign: "center",
                                fontSize: "12px",
                                color: theme.textSecondary
                              }}>
                                No playable game found
                                <br />
                                <small>GameId: {gameId || 'None'}, PlayableURL: {playableURL || 'None'}</small>
                              </div>
                            )}
                          </div>
                          
                          {/* See Journey Section */}
                          <div
                            className="see-journey-container"
                            onClick={(e) => {
                              e.stopPropagation();
                              const url = `https://shiba.hackclub.dev/games/${slackId}/${encodeURIComponent(gameName || '')}`;
                              window.open(url, '_blank', 'noopener,noreferrer');
                              logSpecificActivity('see_journey_click', {
                                gameId: game.id,
                                gameName: gameName,
                                slackId: slackId,
                                url: url
                              });
                            }}
                            style={{
                              width: "100%",
                              border: "1px solid #000",
                              borderTop: "none",
                              padding: "0px",
                              marginTop: "-24px", 
                              opacity: 0.1,
                              zIndex: 0,
                              textAlign: "center",
                              borderRadius: "0px 0px 12px 12px",
                              transition: "opacity 0.2s",
                              cursor: "pointer"
                            }}
                          >
                            <p
                              className="see-journey-text"
                              style={{
                                margin: 0,
                                fontSize: "10px",
                                textDecoration: "none",
                                marginTop: "16px",
                                marginBottom: "6px",
                                color: theme.text,
                                transition: "text-decoration 0.15s, opacity 0.2s"
                              }}
                            >
                              See Journey
                            </p>
                             <style>{`
                               .see-journey-container:hover {
                                 opacity: 0.7 !important;
                                 cursor: pointer !important;
                               }
                               .see-journey-container:hover .see-journey-text {
                                 text-decoration: underline !important;
                               }
                               @media (max-width: 768px) {
                                 .see-journey-container {
                                   opacity: 0.7 !important;
                                 }
                                 .see-journey-text {
                                   text-decoration: underline !important;
                                 }
                               }
                             `}</style>
                          </div>
                          
                          {/* Creator Info */}
                          {game.creatorDisplayName && (
                            <div 
                              onClick={() => {
                                logSpecificActivity('creator_profile_click', {
                                  creatorSlackId: slackId,
                                  creatorDisplayName: game.creatorDisplayName,
                                  gameName: gameName
                                });
                                window.open(`https://hackclub.slack.com/team/${slackId}`, '_blank');
                              }}
                              style={{
                                position: "absolute",
                                top: "8px",
                                left: "8px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                fontSize: "0.8rem",
                                color: theme.textSecondary,
                                backgroundColor: theme.creatorTagBackground,
                                padding: "3px 6px",
                                borderRadius: "4px",
                                border: `1px solid ${theme.border}`,
                                zIndex: 2,
                                cursor: "pointer",
                                transition: "opacity 0.3s ease"
                              }}
                              className="creator-tag"
                            >
                              <div
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: 4,
                                  border: `1px solid ${theme.border}`,
                                  backgroundSize: "cover",
                                  backgroundPosition: "center",
                                  backgroundColor: theme.surface,
                                  backgroundImage: game.creatorImage ? `url(${game.creatorImage})` : "none",
                                }}
                              />
                              <span style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "80px"
                              }}>
                                {game.creatorDisplayName}
                              </span>
                            </div>
                          )}

                          {/* Chat Bubble Button */}
                          <div
                            className="chat-bubble-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              
                              // Check if user is logged in
                              if (!token) {
                                alert("Please login to give feedback");
                                return;
                              }
                              
                              setSelectedMessageProject(game.id);
                            }}
                            onMouseEnter={(e) => {
                              const img = e.currentTarget.querySelector('.chat-bubble-image');
                              if (img) img.src = "/chatBubble.svg";
                            }}
                            onMouseLeave={(e) => {
                              const img = e.currentTarget.querySelector('.chat-bubble-image');
                              if (img) img.src = "/chatBubbleInactive.svg";
                            }}
                            style={{
                              position: "absolute",
                              top: "8px",
                              right: "48px",
                              width: "32px",
                              height: "32px",
                              cursor: "pointer",
                              zIndex: 3,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "white",
                              border: "1px solid #e0e0e0",
                              borderRadius: "4px",
                              padding: "2px"
                            }}
                          >
                            <img
                              className="chat-bubble-image"
                              src="/chatBubbleInactive.svg"
                              alt="Shiba Chat"
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                opacity: 0.7
                              }}
                            />
                          </div>

                          {/* Stamp Button */}
                          <div
                            className="stamp-button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              
                              // Check if user is logged in
                              if (!token) {
                                alert("Please login to \"Paw\" a game");
                                return;
                              }
                              
                              const gameRecordId = game.id;
                              const isCurrentlyStamped = stampedGames.has(gameRecordId);
                              
                              // Call the appropriate API
                              const apiEndpoint = isCurrentlyStamped ? '/api/UnpawProject' : '/api/PawProject';
                              const apiData = { token, gameId: gameRecordId };
                              
                              try {
                                const response = await fetch(apiEndpoint, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(apiData)
                                });
                                
                                const result = await response.json();
                                
                                if (response.ok && result.ok) {
                                  // Update local state only if API call succeeded
                                  setStampedGames(prev => {
                                    const newSet = new Set(prev);
                                    if (isCurrentlyStamped) {
                                      newSet.delete(gameRecordId);
                                    } else {
                                      newSet.add(gameRecordId);
                                    }
                                    return newSet;
                                  });
                                  
                                  logSpecificActivity('game_stamp_toggle', {
                                    gameId: gameRecordId,
                                    gameName: gameName,
                                    action: isCurrentlyStamped ? 'unstamp' : 'stamp',
                                    apiSuccess: true
                                  });
                                } else {
                                  console.error('API error:', result.message);
                                  alert(`Failed to ${isCurrentlyStamped ? 'unpaw' : 'paw'} game: ${result.message || 'Unknown error'}`);
                                }
                              } catch (error) {
                                console.error('Network error:', error);
                                alert(`Failed to ${isCurrentlyStamped ? 'unpaw' : 'paw'} game: Network error`);
                              }
                            }}
                            style={{
                              position: "absolute",
                              top: "8px",
                              right: "8px",
                              width: "32px",
                              height: "32px",
                              cursor: "pointer",
                              zIndex: 3,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center"
                            }}
                          >
                            <img
                              className="stamp-image"
                              src={stampedGames.has(game.id) ? "/stamped.svg" : "/stamp.svg"}
                              alt={stampedGames.has(game.id) ? "Stamped" : "Stamp"}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "contain",
                                opacity: stampedGames.has(game.id) ? 1 : 0.7
                              }}
                            />
                          </div>
                        </div>
                      );
                    }) : (
                      <div style={{ 
                        gridColumn: "1 / -1", 
                        textAlign: "center", 
                        padding: "40px 20px",
                        color: theme.textSecondary
                      }}>
                        No games available
                      </div>
                    )}
                  </div>
                  </>
                )}
              </>
            )}
            
          </div>
        </div>
      </div>

      {/* Signup Modal */}
      {showSignupModal && (
        <SignupModal
          onClose={() => setShowSignupModal(false)}
          onSignupSuccess={handleSignupSuccess}
          requestOtp={requestOtp}
          verifyOtp={verifyOtp}
          theme={theme}
        />
      )}

      {/* Login Modal */}
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={handleLoginSuccess}
          requestOtp={requestOtp}
          verifyOtp={verifyOtp}
          theme={theme}
        />
      )}

      {/* Feedback Modal */}
      {selectedMessageProject && (
        <FeedbackModal
          gameId={selectedMessageProject}
          game={games.find(g => g.id === selectedMessageProject)}
          onClose={() => setSelectedMessageProject(null)}
          token={token}
          slackProfile={{
            displayName: games.find(g => g.id === selectedMessageProject)?.creatorDisplayName || 'User',
            image: games.find(g => g.id === selectedMessageProject)?.creatorImage || '',
            slackId: games.find(g => g.id === selectedMessageProject)?.['slack id'] || ''
          }}
        />
      )}
      
      <style jsx>{`
        .game-thumbnail-disc {
          transform: rotate(0.05deg);
          transition: transform 0.6s ease-out;
        }
        
        .game-thumbnail-disc:hover {
          transform: rotate(360.05deg);
          transition: transform 4s linear;
        }
        
        /* Hide creator tags when game is in fullscreen */
        :global(.creator-tag) {
          transition: opacity 0.3s ease;
        }
        
        :global([data-fullscreen="true"]) .creator-tag {
          opacity: 0;
          pointer-events: none;
        }
        
        /* Hide creator tags when iframe is visible (game started) */
        :global(iframe[title*="Play"]) {
          position: relative;
        }
        
        :global(iframe[title*="Play"]:not([style*="display: none"])) ~ .creator-tag {
          opacity: 0;
          pointer-events: none;
        }
        
        /* Chat bubble button animations */
        .chat-bubble-button {
          transition: transform 0.1s ease;
        }
        
        .chat-bubble-button:active {
          transform: scale(0.9);
        }
        
        .chat-bubble-image {
          transition: opacity 0.3s ease;
        }

        /* Stamp button animations */
        .stamp-button {
          transition: transform 0.1s ease;
        }
        
        .stamp-button:active {
          transform: scale(0.9);
        }
        
        .stamp-image {
          transition: opacity 0.3s ease;
        }
        
        /* Responsive grid layouts */
        @media (max-width: 1024px) {
          .posts-grid, .games-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 1.5rem !important;
          }
        }
        
        @media (max-width: 768px) {
          .posts-grid, .games-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 1rem !important;
          }
          
          .top-bar {
            padding: 12px 16px !important;
          }
          
          .top-bar h1 {
            font-size: 20px !important;
          }
          
          .top-bar p {
            font-size: 14px !important;
          }
          
          .top-bar button {
            padding: 6px 12px !important;
            font-size: 12px !important;
          }
          
          /* Tokyo banner responsive */
          :global([style*="position: fixed"][style*="top: 0"][style*="zIndex: 11"]) {
            font-size: 12px !important;
            padding: 10px 16px !important;
          }
        }
        
        @media (max-width: 480px) {
          .posts-grid, .games-grid {
            grid-template-columns: 1fr !important;
            gap: 1rem !important;
          }
          
          .top-bar {
            padding: 8px 12px !important;
          }
          
          .top-bar h1 {
            font-size: 18px !important;
          }
          
          .top-bar p {
            display: none !important;
          }
          
          .top-bar button {
            padding: 4px 8px !important;
            font-size: 11px !important;
          }
          
          /* Tokyo banner responsive for small screens */
          :global([style*="position: fixed"][style*="top: 0"][style*="zIndex: 11"]) {
            font-size: 11px !important;
            padding: 8px 12px !important;
          }
        }
      `}</style>
      
      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        token={token}
        profile={profile}
        onPostCreated={() => {
          // Refresh posts when a new post is created
          setDisplayCount(12);
          setPosts([]);
          setPostsLoading(true);
          setPostsError('');
          setHasMore(true);
        }}
      />
    </div>
  );
}
