import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import GlobalGamesModal from '@/components/GlobalGamesModal';

const PostAttachmentRenderer = dynamic(() => import('@/components/utils/PostAttachmentRenderer'), { ssr: false });

function ShaderToyBackground() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#242424',
        pointerEvents: 'none',
        zIndex: 0
      }}
      aria-hidden
    />
  );
}

export default function GlobalGamesComponent({ token }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [displayCount, setDisplayCount] = useState(12);
  const [hasMore, setHasMore] = useState(true);
  const [selectedView, setSelectedView] = useState('global'); // 'global' | 'playtests'
  const circleRef = useRef(null);
  const [selectedPost, setSelectedPost] = useState(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (circleRef.current) {
        const globalArea = document.querySelector('.global-area');
        if (globalArea) {
          const globalRect = globalArea.getBoundingClientRect();
          const x = e.clientX - globalRect.left;
          const y = e.clientY - globalRect.top;

          if (x >= 0 && x <= globalRect.width && y >= 0 && y <= globalRect.height) {
            circleRef.current.style.display = 'block';
            circleRef.current.style.left = `${x}px`;
            circleRef.current.style.top = `${y}px`;
          } else {
            circleRef.current.style.display = 'none';
          }
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchPosts = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch('/api/GetAllPosts?limit=50');
        const data = await res.json().catch(() => []);
        if (!cancelled) {
          const normalized = Array.isArray(data)
            ? data.map((p) => ({
                createdAt: p['Created At'] || p.createdAt || '',
                PlayLink: typeof p.PlayLink === 'string' ? p.PlayLink : '',
                githubLink: typeof p.GitHub === 'string' ? p.GitHub : '',
                attachments: Array.isArray(p.Attachements) ? p.Attachements : [],
                slackId: p['slack id'] || '',
                gameName: p['Game Name'] || '',
                content: p.Content || '',
                postId: p.PostID || '',
                gameThumbnail: p.GameThumbnail || '',
              }))
            : [];

          // change to normalized
          setPosts(normalized);
          setHasMore(normalized.length >= 12);
        }
      } catch (e) {
        if (!cancelled) setError('Failed to load posts');
      } finally {
        if (!cancelled) setLoading(false);
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
  };

  if (loading) return (
    <div style={{ width: '100vw', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <ShaderToyBackground />
      <p style={{ position: 'relative', zIndex: 1, opacity: 0.6, textAlign: 'center', marginTop: '50vh' }}>Loading…</p>
    </div>
  );
  if (error) return (
    <div style={{ width: '100vw', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <ShaderToyBackground />
      <p style={{ position: 'relative', zIndex: 1, color: '#b00020', textAlign: 'center', marginTop: '50vh' }}>{error}</p>
    </div>
  );

  return (
    <div className="global-area" style={{ width: '100vw', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <div className="global-background"></div>
      <div className="purple-circle" ref={circleRef}></div>
      
      <div style={{ width: 1000, maxWidth: '100%', margin: '0 auto', position: 'relative', zIndex: 10, paddingTop: 20, paddingBottom: 40 }}>
        
        {/* View Selector */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: 12,
              padding: 4,
              background: 'rgba(255,255,255,0.1)',
            }}
          >
            <button
              type="button"
              style={{
                appearance: 'none',
                border: 0,
                background: selectedView === 'global' ? 'linear-gradient(180deg, #ff8ec3 0%, #ff6fa5 100%)' : 'rgba(255,255,255,0.2)',
                color: selectedView === 'global' ? '#fff' : 'rgba(255,255,255,0.8)',
                borderRadius: 9999,
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 14,
                transition: 'all 120ms ease',
              }}
              onClick={() => setSelectedView('global')}
            >
              Global Updates
            </button>
            <button
              type="button"
              style={{
                appearance: 'none',
                border: 0,
                background: selectedView === 'playtests' ? 'linear-gradient(180deg, #ff8ec3 0%, #ff6fa5 100%)' : 'rgba(255,255,255,0.2)',
                color: selectedView === 'playtests' ? '#fff' : 'rgba(255,255,255,0.8)',
                borderRadius: 9999,
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: 14,
                transition: 'all 120ms ease',
              }}
              onClick={() => setSelectedView('playtests')}
            >
              My Playtests
            </button>
          </div>
        </div>

        {selectedView === 'global' ? (
          <>
            <h1 style={{ textAlign: 'center', marginBottom: 2, color: '#fff' }}>Global Updates</h1>
            <p style={{ textAlign: 'center', marginBottom: 20, color: '#fff' }}>see the latest devlogs & demos posted in Shiba</p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 16,
                marginBottom: 20,
              }}
            >
              {posts.slice(0, displayCount).map((p, idx) => (
                <div
                  key={p.postId || idx}
                  style={{
                    border: '1px solid rgba(0,0,0,0.18)',
                    borderRadius: 10,
                    background: 'rgba(255,255,255,0.8)',
                    padding: 12,
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedPost(p)}
                >
                  <PostAttachmentRenderer
                    content={p.content}
                    attachments={p.attachments}
                    playLink={p.PlayLink}
                    gameName={p.gameName}
                    thumbnailUrl={p.gameThumbnail || ''}
                    slackId={p.slackId}
                    createdAt={p.createdAt}
                    token={token}
                    onPlayCreated={(play) => {
                      console.log('Play created:', play);
                    }}
                  />
                </div>
              ))}
            </div>
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <button
                  onClick={loadMore}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#ff6fa5',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Load More
                </button>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1 style={{ textAlign: 'center', marginBottom: 2, color: '#fff' }}>My Playtests</h1>
            <div style={{ 
              textAlign: 'center', 
              marginBottom: 30, 
              color: '#fff',
              maxWidth: 600,
              margin: '0 auto 30px auto',
              lineHeight: 1.6
            }}>
              <p style={{ marginBottom: 16, fontSize: 16 }}>
                You currently have <strong>0 playtest tickets</strong>.
              </p>
              <p style={{ marginBottom: 16, textAlign: 'left', fontSize: 14, opacity: 0.9 }}>
                You'll earn <strong>3 playtest tickets</strong> for every 10 hours of work on your project. You'll need to ship a demo for our Shiba HQ reivew team to try in order for us to grant you the tickets.
              </p>
              <p style={{ textAlign: 'left', fontSize: 14, opacity: 0.9 }}>
                With each playtest ticket, you'll review a game and your feedback will determine how many SSS tokens that person receives. The number of people assigned to your game will be based in part on the number of playtests you give others.
              </p>
            </div>
            <div style={{ 
              textAlign: 'center', 
              padding: 40, 
              maxWidth: 600,
              background: 'rgba(255,255,255,0.1)', 
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <p style={{ color: '#fff', opacity: 0.7, fontSize: 16 }}>
                No playtest tickets available yet. Keep building to earn your playtest tickets!
              </p>
            </div>
          </div>
        )}
      </div>

      <GlobalGamesModal
        post={selectedPost}
        token={token}
        onClose={() => setSelectedPost(null)}
      />

      <style jsx> {`
        .global-area {
          position: relative;
          overflow: hidden;
        }

        .global-background {
          background-color: #000;
          background-image: url('/landing/shiba.png');
          background-size: 60px;
          width: 100%;
          height: 100%;
          filter: brightness(0.1);
          position: absolute;
          z-index: 1;
          opacity: 1.0;
        }

        .purple-circle {
          position: absolute;
          width: 250px;
          height: 250px;
          background: radial-gradient(circle, rgba(255, 106, 225, 0.47) 5%,rgba(255, 106, 225, 0.17) 60%, transparent 80%);
          border-radius: 50%;
          pointer-events: none;
          mix-blend-mode: color-dodge;
          z-index: 2;
          transform: translate(-50%, -50%);
          display: none;
        }
      `}</style>
    </div>
  );
}
