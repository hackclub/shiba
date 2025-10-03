/* eslint-disable react/prop-types */
import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const PlayGameComponent = dynamic(() => import("@/components/utils/playGameComponent"), { ssr: false });

export default function PostAttachmentRenderer({ content, attachments, playLink, gameName, thumbnailUrl, slackId, createdAt, token, onPlayCreated, badges, HoursSpent, gamePageUrl, postType, timelapseVideoId, githubImageLink, timeScreenshotId, hoursSpent, minutesSpent, postId, timeSpentOnAsset, currentUserProfile, onTimeUpdated, compact = false, onGameStart, onGameEnd, activeGameId, isFromMainPage = false }) {
  const [slackProfile, setSlackProfile] = useState(null);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editHours, setEditHours] = useState(0);
  const [editMinutes, setEditMinutes] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localTimeSpentOnAsset, setLocalTimeSpentOnAsset] = useState(timeSpentOnAsset);
  const [showBadgeWheel, setShowBadgeWheel] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState(null);

  const resolveBadgeSrc = (badgeName) => {
    const mapping = {
      'Speedy Shiba Shipper': '/SpeedyShibaShipper.png',
      'Super Subtle Shiba': '/SuperSubtleShiba.png',
      'Shomato': '/shomato.png',
      'Shiba Showreel Submitter': '/ShibaShowreel.png',
      'Stargazer': '/Stargazer.png',
      'Shiba Pie': '/PieBadge.svg',
      'Twin Shark': '/TwinShark.png',
      'Akito Lover': '/AkitoLover.png',
      'Shiba Sushi': '/ShibaSushi.png',
      'Umbrella Badge': '/UmbrellaBadge.png',
      'Shiba Fox': '/ShibaFox.png',
      'ChefsCircle': '/ChefsCircle.png',
      'House Of Mine': '/HouseOfMine.png',
      'Bug Crusher': '/BugCrusher.png',
      'Fist Of Fury': '/FistOfFurry.png',
      'Be Cool': '/BeCool.png',
      'Chaotic Dice': '/ChaoticDice.gif',
      'Shiba Friendship': '/ShibaFriendship.png',
      'CARRR': '/CARRR.png',
      'Space Head': '/Space-Head.png',
      'Gastly Badge': '/gastly.png',
      'Shiba Axtro Ship': '/axtro.png',
      'Speedy Shiba Racer': '/ShibaRacer.svg',
      'Fish Keychain': '/fishGif.gif',
      'Shiba Omelette': '/ShibaEgg.png',
      'Shadow Merger': '/shadow.gif',
      'Fatty Frog': '/fatFrog.gif',
      'Shiba As Gundam': '/ShibaAsGundam.png',
      'Shiba Radio': '/randomness.gif',
      'Randomness': '/randomness.gif',
      'Nature': '/tree.svg',
      'Daydream': '/daydream.png'
    };
    if (mapping[badgeName]) return mapping[badgeName];
    const compact = `/${String(badgeName || '').replace(/\s+/g, '')}.png`;
    return compact;
  };

  const showInlineBadges = false;
  
  // Calculate timeSpentOnAsset from hoursSpent and minutesSpent if not provided
  const calculatedTimeSpentOnAsset = localTimeSpentOnAsset || (hoursSpent && minutesSpent ? hoursSpent + (minutesSpent / 60) : 0);

  // Sync local state with prop changes
  useEffect(() => {
    setLocalTimeSpentOnAsset(timeSpentOnAsset);
  }, [timeSpentOnAsset]);
  
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!slackId) return;
      try {
        const res = await fetch(`/api/slackProfiles?slackId=${encodeURIComponent(slackId)}`);
        const json = await res.json().catch(() => ({}));
        if (!cancelled && json && (json.displayName || json.image)) {
          setSlackProfile({ displayName: json.displayName || '', image: json.image || '' });
        }
      } catch (_) {
        // best-effort only
      }
    };
    load();
    return () => { cancelled = true; };
  }, [slackId]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'shiba-badge-wheel-keyframes';
    if (!document.getElementById(id)) {
      const styleEl = document.createElement('style');
      styleEl.id = id;
      styleEl.textContent = `@keyframes shiba-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes shiba-spin-reverse { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }`;

      document.head.appendChild(styleEl);
    }
    return () => {
    };
  }, []);

  // Check if this post belongs to the current user
  const isOwnPost = currentUserProfile && currentUserProfile.slackId && slackId && currentUserProfile.slackId === slackId;
  const isArtlog = postType === 'artlog' || (timelapseVideoId && githubImageLink && calculatedTimeSpentOnAsset > 0);
  const canEdit = isOwnPost && isArtlog && token && postId;

  // Initialize edit values when entering edit mode
  useEffect(() => {
    if (isEditingTime && calculatedTimeSpentOnAsset > 0) {
      setEditHours(Math.floor(calculatedTimeSpentOnAsset));
      setEditMinutes(Math.round((calculatedTimeSpentOnAsset % 1) * 60));
    }
  }, [isEditingTime, calculatedTimeSpentOnAsset]);

  // Handle time update submission
  const handleTimeUpdate = async () => {
    if (!token || !postId || isSubmitting) return;
    
    const newTimeSpent = editHours + (editMinutes / 60);
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/updatePostTimeSpent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          postId,
          timeSpentOnAsset: newTimeSpent
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.ok) {
        // Update the local state to reflect the change immediately
        setLocalTimeSpentOnAsset(newTimeSpent);
        setIsEditingTime(false);
        
        // Call the callback to notify parent component if provided
        if (onTimeUpdated) {
          onTimeUpdated(postId, newTimeSpent);
        }
        
        // console.log('Time updated successfully:', data);
      } else {
        console.error('Failed to update time:', data.message);
        alert('Failed to update time: ' + (data.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error updating time:', error);
      alert('Error updating time: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };
  // Prefer explicit PlayLink field provided by API
  let playHref = typeof playLink === 'string' && playLink.trim() ? playLink.trim() : null;

  // If attachments contain a text/plain with a play URL, fallback (rare)
  if (!playHref && Array.isArray(attachments)) {
    const txt = attachments.find((a) => (a?.type || a?.contentType || "").startsWith("text/"));
    if (txt && typeof txt.url === "string") {
      playHref = txt.url;
    }
  }

  let gameId = '';
  if (playHref) {
    try {
      const path = playHref.startsWith('http') ? new URL(playHref).pathname : playHref;
      const m = /\/play\/([^\/?#]+)/.exec(path);
      gameId = m && m[1] ? decodeURIComponent(m[1]) : '';
    } catch (_) {
      gameId = '';
    }
  }

  // Utility: classify attachment kind using MIME and filename extension
  const classifyKind = (att) => {
    const rawType = String(att?.type || att?.contentType || '').toLowerCase();
    const filename = String(att?.filename || '');
    let ext = '';

    // First try to get extension from filename
    if (filename && filename.includes('.')) {
      ext = filename.split('.').pop().toLowerCase();
    }
    // If no filename extension, try to get it from the URL
    else if (att?.url) {
      try {
        const u = new URL(att.url, 'https://dummy');
        const p = u.pathname || '';
        if (p.includes('.')) {
          ext = p.split('.').pop().toLowerCase();
        }
      } catch (_) {
        // ignore
      }
    }

    // For S3 attachments, the type might be 'application/octet-stream'
    // so we need to rely more heavily on file extensions
    const imageExts = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg']);
    const videoExts = new Set(['mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv', 'mpg', 'mpeg']);
    const audioExts = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);

    // Check MIME type first
    if (rawType.startsWith('image/') || imageExts.has(ext)) return 'image';
    if (rawType.startsWith('video/') || videoExts.has(ext)) return 'video';
    if (rawType.startsWith('audio/') || audioExts.has(ext)) return 'audio';

    // If MIME type is generic (like application/octet-stream), rely on extension
    if (rawType === 'application/octet-stream' || !rawType) {
      if (imageExts.has(ext)) return 'image';
      if (videoExts.has(ext)) return 'video';
      if (audioExts.has(ext)) return 'audio';
    }

    return 'other';
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: 'visible' }}>
      {(slackId || (Array.isArray(badges) && badges.includes('Speedy Shiba Shipper'))) ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'visible' }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: '1px solid rgba(0,0,0,0.18)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundColor: '#fff',
              backgroundImage: slackProfile?.image ? `url(${slackProfile.image})` : 'none',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'visible' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, overflow: 'visible' }}>
              <strong>{slackProfile?.displayName || slackId || 'User'}</strong>
              {Array.isArray(badges) && badges.length > 0 && (
                <button
                  aria-label="Show badges"
                  onClick={() => setShowBadgeWheel((v) => !v)}
                  style={{
                    appearance: 'none',
                    border: '1px solid rgba(243, 0, 0, 0.95)',
                    background: '#fff',
                    borderRadius: 4,
                    height: 20,
                    padding: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    fontSize: 11,
                    lineHeight: 1,
                    paddingInline: 6,
                  }}
                  title={showBadgeWheel ? 'Hide badges' : 'Show badges'}
                >
                  Badges
                </button>
              )}

              {showBadgeWheel && Array.isArray(badges) && badges.length > 0 && (() => {
                const badgeCount = Math.min(badges.length, 20);
                const circleSize = Math.max(160, 120 + (badgeCount * 4));
                const radius = (circleSize / 2) - 20;
                
                return (
                  <div
                    style={{
                      position: 'absolute',
                      top: '140%',
                      left: 0,
                      width: circleSize,
                      height: circleSize,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at center, #fff,rgb(255, 238, 253))',
                      border: '1px solid rgba(255, 2, 2, 0.89)',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
                      zIndex: 20,
                      overflow: 'visible',
                      transformOrigin: '50% 50%',
                      animation: 'shiba-spin 12s linear infinite',
                    }}
                  >
                    {badges.slice(0, badgeCount).map((name, index) => {
                      const angle = (index / badgeCount) * 360;
                      const x = Math.cos((angle - 90) * Math.PI / 180) * radius;
                      const y = Math.sin((angle - 90) * Math.PI / 180) * radius;
                      
                      return (
                        <div
                          key={`${name}-${index}`}
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                            transition: 'transform 0.2s ease',
                          }}
                        >
                          <img
                            src={resolveBadgeSrc(name)}
                            alt={name}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            onClick={() => setSelectedBadge(name)}
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: 4,
                              border: '1px solid rgba(0,0,0,0.15)',
                              backgroundColor: '#fff',
                              cursor: 'pointer',
                              animation: 'shiba-spin-reverse 12s linear infinite',
                            }}
                            onMouseEnter={(e) => {
                              const parent = e.currentTarget.parentElement;
                              if (parent) parent.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1.1)`;
                            }}
                            onMouseLeave={(e) => {
                              const parent = e.currentTarget.parentElement;
                              if (parent) parent.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(1)`;
                            }}
                          />
                        </div>
                      );
                    })}
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: selectedBadge ? 8 : 10,
                        color: '#ff7ad3',
                        fontWeight: 600,
                        background: '#fff',
                        border: '1px solid rgba(0,0,0,0.2)',
                        padding: selectedBadge ? '4px 8px' : '2px 6px',
                        borderRadius: 6,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
                        textAlign: 'center',
                        maxWidth: circleSize * 0.6,
                        wordWrap: 'break-word',
                        lineHeight: 1.2,
                      }}
                    >
                      {selectedBadge || 'Badges'}
                    </div>
                  </div>
                );
              })()}
              {false && Array.isArray(badges) && badges.includes('Speedy Shiba Shipper') && (
                <div />
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Speedy Shiba Shipper') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/SpeedyShibaShipper.png"
                    alt="Speedy Shiba Shipper"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#FFD1A3',
                      border: '1px solid #F5994B',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Speedy Shiba Shipper
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Super Subtle Shiba') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/SuperSubtleShiba.png"
                    alt="Super Subtle Shiba"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E8F4FD',
                      border: '1px solid #4A90E2',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Super Subtle Shiba
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Shomato') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/shomato.png"
                    alt="Shomato"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#FFE6E6',
                      border: '1px solid #DC3545',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Shomato
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Shiba Showreel Submitter') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/ShibaShowreel.png"
                    alt="Shiba Showreel Submitter"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#FFF3CD',
                      border: '1px solid #FFC107',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Shiba Showreel Submitter
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Stargazer') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/Stargazer.png"
                    alt="Stargazer"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E6F3FF',
                      border: '1px solid #4A90E2',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Stargazer
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Shiba Pie') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/PieBadge.svg"
                    alt="Shiba Pie"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#FFF8E1',
                      border: '1px solid #FFB74D',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Shiba Pie
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Twin Shark') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/TwinShark.png"
                    alt="Twin Shark"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#FFE6F0',
                      border: '1px solid #E91E63',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Twin Shark
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Akito Lover') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/AkitoLover.png"
                    alt="Akito Lover"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#F3E5F5',
                      border: '1px solid #9C27B0',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Akito Lover
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Shiba Sushi') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/ShibaSushi.png"
                    alt="Shiba Sushi"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E8EAF6',
                      border: '1px solid #3F51B5',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Shiba Sushi
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Umbrella Badge') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/UmbrellaBadge.png"
                    alt="Umbrella Badge"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#F5F5F5',
                      border: '1px solid #616161',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Umbrella Badge
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Shiba Fox') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/ShibaFox.png"
                    alt="Shiba Fox"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E3F2FD',
                      border: '1px solid #2196F3',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Shiba Fox
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('ChefsCircle') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/ChefsCircle.png"
                    alt="ChefsCircle"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E8F4FD',
                      border: '1px solid #4A90E2',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    ChefsCircle
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('House Of Mine') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/HouseOfMine.png"
                    alt="House Of Mine"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E8F5E8',
                      border: '1px solid #4CAF50',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    House Of Mine
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Bug Crusher') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/BugCrusher.png"
                    alt="Bug Crusher"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#FFEBEE',
                      border: '1px solid #F44336',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Bug Crusher
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Fist Of Fury') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/FistOfFurry.png"
                    alt="Fist Of Fury"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#FFF3E0',
                      border: '1px solid #FF9800',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Fist Of Fury
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Be Cool') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/BeCool.png"
                    alt="Be Cool"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E0F2F1',
                      border: '1px solid #009688',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Be Cool
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Chaotic Dice') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/ChaoticDice.gif"
                    alt="Chaotic Dice"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#FCE4EC',
                      border: '1px solid #E91E63',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Chaotic Dice
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Shiba Friendship') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/ShibaFriendship.png"
                    alt="Shiba Friendship"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#FFF8E1',
                      border: '1px solid #FFC107',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Shiba Friendship
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('CARRR') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/CARRR.png"
                    alt="CARRR"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#FFEBEE',
                      border: '1px solid #F44336',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    CARRR
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Space Head') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/Space-Head.png"
                    alt="Space Head"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E3F2FD',
                      border: '1px solid #2196F3',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Space Head
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Gastly Badge') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/gastly.png"
                    alt="Gastly Badge"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#F3E5F5',
                      border: '1px solid #9C27B0',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Gastly Badge
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Shiba Axtro Ship') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/axtro.png"
                    alt="Shiba Axtro Ship"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E8F4FD',
                      border: '1px solid #4A90E2',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Shiba Axtro Ship
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Speedy Shiba Racer') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/ShibaRacer.svg"
                    alt="Speedy Shiba Racer"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#FFF3E0',
                      border: '1px solid #FF9800',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Speedy Shiba Racer
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Fish Keychain') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/fishGif.gif"
                    alt="Fish Keychain"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E0F2F1',
                      border: '1px solid #009688',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Fish Keychain
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Shiba Omelette') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/ShibaEgg.png"
                    alt="Shiba Omelette"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#FFF8E1',
                      border: '1px solid #FFC107',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Shiba Omelette
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Shadow Merger') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/shadow.gif"
                    alt="Shadow Merger"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#F5F5F5',
                      border: '1px solid #616161',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Shadow Merger
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Fatty Frog') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/fatFrog.gif"
                    alt="Fatty Frog"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E8F5E8',
                      border: '1px solid #4CAF50',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Fatty Frog
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Shiba As Gundam') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/ShibaAsGundam.png"
                    alt="Shiba As Gundam"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E8EAF6',
                      border: '1px solid #3F51B5',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Shiba As Gundam
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Shiba Radio') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/Note_Block_animate.gif"
                    alt="Shiba Radio"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent',
                      objectFit: 'contain'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#FFF3E0',
                      border: '1px solid #FF9800',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Shiba Radio
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Randomness') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/randomness.gif"
                    alt="Randomness"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent',
                      objectFit: 'contain'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#F3E5F5',
                      border: '1px solid #9C27B0',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Randomness
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Nature') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/tree.svg"
                    alt="Nature"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent',
                      objectFit: 'contain'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#E8F5E8',
                      border: '1px solid #4CAF50',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Nature
                  </div>
                </div>
              )}
              {showInlineBadges && Array.isArray(badges) && badges.includes('Daydream') && (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src="/daydream.png"
                    alt="Daydream"
                    style={{
                      width: 20,
                      height: 20,
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease-out, border 0.2s ease-out, background-color 0.2s ease-out',
                      border: '1px dotted transparent',
                      borderRadius: '4px',
                      backgroundColor: 'transparent',
                      objectFit: 'contain'
                    }}
                    onMouseEnter={(e) => {
                      // Add gentle bounce effect
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.border = '1px dotted #999';
                      e.target.style.backgroundColor = 'white';
                      setTimeout(() => {
                        e.target.style.transform = 'scale(1)';
                      }, 200);

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.display = 'block';
                        // Trigger animation after display is set
                        setTimeout(() => {
                          popup.style.opacity = '1';
                          popup.style.transform = 'translateX(-50%) scale(1)';
                        }, 10);
                      }
                    }}
                    onMouseLeave={(e) => {
                      // Reset transform and border
                      e.target.style.transform = 'scale(1)';
                      e.target.style.border = '1px dotted transparent';
                      e.target.style.backgroundColor = 'transparent';

                      const popup = e.target.nextSibling;
                      if (popup) {
                        popup.style.opacity = '0';
                        popup.style.transform = 'translateX(-50%) scale(0)';
                        // Hide after animation completes
                        setTimeout(() => {
                          popup.style.display = 'none';
                        }, 200);
                      }
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '100%',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#F3E5F5',
                      border: '1px solid #9C27B0',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '6px',
                      fontWeight: 'bold',
                      color: '#333',
                      whiteSpace: 'nowrap',
                      zIndex: 1000,
                      display: 'none',
                      marginBottom: '0px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                      opacity: 0,
                      transformOrigin: 'center bottom',
                      transition: 'all 0.2s ease-out'
                    }}
                  >
                    Daydream
                  </div>
                </div>
              )}
              {gameName ? (
                gamePageUrl ? (
                  <a
                    href={gamePageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      opacity: 0.8,
                      textDecoration: 'underline',
                      color: 'inherit',
                      cursor: 'pointer'
                    }}
                  >
                    (making {gameName})
                  </a>
                ) : (
                  <em style={{ opacity: 0.8 }}>(making {gameName})</em>
                )
              ) : null}
            </div>
            {createdAt ? (
              <div style={{ display: 'flex', flexDirection: 'row', gap: 8, fontSize: 11, opacity: 0.6, marginTop: 2, alignItems: 'center' }}>
                {timeSpentOnAsset
                  ? (
                    <>
                      <span>
                        {`${Math.floor(timeSpentOnAsset)}h${Math.round((timeSpentOnAsset % 1) * 60)}m`} logged
                      </span>
                      <span style={{ fontSize: 8 }}>●</span>
                    </>
                  )
                  : (HoursSpent && HoursSpent > 0 && Math.floor((HoursSpent % 1) * 60) > 0 && (
                    <>
                      <span>
                        {Math.floor(HoursSpent) > 0 ? `${Math.floor(HoursSpent)}hr ` : ''}{Math.round((HoursSpent % 1) * 60)}min logged
                      </span>
                      <span style={{ fontSize: 8 }}>●</span>
                    </>
                  ))
                }
                <span>
                  {new Date(createdAt).toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </span>
                <span>
                  {new Date(createdAt).toLocaleDateString('en-US', {
                    month: '2-digit',
                    day: '2-digit',
                    year: '2-digit'
                  })}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      
      
      
      <div style={{ whiteSpace: 'pre-wrap', fontSize: compact ? '18px' : 'inherit' }}>{content || ''}</div>

      {/* Shomato Button - only show if token and postId are provided */}
      {/* Removed as per edit hint */}

      {/* Debug logging */}
      {/* console.log('PostAttachmentRenderer artlog check:', {
        postType,
        timelapseVideoId,
        githubImageLink,
        timeSpentOnAsset,
        hoursSpent,
        minutesSpent,
        calculatedTimeSpentOnAsset,
        condition: postType === 'artlog' || (timelapseVideoId && githubImageLink && calculatedTimeSpentOnAsset > 0)
      }) */}
      
      {/* Artlog-specific rendering */}
      {(postType === 'artlog' || (timelapseVideoId && githubImageLink && calculatedTimeSpentOnAsset > 0)) && (
        <div style={{ 
          border: '2px solid #ff6fa5', 
          borderRadius: '12px', 
          padding: '16px', 
          marginBottom: '16px',
          background: 'rgba(255, 111, 165, 0.05)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            marginBottom: '12px',
            color: '#ff6fa5',
            fontWeight: 'bold',
            fontSize: '14px'
          }}>
            🎨 Artlog
          </div>
          
          {/* Timelapse Video */}
          {timelapseVideoId && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Timelapse:</div>
              <video
                src={timelapseVideoId}
                controls
                playsInline
                style={{
                  width: '100%',
                  maxHeight: '300px',
                  borderRadius: '8px',
                  background: '#000'
                }}
                onError={(e) => {
                  console.error('Video error:', e);
                  console.error('Video src:', timelapseVideoId);
                }}
                onLoadStart={() => {
                  // console.log('Video loading started:', timelapseVideoId);
                }}
                onCanPlay={() => {
                  // console.log('Video can play:', timelapseVideoId);
                }}
              />

            </div>
          )}
          
          {/* GitHub Image Link (dropdown) */}
          {githubImageLink && (
            <details style={{ marginBottom: '12px' }}>
              <summary style={{ fontSize: '12px', color: '#666', marginBottom: '4px', cursor: 'pointer', outline: 'none' }}>
                GitHub Link
              </summary>
              <a 
                href={githubImageLink} 
                target="_blank" 
                rel="noopener noreferrer"
                style={{ 
                  color: '#007bff', 
                  textDecoration: 'none',
                  fontSize: '14px',
                  wordBreak: 'break-all'
                }}
              >
                {githubImageLink}
              </a>
            </details>
          )}
          
          {/* Time Screenshot (dropdown) */}
          {timeScreenshotId && (
            <details style={{ marginBottom: '12px' }}>
              <summary style={{ fontSize: '12px', color: '#666', marginBottom: '4px', cursor: 'pointer', outline: 'none' }}>
                Time Screenshot
              </summary>
              <img 
                src={typeof timeScreenshotId === 'string' ? timeScreenshotId : timeScreenshotId?.[0]?.url || ''}
                alt="Time spent screenshot"
                style={{
                  maxWidth: '100%',
                  maxHeight: '200px',
                  borderRadius: '8px',
                  border: '1px solid #ddd',
                  marginTop: '8px'
                }}
              />
            </details>
          )}
          
          {/* Time Display */}
          {calculatedTimeSpentOnAsset > 0 && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              fontSize: '14px',
              color: '#666',
              position: 'relative'
            }}>
              <span>⏱️</span>
              {isEditingTime ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={editHours}
                    onChange={(e) => setEditHours(parseInt(e.target.value) || 0)}
                    style={{
                      width: '40px',
                      padding: '2px 4px',
                      border: '1px solid #ddd',
                      borderRadius: '3px',
                      fontSize: '12px'
                    }}
                  />
                  <span>h</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={editMinutes}
                    onChange={(e) => setEditMinutes(parseInt(e.target.value) || 0)}
                    style={{
                      width: '40px',
                      padding: '2px 4px',
                      border: '1px solid #ddd',
                      borderRadius: '3px',
                      fontSize: '12px'
                    }}
                  />
                  <span>m</span>
                  <button
                    onClick={handleTimeUpdate}
                    disabled={isSubmitting}
                    style={{
                      padding: '2px 6px',
                      fontSize: '10px',
                      backgroundColor: '#ff6fa5',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      opacity: isSubmitting ? 0.6 : 1
                    }}
                  >
                    {isSubmitting ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => setIsEditingTime(false)}
                    disabled={isSubmitting}
                    style={{
                      padding: '2px 6px',
                      fontSize: '10px',
                      backgroundColor: '#ccc',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: isSubmitting ? 'not-allowed' : 'pointer',
                      opacity: isSubmitting ? 0.6 : 1
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>
                    {`${Math.floor(calculatedTimeSpentOnAsset)}h${Math.round((calculatedTimeSpentOnAsset % 1) * 60)}m`}
                  </span>
                  {canEdit && (
                    <button
                      onClick={() => setIsEditingTime(true)}
                      style={{
                        padding: '2px 4px',
                        fontSize: '10px',
                        backgroundColor: 'transparent',
                        color: '#ff6fa5',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        opacity: 0.7,
                        transition: 'opacity 0.2s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.opacity = '1'}
                      onMouseLeave={(e) => e.target.style.opacity = '0.7'}
                    >
                      ✏️
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {gameId ? (
        <PlayGameComponent
          gameId={gameId}
          gameName={gameName}
          thumbnailUrl={thumbnailUrl}
          animatedBackground={''}
          token={token}
          onPlayCreated={onPlayCreated}
          onGameStart={onGameStart}
          onGameEnd={onGameEnd}
          activeGameId={activeGameId}
          gamePageUrl={gamePageUrl}
          compact={compact}
          isFromMainPage={isFromMainPage}
        />
      ) : null}
      {Array.isArray(attachments) && attachments.length > 0 && (() => {
        const media = attachments.filter((att) => {
          const kind = classifyKind(att);
          return kind === 'image' || kind === 'video';
        });
        const mediaCount = media.length;
        const columns = Math.max(1, Math.min(mediaCount, 3)); // 1 col for 1, 2 cols for 2, 3+ cols => 3
        const imageMax = Math.max(160, Math.floor(480 / columns));
        const videoMax = Math.max(200, Math.floor(540 / columns));
        return (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8 }}>
            {attachments.map((att, idx) => {
              const url = att?.url;
              const kind = classifyKind(att);
              if (!url) return null;
              if (kind === 'image') {
                return (
                  <img
                    key={att.id || idx}
                    src={url}
                    alt={att.filename || ''}
                    style={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: imageMax,
                      objectFit: 'contain',
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      background: '#fff',
                    }}
                  />
                );
              }
              if (kind === 'video') {
                return (
                  <video
                    key={att.id || idx}
                    src={url}
                    controls
                    playsInline
                    style={{
                      width: '100%',
                      height: 'auto',
                      maxHeight: videoMax,
                      borderRadius: 8,
                      background: '#000',
                    }}
                  />
                );
              }
              if (kind === 'audio') {
                return (
                  <div key={att.id || idx} style={{ gridColumn: columns > 1 ? `span ${columns}` : 'auto' }}>
                    <audio src={url} controls style={{ width: '100%' }} />
                  </div>
                );
              }
              return (
                <a
                  key={att.id || idx}
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  download
                  style={{ fontSize: 12, gridColumn: columns > 1 ? `span ${columns}` : 'auto' }}
                >
                  {att.filename || url}
                </a>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
