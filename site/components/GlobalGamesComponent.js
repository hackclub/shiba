import { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import GlobalGamesModal from '@/components/GlobalGamesModal';

const PostAttachmentRenderer = dynamic(() => import('@/components/utils/PostAttachmentRenderer'), { ssr: false });
const PlaytestTicket = dynamic(() => import('@/components/PlaytestTicket'), { ssr: false });

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

export default function GlobalGamesComponent({ token, playtestMode, setPlaytestMode, setSelectedPlaytestGame }) {
  const [posts, setPosts] = useState([]);
  const [playtests, setPlaytests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playtestsLoading, setPlaytestsLoading] = useState(false);
  const [error, setError] = useState('');
  const [playtestsError, setPlaytestsError] = useState('');
  const [displayCount, setDisplayCount] = useState(12);
  const [hasMore, setHasMore] = useState(true);
  const [selectedView, setSelectedView] = useState('global'); // 'global' | 'playtests'
  const [playtestsFetched, setPlaytestsFetched] = useState(false);
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

  // Fetch playtests when switching to playtests view
  const fetchPlaytests = async () => {
    if (!token) return;
    
    try {
      setPlaytestsLoading(true);
      setPlaytestsError('');
      
      const res = await fetch('/api/GetMyPlaytests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setPlaytests(data.playtests || []);
        setPlaytestsFetched(true);
      } else {
        setPlaytestsError(data.message || 'Failed to fetch playtests');
      }
    } catch (error) {
      console.error('Error fetching playtests:', error);
      setPlaytestsError('Failed to fetch playtests');
    } finally {
      setPlaytestsLoading(false);
    }
  };

  // Fetch playtests when view changes to playtests and we haven't fetched them yet
  useEffect(() => {
    if (selectedView === 'playtests' && !playtestsFetched && !playtestsLoading) {
      fetchPlaytests();
    }
  }, [selectedView, playtestsFetched, playtestsLoading, token]);

  const loadMore = () => {
    const newCount = displayCount + 12;
    setDisplayCount(newCount);
    setHasMore(newCount < posts.length);
  };

  if (loading) return (
    <div style={{ width: '100vw', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>
      <ShaderToyBackground />
      <p style={{ position: 'relative', color: "#fff", zIndex: 1, opacity: 0.6, textAlign: 'center', marginTop: '50vh' }}>Loading…</p>
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
            <p style={{ textAlign: 'center', marginBottom: 20, color: '#fff' }}>view and complete your assigned playtests</p>
            
            {playtestsLoading ? (
              <div style={{ 
                textAlign: 'center', 
                padding: 40, 
                maxWidth: 600,
                background: 'rgba(255,255,255,0.1)', 
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <p style={{ color: '#fff', opacity: 0.7, fontSize: 16 }}>
                  Loading playtests...
                </p>
              </div>
            ) : playtestsError ? (
              <div style={{ 
                textAlign: 'center', 
                padding: 40, 
                maxWidth: 600,
                background: 'rgba(255,0,0,0.1)', 
                borderRadius: 12,
                border: '1px solid rgba(255,0,0,0.2)'
              }}>
                <p style={{ color: '#ff6b6b', fontSize: 16 }}>
                  {playtestsError}
                </p>
              </div>
            ) : playtests.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  marginBottom: 20,
                  width: '100%',
                  maxWidth: 1000,
                }}
              >
                {playtests.map((playtest, idx) => (
                  <PlaytestTicket 
                    key={playtest.id || idx} 
                    playtest={playtest} 
                    onPlaytestClick={(playtest) => {
                      if (setPlaytestMode && setSelectedPlaytestGame) {
                        setSelectedPlaytestGame({
                          gameName: playtest.gameName,
                          gameLink: playtest.gameLink,
                          gameThumbnail: playtest.gameThumbnail,
                          playtestId: playtest.playtestId,
                          instructions: playtest.instructions,
                          HoursSpent: playtest.HoursSpent,
                          ownerSlackId: playtest.ownerSlackId
                        });
                        setPlaytestMode(true);
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: 40, 
                maxWidth: 600,
                background: 'rgba(255,255,255,0.1)', 
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.2)'
              }}>
                <p style={{ color: '#fff', opacity: 0.7, fontSize: 16 }}>
                  No playtests assigned yet. Check back later!
                </p>
              </div>
            )}
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
