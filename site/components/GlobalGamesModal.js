import { useState, useRef, useEffect } from 'react';

export default function GlobalGamesModal({ post, onClose, token }) {
  if (!post) return null;

  const game = {
    gameName: post.gameName,
    gameThumbnail: post.gameThumbnail,
    gameDescription: post.gameDescription,
    slackId: post.slackId,
    slackUsername: post.slackUsername,
    playLink: post.PlayLink,
    githubLink: post.githubLink,
  };

  const [rotation, setRotation] = useState(0);
  const rotationRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const startAngleRef = useRef(0);
  const thumbRef = useRef(null);

  // Handle dragging
  const handleMouseDown = (e) => {
    draggingRef.current = true;
    const rect = thumbRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    startAngleRef.current = Math.atan2(dy, dx) * (180 / Math.PI) - rotationRef.current;
    velocityRef.current = 0;
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!draggingRef.current) return;
    const rect = thumbRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    const newRotation = angle - startAngleRef.current;

    velocityRef.current = newRotation - rotationRef.current; // simple velocity estimate
    rotationRef.current = newRotation;
    setRotation(newRotation);
  };

  const handleMouseUp = () => {
    draggingRef.current = false;
  };

  // Continuous spin + momentum
  useEffect(() => {
    let animationFrame;
    const tick = () => {
      if (!draggingRef.current) {
        rotationRef.current += 0.6;
      }

      if (!draggingRef.current) {
        rotationRef.current += velocityRef.current;
        velocityRef.current *= 0.95;
      }

      setRotation(rotationRef.current);
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: '#ffffffea',
          border: '1px solid rgba(0, 0, 0, 0.12)',
          borderRadius: 12,
          padding: 16,
          maxWidth: '400px',
          width: '100%',
          maxHeight: '80%',
          overflowY: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: 18,
            position: 'absolute',
            top: 16,
            right: 16,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>

        <div
          ref={thumbRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            width: '300px',
            height: '300px',
            margin: '0 auto 16px auto',
            borderRadius: '50%',
            overflow: 'hidden',
            position: 'relative',
            cursor: 'grab',
          }}
        >
          <img
            src={game.gameThumbnail || '/NoThumbnail.png'}
            alt={game.gameName}
            style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              border: '2px solid rgba(0,0,0,0.12)',
              objectFit: 'cover',
              transform: `rotate(${rotation}deg)`,
              transition: draggingRef.current ? 'none' : 'transform 0.04s linear',
            }}
          />
        </div>

        <h2 style={{ margin: '0 0 8px 0' }}>{game.gameName}</h2>

        <p style={{ marginBottom: 8 }}>
          {game.gameDescription || 'No description provided.'}
        </p>

        {game.playLink && (
          <p style={{ marginBottom: 8 }}>
            <a
              href={game.playLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#000000',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              Play Game
            </a>
          </p>
        )}

        {game.githubLink && (
          <p style={{ marginBottom: 8 }}>
            <a
              href={game.githubLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#000000',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              View on GitHub
            </a>
          </p>
        )}

        {game.slackId && game.slackUsername && (
          <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
            Created by:{' '}
            <a
              href={`https://slack.com/hackclub/${game.slackId}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#000000ff',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              {game.slackUsername}
            </a>
          </p>
        )}

        
      </div>

      <style jsx>{`
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
          transition: transform 120ms ease, opacity 120ms ease;
          display: block;
          margin: 7 auto 0;
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
