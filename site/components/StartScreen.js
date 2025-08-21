import { useState, useRef, useEffect } from "react";
import { MovingBackground } from "./HomeScreen";
import { formatJamCountdown } from "./jamConfig";
import { FiLogIn } from "react-icons/fi";
import { useSearchParams } from "next/navigation";

export default function StartScreen({ setToken, requestOtp, verifyOtp }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState("email"); // whether user is inputting email or otp
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [clickedIn, setClickedIn] = useState(false);
  const circleRef = useRef(null);
  const emailInputRef = useRef(null);
  // Start with empty string to avoid SSR/client mismatch, populate after mount.
  const [jamCountdownText, setJamCountdownText] = useState("");
  const mountedRef = useRef(false);

  // Live dual-phase countdown update after mount only (prevents hydration mismatch)
  useEffect(() => {
    mountedRef.current = true;
    const update = () => setJamCountdownText(formatJamCountdown());
    update(); // initial client render
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const sentby = searchParams.get("sentby");

  // Track referral code visits
  useEffect(() => {
    if (sentby && sentby.trim() !== '') {
      // Track referral code visit with Plausible
      if (window.plausible) {
        window.plausible('Referral Code Visit', {
          props: {
            referralCode: sentby.trim(),
            source: 'url-parameter'
          }
        });
      }
      console.log(`User visited with referral code: ${sentby.trim()}`);
    }
  }, [sentby]);

  useEffect(() => {
    if (code) {
      console.log("Authorization code:", code);
      // Make a request to /api/newLogin with the code to get the token
      const fetchToken = async () => {
        try {
          const res = await fetch("/api/slackLogin", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          const data = await res.json();
          if (res.ok && data?.token) {
            setToken(data.token);
            // Set the token in localstorage too
            localStorage.setItem("token", data.token);
          } else {
            console.error(
              "Failed to get token:",
              data.message || "Unknown error",
            );
          }
        } catch (error) {
          console.error("Error fetching token:", error);
        }
      };
      fetchToken();
    }
  }, [code]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (circleRef.current) {
        const faqArea = document.querySelector(".faq-area");
        if (faqArea) {
          const faqRect = faqArea.getBoundingClientRect();

          const x = e.clientX - faqRect.left;
          const y = e.clientY - faqRect.top;

          if (x >= 0 && x <= faqRect.width && y >= 0 && y <= faqRect.height) {
            circleRef.current.style.display = "block";
            circleRef.current.style.left = `${x}px`;
            circleRef.current.style.top = `${y}px`;
          } else {
            circleRef.current.style.display = "none";
          }
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (stage === "email" && emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, [stage]);

  // Focus on email input when component first loads
  useEffect(() => {
    if (emailInputRef.current) {
      emailInputRef.current.focus();
    }
  }, []);

  const onRequest = async () => {
    console.log("onRequest called, email:", email, "requestOtp:", !!requestOtp);
    if (!requestOtp) {
      console.log("requestOtp not available");
      return;
    }
    setLoading(true);
    setMessage("");
    const result = await requestOtp(email, sentby);
    if (result?.ok) {
      setStage("otp");
      setMessage("Code sent. Check your email.");
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
      setToken?.(result.token);
      // alert("Verification successful! Welcome to Shiba Arcade!");
    } else {
      // If verification fails, automatically request a new OTP
      alert("Verification failed. A new code has been sent to your email.");
      setOtp(""); // Clear the OTP input
      if (requestOtp) {
        const newOtpResult = await requestOtp(email);
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

  return (
    <div className="start-screen">
      {/* we will add in later, but people will get confused.  */}
      {/* <div style={{ position: "absolute", top: 0, right: 0, zIndex: 100 }}>
        <div
          style={{
            margin: "20px",
            borderRadius: "8px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "10px",
          }}
          className="slack-logo"
          onClick={() => {
            window.open(
              "https://slack.com/oauth/v2/authorize?client_id=2210535565.9361842154099&user_scope=users:read,users:read.email&redirect_uri=https://shiba.hackclub.dev",
              "_blank",
            );
          }}
        >
          <FiLogIn
            size={24}
            style={{
              color: "white",
              marginRight: "8px",
            }}
          ></FiLogIn>
          <p
            style={{
              color: "white",
              fontWeight: "bold",
              fontSize: "1.2em",
              fontStyle: "italic",
              margin: 0,
            }}
          >
            Login
          </p>
        </div>
      </div> */}
      <div
        className="opening"
        style={{
          width: "100vw",
          position: "relative",
          backgroundImage: `
            radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.2) 100%),
            linear-gradient(to bottom, transparent, black),
            url('/landing/background.gif')
          `,
          filter: "saturate(1.2)",
          backgroundSize: "contain",
          backgroundPosition: "top",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div
          className="opening-info"
          style={{
            minHeight: "100vh",
            top: "0",
            zIndex: 2,
            padding: "40px 8vw 8vw",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          <p className="top-text japanese black-outline">
            ハッククラブ：ゲームを作って、日本にアーケードを建てよう。
          </p>
          <p className="top-text english black-outline">
            HACK CLUB: make a game, build an arcade in japan.
          </p>
          <img
            src="/landing/shibaarcade_logo.png"
            className="logo"
            style={{
              zIndex: 2,
            }}
          />

          <iframe
            className="opening-video"
            src="https://www.youtube.com/embed/MdnJ_neHE7Q?si=nHBkEvAzlmyh_01_"
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
          ></iframe>

          <div
            className="email-input"
            style={{
              marginTop: "-20px",
            }}
          >
            {stage === "email" ? (
              <>
                <input
                  ref={emailInputRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="orpheus@hackclub.com"
                  onKeyDown={(e) => {
                    console.log("Key pressed:", e.key);
                    if (e.key === "Enter") {
                      console.log("Enter key pressed, calling onRequest");
                      onRequest();
                    }
                  }}
                />
                <button
                  onClick={onRequest}
                  disabled={loading}
                  className="signup-button"
                >
                  {loading ? "Sending..." : "join the jam"}
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit code (email)"
                  inputMode="numeric"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onVerify();
                    }
                  }}
                  maxLength={6}
                />
                <button onClick={onVerify} disabled={loading}>
                  {loading ? "verifying..." : "verify"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="info-screen">
        <div className="info info-1">
          <div className="background">
            <div className="moving-background">
              <MovingBackground />
            </div>
            <div className="info-screen-overlay"></div>
          </div>

          <img
            src="/landing/sparkle.png"
            className="sparkle"
            style={{
              top: "-40%",
              animationDelay: "0s",
            }}
          />

          <img
            src="/landing/sparkle.png"
            className="sparkle"
            style={{
              top: "-50%",
              left: "10%",
              width: "8%",
              animationDelay: "0.3s",
            }}
          />

          <img
            src="/landing/sparkle.png"
            className="sparkle"
            style={{
              top: "-50%",
              right: "0%",
              width: "9%",
              animationDelay: "0.5s",
            }}
          />

          <img
            src="/landing/sparkle.png"
            className="sparkle"
            style={{
              top: "-30%",
              right: "8%",
              width: "6%",
              animationDelay: "0.8s",
            }}
          />

          <div className="content">
            <div className="firetext online">
              <p>online!</p>
            </div>
            <h1>
              MAKE A GAME
              <br />
              for 2 months
            </h1>
            <p>
              create a game in godot, then get feedback on your game to improve
              it. earn SSS based on the feedback — then use SSS to buy a ticket
              to tokyo!
            </p>
          </div>

          <div className="info-1-games">
            <a
              className="game-item"
              href="https://maxwell-mph.itch.io/driftmetal"
              style={{
                top: "0px",
                left: "-12%",
              }}
            >
              <p>drift metal (max, 16)</p>
              <img src="/landing/game_driftmetal.png" />
            </a>

            <a
              className="game-item"
              href="https://firn.itch.io/train-game"
              style={{
                top: "50px",
                left: "15%",
              }}
            >
              <p>do you like trains? (isidore, 16)</p>
              <img src="/landing/game_trains.png" />
            </a>

            <a
              className="game-item"
              href="https://nanomars.itch.io/clicker-game"
              style={{
                top: "180px",
                left: "4%",
              }}
            >
              <p>debug clicker (armand, 17)</p>
              <img src="/landing/game_debugclicker.png" />
            </a>
          </div>
        </div>

        <div className="taiko-divider">
          <img
            src="/landing/sparkle.png"
            className="sparkle"
            style={{
              top: "25%",
              left: "3%",
              width: "8%",
              animationDelay: "0.2s",
            }}
          />

          <img
            src="/landing/sparkle.png"
            className="sparkle"
            style={{
              top: "50%",
              left: "1%",
              width: "6%",
              animationDelay: "0.7s",
            }}
          />

          <img
            src="/landing/sparkle.png"
            className="sparkle"
            style={{
              top: "50%",
              right: "1%",
              width: "6%",
              animationDelay: "0.3s",
            }}
          />

          <img src="/landing/taiko_divider.png"></img>
          <div className="jumpy">
            <div
              className="jumpy-item"
              style={{
                animationDelay: "0s",
              }}
            >
              <img src="/landing/jumpy1.png" />
              <p>GO</p>
            </div>

            <div
              className="jumpy-item"
              style={{
                animationDelay: "0.3s",
              }}
            >
              <img src="/landing/jumpy2.png" />
              <p>TO</p>
            </div>

            <div
              className="jumpy-item"
              style={{
                animationDelay: "0.6s",
              }}
            >
              <img src="/landing/jumpy3.png" />
              <p>TO-</p>
            </div>

            <div
              className="jumpy-item"
              style={{
                animationDelay: "0.9s",
              }}
            >
              <img src="/landing/jumpy4.png" />
              <p>KYO!</p>
            </div>
          </div>
        </div>

        <div className="info info-2">
          <div className="background">
            <div className="moving-background">
              <MovingBackground />
            </div>
          </div>

          <div className="content">
            <div className="firetext flipped inperson">
              <p>in-person!</p>
            </div>
            <h1>
              BUILD AN ARCADE
              <br />
              in tokyo japan
            </h1>
            <p>
              use SSS you earned to win a ticket to japan. fly to tokyo and
              build an arcade with us, food covered, hotel covered, & flight
              stipends available. put your game into the arcade and let the
              public try it!
            </p>
          </div>
        </div>

        <img src="/landing/arcade_divider.png" className="arcade-divider" />

        <div className="faq-area">
          <div className="faq-background"></div>
          <div className="purple-circle" ref={circleRef}></div>
          <div className="faq-gradient-overlay"></div>

          <div className="signup">
            <p className="top-text english">HACK CLUB: sign up now.</p>
            <div className="email-input">
              {stage === "email" ? (
                <>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onRequest();
                      }
                    }}
                    placeholder="orpheus@hackclub.com"
                  />
                  <button
                    onClick={onRequest}
                    disabled={loading}
                    className="signup-button"
                  >
                    {loading ? "Sending..." : "join the jam"}
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit code (email)"
                    inputMode="numeric"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onVerify();
                      }
                    }}
                    maxLength={6}
                  />
                  <button onClick={onVerify} disabled={loading}>
                    {loading ? "Verifying..." : "verify"}
                  </button>
                </>
              )}
            </div>

          </div>

          <div className="faq">
            <div className="shiba-direct">
              <img src="/landing/shiba_direct.png" />
              <p>22 august · 4pm–5pm pacific time (7-8pm eastern)</p>
              <p>get LIVE shiba news and the latest information.</p>
              <p>sign up to rsvp.</p>
            </div>

            <details>
              <summary>can i participate?</summary>
              <p>shiba is for teenagers 18 years old and under!</p>
            </details>

            <details>
              <summary>how long will shiba run for?</summary>
              <p>
                shiba starts on august 18 and ends on october 20. then, we'll
                build an arcade in tokyo from november 5-12th.
              </p>
            </details>

            <details>
              <summary>i don't know how to make games!</summary>
              <p>
                don't worry, beginners are welcome! we will run workshops to
                teach you how to make games in godot. you will also get plenty
                of feedback about your games and get the chance to make multiple
                :)
              </p>
            </details>
          </div>
        </div>
      </div>

      <style jsx>{`
        .start-screen {
          background-color: black;
          width: 100vw;
          height: 100%;
          font-size: 1.2em;
        }

        /* Desktop / default logo width */
        .opening-info .logo {
          width: 60%;
        }

        .opening-info {
          display: flex;
          flex-flow: column;
          align-items: center;
          justify-content: center;
          width: 100%;
          /* Corrected property name (was minheight) and allow growth beyond initial viewport */
          min-height: 100vh;
          /* Ensure scaling children (e.g., hover transforms) aren't clipped */
          overflow: visible;
          padding: 20px;
        }

        .slack-logo {
          background: linear-gradient(to bottom, #2b2b2b, #4c2e19);
          border: 3px solid var(--yellow);
        }

        .top-text {
          color: white;
          font-weight: bold;
        }

        .top-text.japanese {
          color: white;
        }

        .top-text.english {
          color: var(--yellow);
          font-style: italic;
        }

        .opening-video {
          width: 65%;
          aspect-ratio: 16/9;
          border-radius: 32px;
          border: 3px solid var(--yellow);
          margin-top: -35px; /* overridden on mobile for better spacing */
        }

        .sparkle {
          z-index: 10;
          width: 10%;
          position: absolute;
          animation: sparkle-hover 1s infinite alternate ease-in-out;
        }

        @keyframes sparkle-hover {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-15px);
          }
        }

        .black-outline {
          text-shadow:
            -1px 0 0 #000,
            1px 0 0 #000,
            0 -1px 0 #000,
            0 1px 0 #000;
        }

        .email-input {
          border: 3px solid var(--yellow);
          border-radius: 24px;
          padding: 15px;
          width: 45%;
          font-weight: bold;
          font-style: italic;

          background-color: black;
          background: linear-gradient(to bottom, #2b2b2b, #4c2e19);

          font-size: 1.2em;

          display: flex;
        }

        .email-input * {
          font-size: inherit;
          font-family: inherit;
          font-weight: inherit;
          font-style: inherit;
        }

        .email-input input {
          outline: none;
          border: none;
          background-color: transparent;
          color: white;
          width: 100%;
        }

        .email-input button {
          outline: none;
          border: none;
          background-color: var(--purple);
          color: white;
          border-radius: 12px;
          padding: 10px;
          width: inherit;
          cursor: pointer;
          font-size: 16px;
        }

        .email-input button:hover {
          background-color: #a30095;
        }

        .signup-button {
          transition:
            background-color 0.1s ease-in-out,
            transform 0.1s ease-in-out;
        }

        .signup-button:hover {
          transform: scale(1.1) rotate(3deg);
        }

        .firetext {
          border-image-slice: 49 285 57 52 fill;
          border-image-source: url("/landing/firetext.png");
          border-image-width: 20px 50% 20px 20px;
          border-image-repeat: stretch stretch;
          border-image-outset: 0px 100px 0px 0px;
          padding: 20px;
          padding-right: 60px;

          color: black;
          font-weight: bold;
          font-style: italic;
          font-size: 2em;
          width: fit-content;
        }

        .info-screen {
          position: relative;
          height: 100%;
        }

        .info {
          position: relative;
          height: fit-content;
        }

        .info h1,
        .info p {
          color: white;
          font-weight: bold;
          padding-left: 48px;
          padding-right: 48px;
        }

        .info h1 {
          font-size: 4em;
          font-style: italic;
        }

        .info-screen .background {
          position: absolute;
          height: 100%;
          background-color: rgb(78, 138, 221);
          width: 100%;
        }

        .moving-background {
          opacity: 0.3;
        }

        .info-screen .info-screen-overlay {
          position: absolute;
          top: 0;
          height: 300px;
          width: 100%;
          background: linear-gradient(
            to bottom,
            rgba(0, 0, 0, 1) 0%,
            rgba(0, 0, 0, 0) 100%
          );
        }

        .info-screen .content {
          position: relative;
          z-index: 1;
          width: 100%;
          height: fit-content;
          padding: 64px;
        }

        .info-1 .content {
          padding-bottom: 12.5vw;
          margin-bottom: -19.5vw;
          padding-right: 35%;
        }

        .info-1-games {
          position: absolute;
          z-index: 1;
          right: -20%;
          top: 0;
          width: 55%;
        }

        .game-item {
          width: 40%;
          display: flex;
          flex-flow: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 10px;
          color: black;
          font-size: 0.8em;

          transition: transform 0.2s ease-in-out;

          background: linear-gradient(to bottom, white, var(--yellow));
          border: 4px solid black;
          border-radius: 16px;
          padding: 8px;

          position: absolute;
        }

        .game-item:hover {
          background: var(--yellow);
          transform: translateY(-20px);
          transition: transform 0.2s ease-in-out;
        }

        .game-item p {
          color: black;
          padding: 0;
        }

        .game-item img {
          width: 100%;
          border-radius: 8px;
        }

        .taiko-divider {
          point-events: none;
          position: relative;
          width: 100%;
          z-index: 5;
        }

        .taiko-divider img {
          width: 100%;
        }

        .jumpy {
          position: absolute;
          top: 12.2vw;
          display: flex;
          flex-flow: row;
          align-items: center;
          justify-content: center;
          gap: 5%;
          width: 100%;

          transform: rotate(-10.42deg);
          padding: 0 15%;
          color: white;
        }

        .jumpy-item {
          animation: jumpUp 2s infinite;
        }

        .jumpy p {
          text-align: center;

          font-weight: bold;
          font-size: 2em;

          margin-top: -50px;
          position: relative;
          z-index: 10;

          text-shadow:
            -3.5px 0 0 #000,
            3.5px 0 0 #000,
            0 -3.5px 0 #000,
            0 3.5px 0 #000,
            -3.5px -3.5px 0 #000,
            3.5px -3.5px 0 #000,
            -3.5px 3.5px 0 #000,
            3.5px 3.5px 0 #000;
        }

        .jumpy img {
          width: 100%;
          filter: drop-shadow(4px 4px 4px rgba(0, 0, 0, 0.5));
        }

        @keyframes jumpUp {
          0% {
            transform: translateY(0);
            color: white;
          }
          15% {
            transform: translateY(-10px);
            color: var(--yellow);
          }
          30% {
            transform: translateY(0);
            color: white;
          }
          100% {
            transform: translateY(0);
          }
        }

        .info-2 .content {
          padding-top: 10.5vw;
          margin-top: -19.5vw;
          display: flex;
          flex-flow: column;
          align-items: flex-end;
          justify-content: flex-end;
          text-align: right;

          padding-bottom: 22.5vw;
          margin-bottom: -19.5vw;

          padding-left: 25%;
        }

        .info-screen .info-2 .background {
          background-color: rgb(197, 121, 209);
        }

        .firetext.flipped {
          -webkit-transform: scaleX(-1);
          transform: scaleX(-1);
        }

        .firetext.flipped p {
          -webkit-transform: scaleX(-1);
          transform: scaleX(-1);
          text-align: right;
        }

        .firetext p {
          color: black;
          text-align: left;
          margin: 0;
          padding: 0;
        }

        .arcade-divider {
          width: 110%;
          margin-left: -5%;
          position: relative;
          z-index: 2;
          filter: drop-shadow(4px 4px 4px rgba(0, 0, 0, 0.5));
        }

        .signup {
          width: 100%;
          padding: 180px 20px 240px;
          display: flex;
          flex-flow: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 20px;
          position: relative;
          z-index: 15;
        }

        .faq-area {
          position: relative;
          overflow: hidden;
          padding-bottom: 80px;
        }

        .faq-background {
          background-color: black;
          background-image: url("/landing/shiba.png");
          background-size: 120px;
          width: 100%;
          height: 100%;
          position: absolute;
          z-index: 1;
          opacity: 0.2;
        }

        .faq-gradient-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: linear-gradient(to bottom, black 0%, transparent 60%);
          z-index: 3;
        }

        .purple-circle {
          position: absolute;
          width: 500px;
          height: 500px;
          background: radial-gradient(
            circle,
            rgba(128, 0, 255, 0.8) 0%,
            transparent 100%
          );
          border-radius: 50%;
          pointer-events: none;
          mix-blend-mode: color-dodge;
          z-index: 2;
          transform: translate(-50%, -50%);
          display: none;
          transition:
            left 0.2s ease-out,
            top 0.2s ease-out;
        }

        .faq {
          position: relative;
          z-index: 10;
          border: 2px solid white;
          border-radius: 32px;
          margin: 0 10%;
          padding: 24px;
          display: flex;
          flex-flow: column;
          align-items: stretch;
          gap: 20px;
          background-color: black;
        }

        .shiba-direct {
          border: 4px solid var(--red);
          border-radius: 8px;
          background: linear-gradient(to bottom, #ffb7b5, #ed7874);
          display: flex;
          flex-flow: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 8px;
          padding: 16px;
        }

        .shiba-direct p {
          font-weight: bold;
        }

        .shiba-direct img {
          width: 80%;
          margin-bottom: 8px;
        }

        .faq details {
          color: black;
          padding: 20px;
          background-color: white;
          border-radius: 8px;
          border: 4px solid white;
          background: linear-gradient(to bottom, #ffdfa8, #f7b748);
        }

        .faq summary {
          font-weight: bold;
        }

        @media (max-width: 600px) {
          .opening-info {
            padding: 24px 4px 40px;
            min-height: 100vh;
            gap: 24px;
          }

          .opening-info .logo {
            width: 95%;
            max-width: 500px;
            margin-top: 10px;
            margin-bottom: 4px;
          }

          .top-text.japanese {
            font-size: 0.9em;
            text-align: center;
          }

          .top-text.english {
            font-size: 0.9em;
            text-align: center;
          }

          .opening-video {
            width: 100%;
            max-width: 640px;
            margin-top: 0; /* remove negative space squeeze */
            margin-bottom: 8px;
          }

          .email-input {
            width: 100%; /* full bleed across the safe area */
            padding: 8px 10px; /* tighter side padding for more input width */
            flex-direction: column;
            gap: 10px;
            margin-top: 4px;
            font-size: 1em; /* slightly smaller than desktop default */
          }

          .email-input input {
            font-size: 0.95em; /* reduce font size to fit longer emails */
            letter-spacing: 0.25px;
          }

          .email-input button {
            font-size: 0.9em;
            padding: 10px 12px;
          }

          .email-input input {
            text-align: center;
          }

          .email-input button {
            width: 100%;
          }

          .info h1 {
            font-size: 2.5em;
            padding-left: 20px;
            padding-right: 20px;
          }

          .info p {
            font-size: 1em;
            padding-left: 20px;
            padding-right: 20px;
          }

          .info-screen .content {
            padding: 32px 20px;
          }

          .info-1 .content {
            padding-bottom: 8vw;
            margin-bottom: -12vw;
            padding-right: 20px;
          }

          .info-1-games {
            position: relative;
            right: auto;
            top: auto;
            width: 100%;
            margin-top: 40px;
            display: flex;
            flex-direction: column;
            gap: 20px;
            align-items: center;

            padding-bottom: 120px;
          }

          .game-item {
            position: relative;
            width: 30%;
            top: auto;
            left: auto;
            top: 0 !important;
            left: 0 !important;
          }

          .game-item p {
            font-size: 0.8em;
            padding: 0;
          }

          .taiko-divider > img {
            width: 200%;
            margin-top: -50%;
            margin-bottom: -25%;
          }

          .game-item {
            position: relative;
            width: 80%;
            top: auto;
            left: auto;
          }

          .game-item {
            transition: transform 0.3s ease-in-out;
          }

          .game-item:hover {
            transform: translateY(10px);
          }

          .jumpy {
            top: -8vw;
            gap: 2%;
            padding: 0 5%;
          }

          .jumpy-item {
            font-size: 0.8em;
          }

          .jumpy p {
            font-size: 1.5em;
            margin-top: -30px;
          }

          .info-2 .content {
            padding-top: 30vw;
            margin-top: -12vw;
            padding-bottom: 15vw;
            margin-bottom: -12vw;
            padding-left: 20px;
            align-items: flex-end;
            text-align: right;
          }

          .firetext {
            border-image-width: 15px 40% 15px 15px;
            border-image-outset: 0px 50px 0px 0px;
            padding: 15px;
            padding-right: 40px;
            font-size: 1.5em;
          }

          .arcade-divider {
            width: 100%;
            margin-left: 0;
          }

          .signup {
            padding: 120px 20px 160px;
          }

          .faq-area {
            padding-bottom: 40px;
          }

          .faq {
            margin: 0 5%;
            padding: 16px;
          }

          .shiba-direct {
            padding: 12px;
          }

          .shiba-direct img {
            width: 90%;
          }

          .faq details {
            padding: 15px;
          }

          .faq summary {
            font-size: 1em;
          }
        }
      `}</style>
    </div>
  );
}
