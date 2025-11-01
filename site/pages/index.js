import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import HomeScreen from "@/components/HomeScreen";
import StartScreen from "@/components/StartScreen";
import SocialStartScreen from "@/components/SocialStartScreen";
import MyGamesComponent from "@/components/MyGamesComponent";
import GlobalGamesComponent from "@/components/GlobalGamesComponent";
import ShopComponent from "@/components/ShopComponent";
import HelpComponent from "@/components/HelpComponent";
import TopBar from "@/components/TopBar";
import PlaytestMode from "@/components/PlaytestMode";
import useAudioManager from "@/components/useAudioManager";
import ThreeDPage from "@/pages/3D";

export default function Home({ games: prefetchedGames, gamesError }) {
  const router = useRouter();
  const games = [
    {
      name: "My Games",
      description: "Create, update, and ship your games",
      backgroundImage: "GamesBottom.png",
      topImage: "GamesTop.png",
      bgColor: "rgba(255, 214, 224, 1)",
      gameClipAudio: "MyGames.mp3",
    },
    {
      name: "Global Games",
      description: "View global activity & playtest games",
      backgroundImage: "PlayBottom.png",
      topImage: "PlayTop.png",
      bgColor: "rgba(214, 245, 255, 1)",
      gameClipAudio: "Global.mp3",
    },
    {
      name: "Shop",
      description: "Purchase items from the shop.",
      backgroundImage: "ShopBottom.png",
      topImage: "ShopTop.png",
      bgColor: "rgba(214, 255, 214, 1)",
      gameClipAudio: "Shop.mp3",
    },
    {
      name: "Help",
      description: "Learn how to use Shiba.",
      backgroundImage: "HelpBottom.png",
      topImage: "HelpTop.png",
      bgColor: "rgba(255, 245, 214, 1)",
      gameClipAudio: "Help.mp3",
    },
  ];

  const [token, setToken] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showEventSite, setShowEventSite] = useState(false);
  const [showLoggedInView, setShowLoggedInView] = useState(false);
  const [slackCode, setSlackCode] = useState(null);

  const [appOpen, setAppOpen] = useState("Home");
  const [selectedGame, setSelectedGame] = useState(0);
  const [disableTopBar, setDisableTopBar] = useState(false);
  const [autoOpenProfile, setAutoOpenProfile] = useState(false);
  const [playtestMode, setPlaytestMode] = useState(false);
  const [selectedPlaytestGame, setSelectedPlaytestGame] = useState(null);
  const [show3D, setShow3D] = useState(false);

  // Audio manager for sound effects
  const { play: playSound, stopAll } = useAudioManager(["next.mp3", "prev.mp3", "Dream.mp3"]);

  const goHome = () => {
    setAppOpen("Home");
  };

  // Handle URL token parameter - only once on mount
  useEffect(() => {
    if (router.isReady) {
      const { token: urlToken, code: slackCode } = router.query;
      if (urlToken) {
        localStorage.setItem("token", urlToken);
        setToken(urlToken);
      }
      // Store slack code for passing to StartScreen
      if (slackCode) {
        setSlackCode(slackCode);
      }
    }
  }, [router.isReady]); // Only run when router becomes ready

  // Handle other URL query parameters
  useEffect(() => {
    if (router.isReady) {
      const { openProfile, "3d": threeD, arcade } = router.query;
      
      if (openProfile === "true") {
        setAutoOpenProfile(true);
        // Clean up the URL without triggering a page reload
        router.replace("/", undefined, { shallow: true });
      }
      
      if (threeD === "true") {
        setShow3D(true);
        // Clean up the URL without triggering a page reload
        router.replace("/", undefined, { shallow: true });
      }
      
      if (arcade === "true" || arcade === "") {
        setShowEventSite(true);
        // Clean up the URL without triggering a page reload
        router.replace("/", undefined, { shallow: true });
      }
    }
  }, [router.isReady, router.query]);

  // Reset autoOpenProfile after it's been used
  useEffect(() => {
    if (autoOpenProfile && appOpen === "Home") {
      // Reset the flag after a short delay to ensure HomeScreen has processed it
      const timer = setTimeout(() => {
        setAutoOpenProfile(false);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [autoOpenProfile, appOpen]);

  // Clear slackCode after it's been processed
  useEffect(() => {
    if (slackCode) {
      const timer = setTimeout(() => {
        setSlackCode(null);
      }, 5000); // Clear after 5 seconds
      return () => clearTimeout(timer);
    }
  }, [slackCode]);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // Fetch profile when token is available
  useEffect(() => {
    let isMounted = true;
    const fetchProfile = async () => {
      if (!token) {
        setProfile(null);
        return;
      }
      try {
        const res = await fetch("/api/getMyProfile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (isMounted) {
          if (res.ok && data?.ok) {
            setProfile(data.profile || null);
          } else if (res.status === 401) {
            // Token is invalid, log user out
            localStorage.removeItem("token");
            setToken(null);
            setProfile(null);
          }
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
        // On network error, also log out to be safe
        if (isMounted) {
          localStorage.removeItem("token");
          setToken(null);
          setProfile(null);
        }
      }
    };
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [token]);

  const requestOtp = async (email, sentby) => {
    try {
      const res = await fetch("/api/newLogin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, sentby }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, ...data };
    } catch (e) {
      return { ok: false, message: "Network error" };
    }
  };

  const verifyOtp = async (email, otp) => {
    try {
      const res = await fetch("/api/tryOTP", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.token) {
        localStorage.setItem("token", data.token);
        setToken(data.token);
      }
      return { ok: res.ok, ...data };
    } catch (e) {
      return { ok: false, message: "Network error" };
    }
  };

  // Show 3D mode if ?3d=true
  if (show3D) {
    return <ThreeDPage games={prefetchedGames} gamesError={gamesError} />;
  }

  // Show SocialStartScreen by default unless user wants to enter logged-in view
  if (!showLoggedInView) {
    if (!showEventSite) {
      return (
        <SocialStartScreen 
          games={prefetchedGames} 
          gamesError={gamesError}
          onLoginClick={() => setShowEventSite(true)}
          onSignupClick={() => setShowEventSite(true)}
          token={token}
          profile={profile}
          onEnterArcade={() => setShowLoggedInView(true)}
          requestOtp={requestOtp}
          verifyOtp={verifyOtp}
          setToken={setToken}
        />
      );
    }
    
    // Show Event Site (StartScreen) when Login/Signup is clicked
    return (
      <StartScreen
        setToken={setToken}
        requestOtp={requestOtp}
        verifyOtp={verifyOtp}
        onBackToSocial={() => setShowEventSite(false)}
        onEnterArcade={() => {
          setShowEventSite(false);
          setShowLoggedInView(true);
        }}
        slackCode={slackCode}
      />
    );
  }

  // Render logged-in view when showLoggedInView is true
  if (token !== null && showLoggedInView) {
    // Render playtest mode if active
    if (playtestMode) {
      return (
        <PlaytestMode 
          onExit={() => {
            setPlaytestMode(false);
            setSelectedPlaytestGame(null);
          }}
          profile={profile}
          playtestGame={selectedPlaytestGame}
          playSound={playSound}
          stopAll={stopAll}
          token={token}
        />
      );
    }
  }

  return (
    <>
      <Head>
        <title>Shiba Arcade</title>
        <meta name="description" content="Make a game, build an arcade in Tokyo Japan from November 5th - 12th." />
        
        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://shiba.hackclub.com" />
        <meta property="og:title" content="Shiba Arcade" />
        <meta property="og:description" content="Make a game, build an arcade in Tokyo Japan from November 5th - 12th." />
        <meta property="og:image" content="https://shiba.hackclub.com/bg.gif" />
        <meta property="og:image:type" content="image/gif" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        
        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content="https://shiba.hackclub.com" />
        <meta property="twitter:title" content="Shiba Arcade" />
        <meta property="twitter:description" content="Make a game, build an arcade in Tokyo Japan from November 5th - 12th." />
        <meta property="twitter:image" content="https://shiba.hackclub.com/bg.gif" />
      </Head>
      {(() => {
        if (appOpen === "Home") {
          return (
            <HomeScreen
              games={games}
              appOpen={appOpen}
              setAppOpen={setAppOpen}
              selectedGame={selectedGame}
              setSelectedGame={setSelectedGame}
              SlackId={profile?.slackId || null}
              token={token}
              profile={profile}
              setProfile={setProfile}
              autoOpenProfile={autoOpenProfile}
            />
          );
        }

        const componentsMap = {
          "My Games": MyGamesComponent,
          "Global Games": GlobalGamesComponent,
          Shop: ShopComponent,
          Help: HelpComponent,
        };

        const SelectedComponent = componentsMap[appOpen];
        if (SelectedComponent) {
          return (
            <div style={{ position: "relative", minHeight: "100vh" }}>
              {!disableTopBar && (
                <TopBar
                  backgroundColor={games[selectedGame].bgColor}
                  title={games[selectedGame].name}
                  image={games[selectedGame].backgroundImage}
                  onBack={() => setAppOpen("Home")}
                />
              )}
              <div style={{ paddingTop: disableTopBar ? 0 : 64 }}>
                <SelectedComponent
                  disableTopBar={disableTopBar}
                  setDisableTopBar={setDisableTopBar}
                  goHome={goHome}
                  token={token}
                  SlackId={profile?.slackId || null}
                  profile={profile}
                  setProfile={setProfile}
                  setPlaytestMode={setPlaytestMode}
                  setSelectedPlaytestGame={setSelectedPlaytestGame}
                  onOpenProfile={appOpen === "My Games" ? () => {
                    setAutoOpenProfile(true);
                    setDisableTopBar(false);
                    setAppOpen("Home");
                  } : undefined}
                />
              </div>
            </div>
          );
        }
      })()}
    </>
  );
}

export async function getStaticProps() {
  try {
    // Use local API in development, production API in production
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? 'https://shiba.hackclub.com/api/GetAllGames?build=true'
      : 'http://localhost:3000/api/GetAllGames?build=true';

    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      throw new Error('Failed to fetch games');
    }

    const games = await response.json();

    return {
      props: {
        games,
        gamesError: null
      },
      // Cache for 1 hour (3600 seconds) in production, 60 seconds in development
      revalidate: process.env.NODE_ENV === 'production' ? 3600 : 3600
    };
  } catch (error) {
    console.error('Error fetching games:', error);
    return {
      props: {
        games: [],
        gamesError: error.message || 'Failed to load games'
      }
    };
  }
}
