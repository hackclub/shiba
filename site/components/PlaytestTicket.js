import React from 'react';
import { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';

const RadarChart = dynamic(() => import('@/components/RadarChart'), { ssr: false });

export default function PlaytestTicket({ playtest, onPlaytestClick }) {
  const handlePlaytest = () => {
    // console.log('Playtest clicked for:', playtest.gameName);
    if (onPlaytestClick) {
      onPlaytestClick(playtest);
    }
  };

  const PLAYTEST_DAYS = 5;

  // Add days remaining
  const createdDate = new Date(playtest.createdAt);
  if (isNaN(createdDate)) {
    return { ...playtest, daysRemaining: 'N/A' };
  }
  const now = new Date();
  const diffTime = Math.abs(now - createdDate);
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, PLAYTEST_DAYS - diffDays);

  // collapsible feedback; only on complete playtests
  const [showFeedback, setShowFeedback] = useState(false);

  // ref for feedback container to measure height so we can have nice size transitions
  // I'm not sure if this is the cleanest way to do this, but most of the app is a vibe-coded mess so whatever
  const feedbackRef = useRef(null);
  const [feedbackHeight, setFeedbackHeight] = useState(0);

  useEffect(() => {
    if (playtest.status === 'Complete' && playtest.feedback && feedbackRef.current) {
      setFeedbackHeight(feedbackRef.current.scrollHeight);
    }
  }, [showFeedback, playtest.status, playtest.feedback]);

  return (
    <div
      style={{
        border: '2px solid #ff6fa5',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.8)',
        padding: 16,
        color: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          cursor: playtest.status === 'Complete' && playtest.feedback ? 'pointer' : 'default',
          userSelect: 'none',
        }}
        onClick={() => {
          // the whole thing just toggles feedback being shown if complete
          if (playtest.status === 'Complete' && playtest.feedback) {
            setShowFeedback(v => !v);
          }
        }}
        tabIndex={playtest.status === 'Complete' && playtest.feedback ? 0 : -1}
        role={playtest.status === 'Complete' && playtest.feedback ? 'button' : undefined}
        aria-expanded={showFeedback}
      >
        {/* Left side - Spinning disk */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div
            className="cd-vinyl"
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              border: '1px solid grey',
              background: playtest.gameThumbnail 
                ? `url(${playtest.gameThumbnail})` 
                : 'radial-gradient(circle at 40% 40%, #f0f0f0 0%, #d9d9d9 40%, #c7c7c7 70%, #bdbdbd 100%)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              animation: 'spin 8s linear infinite',
              position: 'relative',
              boxShadow: `
                0 0 8px rgba(255, 255, 255, 0.15),
                0 0 15px rgba(255, 255, 255, 0.1),
                inset 0 0 5px rgba(255, 255, 255, 0.05)
              `,
            }}
          >
            {/* Vinyl overlay for rainbow effect */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 'inherit',
                pointerEvents: 'none',
                opacity: 0.18,
                background: 'conic-gradient(white, white, white, grey, grey, violet, deepskyblue, aqua, palegreen, yellow, orange, red, grey, grey, white, white, white, white, grey, grey, violet, deepskyblue, aqua, palegreen, yellow, orange, red, grey, grey, white)',
                mixBlendMode: 'screen',
              }}
            />
            
            {/* Outer ring */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '30%',
                height: '30%',
                margin: '-15% 0 0 -15%',
                borderRadius: 'inherit',
                background: 'lightgrey',
                backgroundClip: 'padding-box',
                border: '4px solid rgba(0, 0, 0, 0.2)',
                boxShadow: '0 0 1px grey',
                boxSizing: 'border-box',
              }}
            />
            
            {/* Center hole */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '18%',
                height: '18%',
                margin: '-9% 0 0 -9%',
                borderRadius: 'inherit',
                background: '#444444',
                backgroundClip: 'padding-box',
                border: '4px solid rgba(0, 0, 0, 0.1)',
                filter: 'drop-shadow(0 0 1px grey)',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Middle - Game info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ 
            margin: 0, 
            marginBottom: 8, 
            fontSize: 20, 
            fontWeight: 600,
            color: '#000'
          }}>
            <a href={playtest.gameLink || '#'} target="_blank" style={{ color: 'inherit' }} onClick={e => e.stopPropagation()}>
              {playtest.gameName || 'Unnamed Game'}
            </a>
          </h3>
          
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <div style={{ 
              display: 'inline-block',
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 600,
              background: playtest.status === 'Complete' ? 'rgba(40, 167, 69, 0.2)' : 
                         playtest.status === 'In Progress' ? 'rgba(251, 191, 36, 0.2)' : 
                         'rgba(120, 126, 137, 0.2)',
              color: playtest.status === 'Complete' ? '#28a745' : 
                     playtest.status === 'In Progress' ? '#fbbf24' : 
                     '#74787eff'
            }}>
              {playtest.status}
            </div>

            {/* If not complete, show the days remaining */}
            {playtest.status !== 'Complete' && (
              <div style={{
                fontSize: 14,
                color: '#a03a3aff',
                fontWeight: 500
              }}>
                  {daysRemaining.toFixed(1)} days remaining
              </div>
            )}

            {/* Indicators about data availability */}
            {/* {playtest.status !== 'Complete' && (
              <>
                <div style={{ fontSize: 14, color: playtest.ownerSlackId ? '#329939ff' : '#ff0000ff', fontWeight: 500 }}>
                  Posts {playtest.ownerSlackId ? 'should' : 'will not'} load!
                </div>
                <div style={{ fontSize: 14, color: playtest.gameLink ? '#329939ff' : '#ff0000ff', fontWeight: 500 }}>
                  Game {playtest.gameLink ? 'should' : 'will not'} show!
                </div>
              </>
            )} */}

            {/* <span style={{ fontSize: 12, opacity: 0.7, color: '#000' }}>
              ID: {playtest.playtestId}
            </span> */}
          </div>
          
          {playtest.instructions && (
            <p style={{ 
              margin: 0, 
              marginTop: 8,
              fontSize: 14, 
              opacity: 0.9,
              lineHeight: 1.4,
              color: '#000'
            }}>
              {playtest.instructions}
            </p>
          )}
        </div>

        {/* Right side - Button or Skill Tree */}
        <div style={{ flexShrink: 0 }}>
          {playtest.status === 'Complete' ? (
            <div style={{ 
              width: 200, 
              height: 80,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'visible'
            }}>
              <RadarChart
                data={[
                  playtest.funScore || 0,
                  playtest.creativityScore || 0,
                  playtest.audioScore || 0,
                  playtest.artScore || 0,
                  playtest.moodScore || 0
                ]}
                labels={['Fun', 'Creativity', 'Audio', 'Art', 'Mood']}
                width={160}
                height={120}
                backgroundColor="rgba(0, 0, 0, 0.1)"
                borderColor="rgba(0, 0, 0, 0.8)"
                pointBackgroundColor="rgba(0, 0, 0, 0.8)"
                pointBorderColor="rgba(0, 0, 0, 0.8)"
                animate={false}
                isMiniature={true}
              />
              {/* Show feedback toggle arrow if feedback exists */}
              {playtest.feedback && (
                <span style={{
                  marginLeft: 8,
                  fontSize: 22,
                  color: '#ff6fa5',
                  transform: showFeedback ? 'rotate(90deg)' : 'rotate(0deg)',
                  // the svg isn't centered lol
                  transformOrigin: '12px 12px',
                  transition: 'transform 0.25s',
                  display: 'inline-block',
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M16.75 11.989a1.82 1.82 0 0 1-.57 1.36l-6.82 6.1a1.27 1.27 0 0 1-.65.31h-.19a1.3 1.3 0 0 1-.52-.1a1.23 1.23 0 0 1-.54-.47a1.2 1.2 0 0 1-.21-.68v-13a1.2 1.2 0 0 1 .21-.69a1.23 1.23 0 0 1 1.25-.56c.24.039.464.143.65.3l6.76 6.09c.19.162.344.363.45.59c.114.234.175.49.18.75"/></svg>
                </span>
              )}
            </div>
          ) : (
            <button
              onClick={e => {
                e.stopPropagation();
                handlePlaytest();
              }}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(180deg, #ff8ec3 0%, #ff6fa5 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 120ms ease',
              }}
            >
              Playtest
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          width: '100%',
          marginTop: playtest.status === 'Complete' && playtest.feedback ? 12 : 0,
          maxHeight: playtest.status === 'Complete' && playtest.feedback && showFeedback ? feedbackHeight+5 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), margin-top 0.2s',
        }}
        aria-hidden={!(playtest.status === 'Complete' && playtest.feedback && showFeedback)}
      >
        {playtest.status === 'Complete' && playtest.feedback && (
          <div
            ref={feedbackRef}
            style={{
              background: 'rgba(255,255,255,0.95)',
              border: '1px solid #ff6fa5',
              borderRadius: 6,
              padding: 12,
              color: '#222',
              fontSize: 15,
              whiteSpace: 'pre-wrap',
              boxShadow: '0 2px 8px rgba(255,111,165,0.07)'
            }}
          >
            <span style={{
              fontWeight: '600'
            }}>Playtest time:</span>
            {` ${(playtest.playtimeSeconds / 60).toFixed(1)} minutes`}

            <span style={{
              fontWeight: '600',
              display: 'block'
            }}>Feedback:</span>
            {playtest.feedback}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}
