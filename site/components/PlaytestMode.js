import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';

const PostAttachmentRenderer = dynamic(() => import('@/components/utils/PostAttachmentRenderer'), { ssr: false });
const PlayGameComponent = dynamic(() => import('@/components/utils/playGameComponent'), { ssr: false });
const RadarChart = dynamic(() => import('@/components/RadarChart'), { ssr: false });

export default function PlaytestMode({ onExit, profile, playtestGame, playSound, stopAll, token }) {
  const [textVisible, setTextVisible] = useState(false);
  const [buttonsVisible, setButtonsVisible] = useState(false);
  const [currentStage, setCurrentStage] = useState(0); // 0 = initial greeting, 1 = journey, 2 = play game, 3 = rating, 4 = feedback pentagon
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [gameStartTime, setGameStartTime] = useState(null);
  const [playTime, setPlayTime] = useState(0);
  const [ratings, setRatings] = useState({
    fun: 0,
    art: 0,
    creativity: 0,
    audio: 0,
    mood: 0
  });
  const [ratingFeedback, setRatingFeedback] = useState({
    fun: '',
    art: '',
    creativity: '',
    audio: '',
    mood: ''
  });
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Audio state management
  const [audioFinished, setAudioFinished] = useState(false);

  useEffect(() => {
    // Reset stage when component mounts
    setCurrentStage(0);
    setTextVisible(false);
    setButtonsVisible(false);
    
    // Start the text animation after a short delay
    const textTimer = setTimeout(() => {
      setTextVisible(true);
    }, 300);
    
    // Start the button animation after text animation completes
    const messageLength = `Hello ${profile?.firstName || "Player"}, are you ready to begin your playtest of ${playtestGame?.gameName || "this game"}?`.length;
    const buttonTimer = setTimeout(() => {
      setButtonsVisible(true);
    }, 300 + (messageLength * 0.05 * 1000) + 1200); // Text delay + animation time + extra delay
    
    return () => {
      clearTimeout(textTimer);
      clearTimeout(buttonTimer);
    };
  }, [profile?.firstName, playtestGame?.gameName]);

  // Fetch posts when entering stage 1
  useEffect(() => {
    if (currentStage === 1 && playtestGame?.gameName && playtestGame?.ownerSlackId) {
      const fetchPosts = async () => {
        setPostsLoading(true);
        try {
          const res = await fetch('/api/GetPostsForGame', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              gameName: playtestGame.gameName,
              ownerSlackId: playtestGame.ownerSlackId
            }),
          });
          const data = await res.json().catch(() => []);
          if (Array.isArray(data)) {
            setPosts(data);
          }
        } catch (error) {
          console.error('Error fetching posts:', error);
        } finally {
          setPostsLoading(false);
        }
      };
      fetchPosts();
    }
  }, [currentStage, playtestGame?.gameName, playtestGame?.ownerSlackId]);

  // Timer effect for game play time
  useEffect(() => {
    let interval;
    if (gameStartTime && currentStage === 2) {
      interval = setInterval(() => {
        const elapsed = (Date.now() - gameStartTime) / 1000 / 60; // minutes with decimals
        setPlayTime(elapsed);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameStartTime, currentStage]);

  const stage0Message = `Hello ${profile?.firstName || "Player"}, are you ready to begin your playtest of ${playtestGame?.gameName || "this game"}?`;
  const stage1Message = `First, let's see their journey to make the game over ${Number(playtestGame?.HoursSpent || 0).toFixed(2)} hours`;

  // Standard navigation button component
  const NavigationButton = ({ onClick, children, sound = "next.mp3", style = {} }) => (
    <button
      onClick={() => {
        playSound?.(sound);
        onClick();
      }}
      style={{
        padding: "0.75rem 1.5rem",
        fontSize: "clamp(0.875rem, 1.25rem, 1.5rem)",
        fontWeight: "bold",
        color: "white",
        background: "black",
        border: "2px solid white",
        borderRadius: "0",
        cursor: "pointer",
        minWidth: "6rem",
        minHeight: "3rem",
        transition: "all 0.2s ease",
        ...style
      }}
      onMouseEnter={(e) => {
        e.target.style.background = "white";
        e.target.style.color = "black";
      }}
      onMouseLeave={(e) => {
        e.target.style.background = "black";
        e.target.style.color = "white";
      }}
    >
      {children}
    </button>
  );

  // Rating descriptions for each score
  const ratingDescriptions = {
    fun: {
      0: "Score of 0 means that you didn't enjoy it at all. You found it totally unpleasant and unfun to play.",
      1: "Score of 1 means you found it mostly unpleasant with very few enjoyable moments.",
      2: "Score of 2 means you found it somewhat boring or frustrating, but had a few okay moments.",
      3: "Score of 3 means you found it moderately enjoyable - not great, but not bad either.",
      4: "Score of 4 means you found it quite enjoyable and would recommend it to others.",
      5: "Score of 5 means you absolutely loved it and found it incredibly fun to play."
    },
    art: {
      0: "Score of 0 means you think the creator put no effort into the art and you don't think they are trying to make it look good.",
      1: "Score of 1 means the art is very basic with minimal effort put into visual design.",
      2: "Score of 2 means the art is simple but functional, though not particularly appealing.",
      3: "Score of 3 means the art is decent and shows some thought about visual design.",
      4: "Score of 4 means the art is quite good and enhances the overall experience.",
      5: "Score of 5 means the art is exceptional and significantly adds to the game's appeal."
    },
    creativity: {
      0: "Score of 0 means you think this is completely unoriginal and copied from other games.",
      1: "Score of 1 means it's very derivative with little original thought or innovation.",
      2: "Score of 2 means it has some original elements but mostly follows familiar patterns.",
      3: "Score of 3 means it shows moderate creativity with some interesting new ideas.",
      4: "Score of 4 means it's quite creative with several original and innovative elements.",
      5: "Score of 5 means it's highly original and innovative, unlike anything you've seen before."
    },
    audio: {
      0: "Score of 0 means the audio actively detracts from the experience or is completely absent.",
      1: "Score of 1 means the audio is very basic or poorly implemented.",
      2: "Score of 2 means the audio is functional but not particularly good.",
      3: "Score of 3 means the audio is decent and fits the game reasonably well.",
      4: "Score of 4 means the audio is quite good and enhances the atmosphere.",
      5: "Score of 5 means the audio is exceptional and significantly improves the experience."
    },
    mood: {
      0: "Score of 0 means the game creates a completely negative or unpleasant atmosphere.",
      1: "Score of 1 means the mood is mostly negative or doesn't work well.",
      2: "Score of 2 means the mood is neutral or somewhat off-putting.",
      3: "Score of 3 means the mood is decent and fits the game reasonably well.",
      4: "Score of 4 means the mood is quite good and creates a nice atmosphere.",
      5: "Score of 5 means the mood is exceptional and creates a perfect atmosphere for the game."
    }
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "black",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 9999,
      }}
    >
      <div style={{ 
        textAlign: "center",
        maxWidth: "90%",
        marginBottom: buttonsVisible ? "2rem" : "0",
        transition: "margin-bottom 0.5s ease"
      }}>
        {textVisible && currentStage === 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
            {stage0Message.split(' ').map((word, wordIndex) => (
              <div
                key={wordIndex}
                style={{
                  display: "flex",
                }}
              >
                {word.split('').map((char, charIndex) => {
                  const globalIndex = stage0Message.split(' ').slice(0, wordIndex).join(' ').length + wordIndex + charIndex;
                  return (
                    <span
                      key={`${wordIndex}-${charIndex}`}
                      style={{
                        opacity: 0,
                        transform: "translateY(20px) scale(0.8)",
                        animation: textVisible ? `letterFadeIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${globalIndex * 0.05}s forwards` : "none",
                        display: "inline-block",
                        color: "white",
                        fontSize: "clamp(2rem, 4rem, 6rem)",
                        fontWeight: "bold",
                        lineHeight: 1.2,
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
                      {char}
                    </span>
                  );
                })}
                {/* Add space after each word (except the last one) */}
                {wordIndex < stage0Message.split(' ').length - 1 && (
                  <span
                    style={{
                      opacity: 0,
                      transform: "translateY(20px) scale(0.8)",
                      animation: textVisible ? `letterFadeIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${(stage0Message.split(' ').slice(0, wordIndex).join(' ').length + wordIndex + word.length) * 0.05}s forwards` : "none",
                      display: "inline-block",
                                              color: "white",
                        fontSize: "clamp(2rem, 4rem, 6rem)",
                        fontWeight: "bold",
                      lineHeight: 1.2,
                      width: "0.3em",
                    }}
                  >
                    &nbsp;
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stage 1 Content */}
      {textVisible && currentStage === 1 && (
        <div style={{ 
          width: "100%",
          maxWidth: "1200px",
          maxHeight: "100%",
          margin: "0 auto",
          padding: "0 2rem",
          display: "flex",
          flexDirection: "column"
        }}>
          {/* Title */}
          <div style={{ 
            textAlign: "center",
            marginBottom: "2rem",
            marginTop: "1rem",
            flexShrink: 0
          }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
              {stage1Message.split(' ').map((word, wordIndex) => (
                <div
                  key={wordIndex}
                  style={{
                    display: "flex",
                  }}
                >
                  {word.split('').map((char, charIndex) => {
                    const globalIndex = stage1Message.split(' ').slice(0, wordIndex).join(' ').length + wordIndex + charIndex;
                    return (
                      <span
                        key={`${wordIndex}-${charIndex}`}
                        style={{
                          opacity: 0,
                          transform: "translateY(20px) scale(0.8)",
                          animation: textVisible ? `letterFadeIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${globalIndex * 0.05}s forwards` : "none",
                          display: "inline-block",
                          color: "white",
                          fontSize: "clamp(1rem, 2rem, 3rem)", // Half the size of stage 0
                          fontWeight: "bold",
                          lineHeight: 1.2,
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
                        {char}
                      </span>
                    );
                  })}
                  {/* Add space after each word (except the last one) */}
                  {wordIndex < stage1Message.split(' ').length - 1 && (
                    <span
                      style={{
                        opacity: 0,
                        transform: "translateY(20px) scale(0.8)",
                        animation: textVisible ? `letterFadeIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${(stage1Message.split(' ').slice(0, wordIndex).join(' ').length + wordIndex + word.length) * 0.05}s forwards` : "none",
                        display: "inline-block",
                        color: "white",
                        fontSize: "clamp(1rem, 2rem, 3rem)", // Half the size of stage 0
                        fontWeight: "bold",
                        lineHeight: 1.2,
                        width: "0.3em",
                      }}
                    >
                      &nbsp;
                    </span>
                  )}
                </div>
              ))}
            </div>
            
            {/* I'm Done Button */}
            <button
              onClick={() => {
                playSound?.("next.mp3");
                setAudioFinished(true); // Permanently disable audio
                setCurrentStage(2);
                setTextVisible(false);
                setButtonsVisible(false);
                // Re-trigger text animation for stage 2
                setTimeout(() => {
                  setTextVisible(true);
                }, 100);
              }}
              style={{
                marginTop: "1.5rem",
                padding: "0.75rem 1.5rem",
                fontSize: "clamp(0.875rem, 1.25rem, 1.5rem)",
                fontWeight: "bold",
                color: "white",
                background: "black",
                border: "2px solid white",
                borderRadius: "0",
                cursor: "pointer",
                minWidth: "8rem",
                minHeight: "3rem",
                opacity: 0,
                animation: textVisible ? `fadeInButtons 2s ease-in-out 2s forwards` : "none",
                transform: "translateY(10px)",
              }}
            >
              I'm done
            </button>
          </div>
          
          {/* Posts Grid */}
          {postsLoading ? (
            <div style={{ 
              textAlign: "center", 
              padding: "2rem",
              color: "white",
              
              fontSize: "clamp(0.875rem, 1.25rem, 1.5rem)",
              flex: 1,
              overflowY: "auto"
            }}>
              Loading journey...
            </div>
          ) : posts.length > 0 ? (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "0.5rem",
              padding: "1rem",
              marginBottom: "20px",
              flex: 1,
              overflowY: "auto",
              minHeight: 0
            }}>
              {posts.map((post, idx) => (
                <div
                  key={post.PostID || idx}
                  style={{
                    border: "1px solid rgba(0,0,0,0.18)",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.8)",
                    padding: "12px",
                    opacity: 0,
                    animation: `fadeInPost 0.8s ease forwards ${idx * 0.1}s`
                  }}
                >
                  <PostAttachmentRenderer
                    content={post.Content}
                    attachments={post.Attachements}
                    playLink={post.PlayLink}
                    gameName={post['Game Name']}
                    thumbnailUrl={post.GameThumbnail || ''}
                    slackId={post['slack id']}
                    createdAt={post['Created At']}
                    token={token}
                    badges={Array.isArray(post.Badges) ? post.Badges : []}
                    onPlayCreated={(play) => {
                      console.log('Play created:', play);
                    }}
                    postType={post.postType}
                    timelapseVideoId={post.timelapseVideoId}
                    githubImageLink={post.githubImageLink}
                    timeScreenshotId={post.timeScreenshotId}
                    hoursSpent={post.hoursSpent}
                    timeSpentOnAsset={post.timeSpentOnAsset}
                    minutesSpent={post.minutesSpent}
                    postId={post.PostID}
                    currentUserProfile={profile}
                    onTimeUpdated={(postId, newTime) => {
                      // Update the local posts state
                      setPosts(prevPosts => 
                        prevPosts.map(p => 
                          p.PostID === postId 
                            ? { ...p, timeSpentOnAsset: newTime }
                            : p
                        )
                      );
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div style={{ 
              textAlign: "center", 
              padding: "2rem",
              color: "white",
              fontSize: "clamp(0.875rem, 1.25rem, 1.5rem)"
            }}>
              No posts found for this developer's journey.
            </div>
          )}
        </div>
      )}

      {/* Buttons - Only show in stage 0 */}
      {buttonsVisible && currentStage === 0 && (
                <div style={{ 
          display: "flex",
          gap: "2rem",
          justifyContent: "center",
          opacity: 0,
          animation: "fadeInButtons 2s ease-in-out forwards"
        }}>
          <NavigationButton
            onClick={() => {
              setCurrentStage(1);
              setTextVisible(false);
              setButtonsVisible(false);
              
              // Start stage 1 animations
              setTimeout(() => {
                setTextVisible(true);
              }, 300);
            }}
            sound="next.mp3"
          >
            YES
          </NavigationButton>
          <NavigationButton
            onClick={() => {
              if (onExit) {
                onExit();
              }
            }}
            sound="prev.mp3"
          >
            NO
          </NavigationButton>
        </div>
      )}

      {/* Stage 3 Content - Rating */}
      {textVisible && currentStage === 3 && (
        <div style={{ 
          width: "100%",
          maxWidth: "1200px",
          maxHeight: "100%",
          margin: "0 auto",
          padding: "0 2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          overflowY: "auto"
        }}>
          {/* Title */}
          <div style={{ 
            textAlign: "center",
            marginBottom: "1rem",
            marginTop: "1rem",
            flexShrink: 0
          }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
              {`You played for ${playTime.toFixed(2)} minutes. Give an anonymous ranking on how you would honestly rank their game`.split(' ').map((word, wordIndex) => (
                <div
                  key={wordIndex}
                  style={{
                    display: "flex",
                  }}
                >
                  {word.split('').map((char, charIndex) => {
                    const globalIndex = `You played for ${playTime} minutes. Give an anonymous ranking on how you would honestly rank their game`.split(' ').slice(0, wordIndex).join(' ').length + wordIndex + charIndex;
                    return (
                      <span
                        key={`${wordIndex}-${charIndex}`}
                        style={{
                          opacity: 0,
                          transform: "translateY(20px) scale(0.8)",
                          animation: textVisible ? `letterFadeIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${globalIndex * 0.05}s forwards` : "none",
                          display: "inline-block",
                          color: "white",
                          fontSize: "clamp(1.5vw, 3vw, 4vw)",
                          fontWeight: "bold",
                          lineHeight: 1.2,
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
                        {char}
                      </span>
                    );
                  })}
                  {/* Add space after each word (except the last one) */}
                  {wordIndex < `You played for ${playTime.toFixed(2)} minutes. Give an anonymous ranking on how you would honestly rank their game`.split(' ').length - 1 && (
                    <span
                      style={{
                        opacity: 0,
                        transform: "translateY(20px) scale(0.8)",
                        animation: textVisible ? `letterFadeIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${(`You played for ${playTime.toFixed(2)} minutes. Give an anonymous ranking on how you would honestly rank their game`.split(' ').slice(0, wordIndex).join(' ').length + wordIndex + word.length) * 0.05}s forwards` : "none",
                        display: "inline-block",
                        color: "white",
                        fontSize: "clamp(1.5vw, 3vw, 4vw)",
                        fontWeight: "bold",
                        lineHeight: 1.2,
                        width: "0.3em",
                      }}
                    >
                      &nbsp;
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Rating System */}
          <div style={{
            width: "100%",
            maxWidth: "800px",
            margin: "0 auto",
            marginTop: "2rem",
            opacity: 0,
            animation: `fadeInButtons 2s ease-in-out 4s forwards`,
          }}>
            {Object.entries(ratings).map(([category, rating]) => (
              <div key={category} style={{
                marginBottom: "1.5rem",
                padding: "1rem",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.1)"
              }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.5rem"
                }}>
                  <span style={{
                    color: "white",
                    fontSize: "clamp(1rem, 1.5rem, 2rem)",
                    fontWeight: "bold",
                    textTransform: "capitalize"
                  }}>
                    {category}
                  </span>
                  <div style={{
                    display: "flex",
                    gap: "0.5rem",
                    alignItems: "center"
                  }}>
                    {[0, 1, 2, 3, 4, 5].map((score) => (
                      <div key={score} style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.25rem"
                      }}>
                        <span style={{
                          color: "white",
                          fontSize: "clamp(0.75rem, 1rem, 1.25rem)",
                          opacity: 0.8
                        }}>
                          {score}
                        </span>
                        <button
                          onClick={() => {
                            playSound?.("next.mp3");
                            setRatings(prev => ({ ...prev, [category]: score }));
                          }}
                          style={{
                            width: "clamp(1.5rem, 2rem, 2.5rem)",
                            height: "clamp(1.5rem, 2rem, 2.5rem)",
                            borderRadius: "50%",
                            border: "2px solid white",
                            background: rating === score ? "white" : "transparent",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <p style={{
                  color: "white",
                  fontSize: "clamp(0.875rem, 1.125rem, 1.375rem)",
                  lineHeight: 1.4,
                  opacity: 0.9,
                  margin: 0,
                  paddingTop: "0.5rem",
                  borderTop: "1px solid rgba(255,255,255,0.2)"
                }}>
                  {ratingDescriptions[category][rating]}
                </p>
                
                {/* Required feedback input */}
                <div style={{
                  marginTop: "1rem",
                  paddingTop: "0.5rem",
                  borderTop: "1px solid rgba(255,255,255,0.2)"
                }}>
                  <label style={{
                    color: "white",
                    fontSize: "clamp(0.875rem, 1.125rem, 1.375rem)",
                    fontWeight: "bold",
                    display: "block",
                    marginBottom: "0.5rem"
                  }}>
                    How can they improve {category}? Please be as specific as you can *
                    <span style={{
                      fontSize: "clamp(0.75rem, 1rem, 1.25rem)",
                      fontWeight: "normal",
                      opacity: 0.8,
                      marginLeft: "0.5rem"
                    }}>
                      ({ratingFeedback[category].trim().split(/\s+/).filter(word => word.length > 0).length}/20 words minimum)
                    </span>
                  </label>
                  <textarea
                    value={ratingFeedback[category]}
                    onChange={(e) => setRatingFeedback(prev => ({ ...prev, [category]: e.target.value }))}
                    placeholder={`How can they improve ${category}? Please be as specific as you can...`}
                    required
                    style={{
                      width: "100%",
                      minHeight: "80px",
                      padding: "12px",
                      fontSize: "14px",
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                      border: "2px solid rgba(255, 255, 255, 0.3)",
                      borderRadius: "6px",
                      color: "white",
                      resize: "vertical",
                      fontFamily: "inherit",
                      lineHeight: "1.4"
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* Button Container */}
          <div style={{
            display: "flex",
            gap: "1rem",
            marginTop: "2rem",
            marginBottom: "2rem",
            justifyContent: "center"
          }}>
            {/* Back Button */}
            <button
              onClick={() => {
                playSound?.("prev.mp3");
                setCurrentStage(2);
                setTextVisible(false);
                setButtonsVisible(false);
                // Re-trigger text animation for stage 2
                setTimeout(() => {
                  setTextVisible(true);
                }, 100);
              }}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "clamp(0.875rem, 1.25rem, 1.5rem)",
                fontWeight: "bold",
                color: "white",
                background: "black",
                border: "2px solid white",
                borderRadius: "0",
                cursor: "pointer",
                minWidth: "8rem",
                minHeight: "3rem",
                opacity: 0,
                animation: `fadeInButtons 2s ease-in-out 3s forwards`,
                transform: "translateY(10px)",
              }}
            >
              Back to Game
            </button>

            {/* Finalize Review Button */}
            <button
              onClick={() => {
                // Check if all required feedback fields are filled with minimum 20 words
                const allFeedbackFilled = Object.values(ratingFeedback).every(feedback => {
                  const trimmedFeedback = feedback.trim();
                  const wordCount = trimmedFeedback.split(/\s+/).filter(word => word.length > 0).length;
                  return trimmedFeedback !== '' && wordCount >= 20;
                });
                const allRatingsSelected = Object.values(ratings).every(rating => rating >= 0);
                
                if (!allRatingsSelected) {
                  alert('Please select a rating for all categories before proceeding.');
                  return;
                }
                
                if (!allFeedbackFilled) {
                  alert('Please provide at least 20 words of feedback for each rating category before proceeding.');
                  return;
                }
                
                // Set the additional feedback state to empty for user to fill in
                setAdditionalFeedback('');
                
                playSound?.("next.mp3");
                setCurrentStage(4);
                setTextVisible(false);
                setButtonsVisible(false);
                // Re-trigger text animation for stage 4
                setTimeout(() => {
                  setTextVisible(true);
                }, 100);
              }}
              style={{
                padding: "0.75rem 1.5rem",
                fontSize: "clamp(0.875rem, 1.25rem, 1.5rem)",
                fontWeight: "bold",
                color: "white",
                background: "black",
                border: "2px solid white",
                borderRadius: "0",
                cursor: "pointer",
                minWidth: "12rem",
                minHeight: "3rem",
                opacity: 0,
                animation: `fadeInButtons 2s ease-in-out 3s forwards`,
                transform: "translateY(10px)",
              }}
            >
              Finalize Review
            </button>
          </div>
        </div>
      )}

      {/* Stage 2 Content - Play Game */}
      {textVisible && currentStage === 2 && (
        <div style={{ 
          width: "100%",
          maxWidth: "1200px",
          margin: "0 auto",
          padding: "0 2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center"
        }}>
          {/* Title */}
          <div style={{ 
            textAlign: "center",
            marginBottom: "2rem",
            marginTop: "1rem",
            flexShrink: 0
          }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
              {"It's time to begin playing their game".split(' ').map((word, wordIndex) => (
                <div
                  key={wordIndex}
                  style={{
                    display: "flex",
                  }}
                >
                  {word.split('').map((char, charIndex) => {
                    const globalIndex = "It's time to begin playing their game".split(' ').slice(0, wordIndex).join(' ').length + wordIndex + charIndex;
                    return (
                      <span
                        key={`${wordIndex}-${charIndex}`}
                        style={{
                          opacity: 0,
                          transform: "translateY(20px) scale(0.8)",
                          animation: textVisible ? `letterFadeIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${globalIndex * 0.05}s forwards` : "none",
                          display: "inline-block",
                          color: "white",
                          fontSize: "clamp(1.5vw, 3vw, 4vw)",
                          fontWeight: "bold",
                          lineHeight: 1.2,
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
                        {char}
                      </span>
                    );
                  })}
                  {/* Add space after each word (except the last one) */}
                  {wordIndex < "It's time to begin playing their game".split(' ').length - 1 && (
                    <span
                      style={{
                        opacity: 0,
                        transform: "translateY(20px) scale(0.8)",
                        animation: textVisible ? `letterFadeIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${("It's time to begin playing their game".split(' ').slice(0, wordIndex).join(' ').length + wordIndex + word.length) * 0.05}s forwards` : "none",
                        display: "inline-block",
                        color: "white",
                        fontSize: "clamp(1.5vw, 3vw, 4vw)",
                        fontWeight: "bold",
                        lineHeight: 1.2,
                        width: "0.3em",
                      }}
                    >
                      &nbsp;
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Game Component */}
          {playtestGame?.gameLink && (() => {
            // Extract game ID from the URL like PostAttachmentRenderer does
            let gameId = '';
            const gameLink = Array.isArray(playtestGame.gameLink) ? playtestGame.gameLink[0] : playtestGame.gameLink;
            if (gameLink) {
              try {
                const path = gameLink.startsWith('http') ? new URL(gameLink).pathname : gameLink;
                const m = /\/play\/([^\/?#]+)/.exec(path);
                gameId = m && m[1] ? decodeURIComponent(m[1]) : '';
              } catch (_) {
                gameId = '';
              }
            }
            
            return gameId ? (
              <div style={{
                width: "100%",
                maxWidth: "800px",
                margin: "0 auto"
              }}>
                <PlayGameComponent
                  gameId={gameId}
                  gameName={playtestGame.gameName}
                  thumbnailUrl={playtestGame.gameThumbnail}
                  token={token}
                  onPlayCreated={(play) => {
                    console.log('Play created:', play);
                  }}
                  onGameStart={() => {
                    console.log('Game started!');
                    // Start timer when game actually starts
                    setGameStartTime(Date.now());
                  }}
                />
              </div>
            ) : null;
          })()}

          {/* Rate Game Button */}
          {gameStartTime && (
            <button
              onClick={() => {
                playSound?.("next.mp3");
                setCurrentStage(3);
                setTextVisible(false);
                setButtonsVisible(false);
                // Re-trigger text animation for stage 3
                setTimeout(() => {
                  setTextVisible(true);
                }, 100);
              }}
              style={{
                marginTop: "2rem",
                padding: "0.75rem 1.5rem",
                fontSize: "clamp(0.875rem, 1.25rem, 1.5rem)",
                fontWeight: "bold",
                color: "white",
                background: "black",
                border: "2px solid white",
                borderRadius: "0",
                cursor: "pointer",
                minWidth: "12rem",
                minHeight: "3rem",
                opacity: 0,
                animation: `fadeInButtons 2s ease-in-out 3s forwards`,
                transform: "translateY(10px)",
              }}
            >
              Continue to Review
            </button>
          )}
        </div>
      )}

      {/* Stage 4 Content - Feedback Pentagon */}
      {textVisible && currentStage === 4 && (
        <div style={{ 
          width: "100%",
          maxWidth: "1200px",
          maxHeight: "100%",
          margin: "0 auto",
          padding: "0 2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          overflowY: "auto"
        }}>
          {/* Title */}
          <div style={{ 
            textAlign: "center",
            marginBottom: "2rem",
            marginTop: "1rem",
            flexShrink: 0
          }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center" }}>
              {"Your Feedback Pentagon".split(' ').map((word, wordIndex) => (
                <div
                  key={wordIndex}
                  style={{
                    display: "flex",
                  }}
                >
                  {word.split('').map((char, charIndex) => {
                    const globalIndex = "Your Feedback Pentagon".split(' ').slice(0, wordIndex).join(' ').length + wordIndex + charIndex;
                    return (
                      <span
                        key={`${wordIndex}-${charIndex}`}
                        style={{
                          opacity: 0,
                          transform: "translateY(20px) scale(0.8)",
                          animation: textVisible ? `letterFadeIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${globalIndex * 0.05}s forwards` : "none",
                          display: "inline-block",
                          color: "white",
                          fontSize: "clamp(1.5vw, 3vw, 4vw)",
                          fontWeight: "bold",
                          lineHeight: 1.2,
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
                        {char}
                      </span>
                    );
                  })}
                  {/* Add space after each word (except the last one) */}
                  {wordIndex < "Your Feedback Pentagon".split(' ').length - 1 && (
                    <span
                      style={{
                        opacity: 0,
                        transform: "translateY(20px) scale(0.8)",
                        animation: textVisible ? `letterFadeIn 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) ${("Your Feedback Pentagon".split(' ').slice(0, wordIndex).join(' ').length + wordIndex + word.length) * 0.05}s forwards` : "none",
                        display: "inline-block",
                        color: "white",
                        fontSize: "clamp(1.5vw, 3vw, 4vw)",
                        fontWeight: "bold",
                        lineHeight: 1.2,
                        width: "0.3em",
                      }}
                    >
                      &nbsp;
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Radar Chart */}
          <div style={{
            width: "100%",
            maxWidth: "600px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}>
            <RadarChart
              data={[ratings.fun, ratings.creativity, ratings.audio, ratings.art, ratings.mood]}
              labels={['Fun', 'Creativity', 'Audio', 'Art', 'Mood']}
              width={400}
              height={400}
              backgroundColor="rgba(255, 255, 255, 0.2)"
              borderColor="rgba(255, 255, 255, 1)"
              pointBackgroundColor="rgba(255, 255, 255, 1)"
              pointBorderColor="rgba(255, 255, 255, 1)"
              animate={true}
              style={{
                opacity: 0,
                animation: `fadeInButtons 2s ease-in-out 2s forwards`
              }}
            />
          </div>
          
          {/* Feedback Text Area */}
          <div style={{
            marginTop: '2rem',
            width: '100%',
            maxWidth: '600px',
            margin: '2rem auto 0'
          }}>
            <h3 style={{
              color: 'white',
              fontSize: 'clamp(1rem, 1.5rem, 2rem)',
              fontWeight: 'bold',
              marginBottom: '1rem',
              textAlign: 'center'
            }}>
              Feedback to the creator
            </h3>
            <textarea
              value={additionalFeedback}
              onChange={(e) => setAdditionalFeedback(e.target.value)}
              placeholder="Share any additional thoughts about the game..."
              style={{
                width: '100%',
                minHeight: '200px',
                padding: '16px',
                fontSize: '16px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '2px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '8px',
                color: 'white',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: '1.5'
              }}
            />
          </div>
          
          {/* Buttons */}
          <div style={{
            marginTop: '2rem',
            marginBottom: '2rem',
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem'
          }}>
            <NavigationButton
              onClick={() => {
                setCurrentStage(3);
              }}
            >
              Back to Rating
            </NavigationButton>
            <NavigationButton
              onClick={async () => {
                if (isSubmitting) return;
                
                setIsSubmitting(true);
                try {
                  // Use the playtestId from the playtestGame object
                  const playtestId = playtestGame?.playtestId;
                  
                  if (!playtestId) {
                    alert('Error: Missing playtest ID');
                    return;
                  }
                  
                  // Combine all feedback into final format
                  const finalFeedback = `Additional Feedback: ${additionalFeedback}\n\nFun: ${ratingFeedback.fun}\n\nArt: ${ratingFeedback.art}\n\nCreativity: ${ratingFeedback.creativity}\n\nAudio: ${ratingFeedback.audio}\n\nMood: ${ratingFeedback.mood}`;
                  
                  const response = await fetch('/api/submitPlaytest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      token,
                      playtestId,
                      funScore: ratings.fun,
                      artScore: ratings.art,
                      creativityScore: ratings.creativity,
                      audioScore: ratings.audio,
                      moodScore: ratings.mood,
                      feedback: finalFeedback,
                      playtimeSeconds: Math.round(playTime * 60) // Convert minutes to seconds
                    })
                  });
                  
                  const result = await response.json();
                  
                  if (response.ok) {
                    // Success - exit playtest mode
                    onExit();
                  } else {
                    alert(`Error: ${result.error}`);
                  }
                } catch (error) {
                  console.error('Error submitting playtest:', error);
                  alert('Failed to submit playtest. Please try again.');
                } finally {
                  setIsSubmitting(false);
                }
              }}
              style={{
                opacity: isSubmitting ? 0.6 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer'
              }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Playtest'}
            </NavigationButton>
          </div>
        </div>
      )}
      
      <style jsx>{`
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
        
        @keyframes fadeInButtons {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeInPost {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      
      {/* Conditional Audio Element */}
      {!audioFinished && (
        <audio
          src="/Dream.mp3"
          loop
          autoPlay
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
}
