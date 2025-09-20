import { useEffect, useState, useRef, useMemo } from "react";
import dynamic from 'next/dynamic';
import CreateGameModal from "@/components/CreateGameModal";
import useAudioManager from "@/components/useAudioManager";
import TopBar from "@/components/TopBar";
import RadarChart from "@/components/RadarChart";
import { uploadGame as uploadGameUtil } from "@/components/utils/uploadGame";
import { uploadMiscFile } from "@/components/utils/uploadMiscFile";
import ArtlogPostForm from "@/components/ArtlogPostForm";

const PostAttachmentRenderer = dynamic(() => import('@/components/utils/PostAttachmentRenderer'), { ssr: false });

function ShaderToyBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) return;

    const vertexSource = `#version 300 es\nprecision highp float;\nvoid main(){\n  const vec2 verts[3] = vec2[3](vec2(-1.0,-1.0), vec2(3.0,-1.0), vec2(-1.0,3.0));\n  gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0);\n}`;

    const fragmentSource = `#version 300 es\nprecision highp float;\nout vec4 outColor;\nuniform vec3 iResolution;\nuniform float iTime;\n\n// Colors: top -> middle -> bottom\nconst vec3 TOP_COLOR = vec3(248.0, 216.0, 224.0) / 255.0;   // #F8D8E0\nconst vec3 MID_COLOR = vec3(207.0, 232.0, 255.0) / 255.0;   // pastel blue\nconst vec3 BOT_COLOR = vec3(255.0, 220.0, 195.0) / 255.0;   // pastel orange\n\nvoid mainImage(out vec4 fragColor, in vec2 fragCoord) {\n  vec2 uv = fragCoord / iResolution.xy;\n  float y = clamp(uv.y, 0.0, 1.0);\n\n  vec3 col;\n  if (y < 0.5) {\n    float t = smoothstep(0.0, 0.5, y);\n    col = mix(BOT_COLOR, MID_COLOR, t);\n  } else {\n    float t = smoothstep(0.5, 1.0, y);\n    col = mix(MID_COLOR, TOP_COLOR, t);\n  }\n\n  fragColor = vec4(col, 1.0);\n}\n\nvoid main(){\n  vec4 color;\n  mainImage(color, gl_FragCoord.xy);\n  outColor = color;\n}`;

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compile(gl.VERTEX_SHADER, vertexSource);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }

    gl.useProgram(program);
    const uResolution = gl.getUniformLocation(program, "iResolution");
    const uTime = gl.getUniformLocation(program, "iTime");

    let raf = 0;
    const start = performance.now();

    function resize() {
      const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const width = Math.floor(canvas.clientWidth * dpr);
      const height = Math.floor(canvas.clientHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform3f(uResolution, canvas.width, canvas.height, 1.0);
    }

    function frame() {
      raf = requestAnimationFrame(frame);
      resize();
      const t = (performance.now() - start) / 1000;
      gl.uniform1f(uTime, t);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    const onResize = () => resize();
    window.addEventListener("resize", onResize);
    frame();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      gl.useProgram(null);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
      aria-hidden
    />
  );
}

export default function MyGamesComponent({
  disableTopBar,
  setDisableTopBar,
  goHome,
  token,
  SlackId,
  onOpenProfile,
  profile,
}) {
  const [myGames, setMyGames] = useState([]);
  const [createGamePopupOpen, setCreateGamePopupOpen] = useState(false);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [visibleItemsCount, setVisibleItemsCount] = useState(0);
  const { play: playSound } = useAudioManager([
    "popSound.mp3",
    "loadingSound.mp3",
    "next.mp3",
    "prev.mp3",
  ]);
  const gridRef = useRef(null);
  const [gridStep, setGridStep] = useState({ x: 256, y: 256 });
  const [gridOffset, setGridOffset] = useState({ left: 16, top: 0 });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemsRefs = useRef([]);

  const [mySelectedGameId, setMySelectedGameId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Toggle top bar depending on whether a game is selected (detail view)
  useEffect(() => {
    try {
      if (typeof setDisableTopBar === "function") {
        setDisableTopBar(Boolean(mySelectedGameId));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    }
  }, [mySelectedGameId, setDisableTopBar]);

  useEffect(() => {
    let isMounted = true;
    const fetchMyGames = async () => {
      if (!token) {
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        playSound("loadingSound.mp3");
        const res = await fetch("/api/GetMyGames", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => []);
        if (!Array.isArray(data)) return;
        
        const normalized = data.map((g) => ({
          id: g.id || g.ID || null,
          name: g.name ?? g.Name ?? "",
          description: g.description ?? g.Description ?? "",
          thumbnailUrl: g.thumbnailUrl ?? "",
          GitHubURL: g.GitHubURL ?? "",
          ShowreelLink: g.ShowreelLink ?? "",
          HackatimeProjects: g.HackatimeProjects ?? "",
          AveragePlaytestSeconds: g.AveragePlaytestSeconds ?? 0,
          AverageFunScore: g.AverageFunScore ?? 0,
          AverageArtScore: g.AverageArtScore ?? 0,
          AverageCreativityScore: g.AverageCreativityScore ?? 0,
          AverageAudioScore: g.AverageAudioScore ?? 0,
          AverageMoodScore: g.AverageMoodScore ?? 0,
          numberComplete: g.numberComplete ?? 0,
          TicketsGiven: g.TicketsGiven ?? null,
          Feedback: g.Feedback ?? '',
          FeedbackStatus: g.FeedbackStatus ?? [],
          FeedbackMessage: g.FeedbackMessage ?? [],
          feedbackResponses: g.feedbackResponses ?? [],
          posts: Array.isArray(g.posts) ? g.posts.map(p => ({
            ...p,
            badges: Array.isArray(p.badges) ? p.badges : []
          })) : [],
          challenges: Array.isArray(g.challenges) ? g.challenges : [],
        }));
        
        if (isMounted) setMyGames(normalized);
      } catch (e) {
        console.error(e);
        // swallow for now
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    fetchMyGames();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Staggered reveal sequence for list view (includes the "+" card at the end)
  useEffect(() => {
    if (mySelectedGameId) return; // Only animate in list view
    const total = (Array.isArray(myGames) ? myGames.length : 0) + 1; // include "+"
    let cancelled = false;
    const timeouts = [];
    setVisibleItemsCount(0);
    const initialDelayMs = 500; // faster start
    const gapMs = 250; // 2x faster between items
    // playSound("popSound.mp3");

    for (let i = 0; i < total; i++) {
      const t = setTimeout(
        () => {
          if (cancelled) return;
          setVisibleItemsCount((current) => Math.max(current, i + 1));
        },
        initialDelayMs + i * gapMs,
      );
      timeouts.push(t);
    }
    return () => {
      cancelled = true;
      timeouts.forEach((t) => clearTimeout(t));
    };
  }, [myGames, mySelectedGameId]);

  // Fixed grid lines based on 240px squares and 16px gaps (no flex)
  useEffect(() => {
    setGridStep({ x: 240, y: 240 });
  }, []);

  // Reset/Clamp keyboard cursor when list changes or when leaving/entering list view
  useEffect(() => {
    if (mySelectedGameId) return; // only list view
    const total = (Array.isArray(myGames) ? myGames.length : 0) + 1; // include "+"
    if (selectedIndex >= total) {
      setSelectedIndex(Math.max(0, total - 1));
    } else if (total > 0 && selectedIndex < 0) {
      setSelectedIndex(0);
    } else if (total > 0 && selectedIndex === 0 && total === 1) {
      setSelectedIndex(0);
    }
  }, [myGames, mySelectedGameId, selectedIndex]);

  // Keyboard navigation for list view
  useEffect(() => {
    if (mySelectedGameId) return; // only in list view
    if (createGamePopupOpen) return; // pause when modal open

    const handleKeyDown = (e) => {
      const total = (Array.isArray(myGames) ? myGames.length : 0) + 1; // include plus
      if (total <= 0) return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        try {
          playSound("next.mp3");
        } catch (_) {}
        const next = (selectedIndex + 1) % total;
        setSelectedIndex(next);
        // scroll into view
        const node = itemsRefs.current[next];
        if (node && typeof node.scrollIntoView === "function") {
          node.scrollIntoView({
            block: "nearest",
            inline: "nearest",
            behavior: "smooth",
          });
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        try {
          playSound("prev.mp3");
        } catch (_) {}
        const prev = (selectedIndex - 1 + total) % total;
        setSelectedIndex(prev);
        const node = itemsRefs.current[prev];
        if (node && typeof node.scrollIntoView === "function") {
          node.scrollIntoView({
            block: "nearest",
            inline: "nearest",
            behavior: "smooth",
          });
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (selectedIndex < myGames.length) {
          const item = myGames[selectedIndex];
          if (item && item.id) setMySelectedGameId(item.id);
        } else {
          setCreateGamePopupOpen(true);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mySelectedGameId, createGamePopupOpen, myGames, selectedIndex]);

  const refresh = async () => {
    if (!token) return;
    try {
      setIsLoading(true);
      const res = await fetch("/api/GetMyGames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => []);
      if (Array.isArray(data)) {
        const normalized = data.map((g) => ({
          id: g.id || g.ID || null,
          name: g.name ?? g.Name ?? "",
          description: g.description ?? g.Description ?? "",
          thumbnailUrl: g.thumbnailUrl ?? "",
          GitHubURL: g.GitHubURL ?? "",
          ShowreelLink: g.ShowreelLink ?? "",
          HackatimeProjects: g.HackatimeProjects ?? "",
          AveragePlaytestSeconds: g.AveragePlaytestSeconds ?? 0,
          AverageFunScore: g.AverageFunScore ?? 0,
          AverageArtScore: g.AverageArtScore ?? 0,
          AverageCreativityScore: g.AverageCreativityScore ?? 0,
          AverageAudioScore: g.AverageAudioScore ?? 0,
          AverageMoodScore: g.AverageMoodScore ?? 0,
          numberComplete: g.numberComplete ?? 0,
          TicketsGiven: g.TicketsGiven ?? null,
          Feedback: g.Feedback ?? '',
          FeedbackStatus: g.FeedbackStatus ?? [],
          FeedbackMessage: g.FeedbackMessage ?? [],
          feedbackResponses: g.feedbackResponses ?? [],
          posts: Array.isArray(g.posts) ? g.posts.map(p => ({
            ...p,
            badges: Array.isArray(p.badges) ? p.badges : []
          })) : [],
          challenges: Array.isArray(g.challenges) ? g.challenges : [],
        }));
        setMyGames(normalized);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // Creation handled by CreateGameModal; just refresh after

  if (isLoading) {
    return (
      <div
        style={{
          width: "100vw",
          display: "flex",
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          maxWidth: "100vw",
          margin: "0 auto",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <ShaderToyBackground />
        <p style={{ position: "relative", opacity: 0.2, zIndex: 1 }}>
          Loading...
        </p>
      </div>
    );
  }



  return (
    <div>
      {mySelectedGameId ? (
        (() => {
          const selected = myGames.find((x) => x.id === mySelectedGameId);
          if (!selected) return null;
          return (
            <div
              style={{
                position: "relative",
                minHeight: "100vh",
                overflow: "hidden",
              }}
            >
              <ShaderToyBackground />
              <TopBar
                backgroundColor="rgba(255, 214, 224, 1)"
                title={selected.name || "Edit Game"}
                image="MyGames.png"
                onBack={() => setMySelectedGameId(null)}
              />
              <div style={{ paddingTop: 64, position: "relative", zIndex: 1 }}>
                <DetailView
                  game={selected}
                  onBack={() => setMySelectedGameId(null)}
                  token={token}
                  onUpdated={(updated) => {
                    setMyGames((prev) =>
                      prev.map((g) =>
                        g.id === updated.id ? { ...g, ...updated } : g,
                      ),
                    );
                  }}
                  SlackId={SlackId}
                  onOpenProfile={onOpenProfile}
                  profile={profile}
                  myGames={myGames}
                  setMyGames={setMyGames}
                />
              </div>
            </div>
          );
        })()
      ) : (
        <div
          style={{
            width: "100vw",
            margin: "0 auto",
            minHeight: "100vh",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <ShaderToyBackground />
          <div
            ref={gridRef}
            style={{
              display: "grid",
              paddingLeft: 16,
              paddingRight: 16,

              gridTemplateColumns: "repeat(auto-fill, 240px)",
              gap: 0,
              marginTop: 12,
              justifyContent: "start",
              position: "relative",
              zIndex: 1,
            }}
          >
            {myGames.map((g, idx) => {
              const title = g.name || "Untitled";
              const hasImage = Boolean(g.thumbnailUrl);
              return (
                <div
                  key={g.id || `${title}-${idx}`}
                  className={`pop-seq-item${visibleItemsCount > idx ? " visible" : ""}`}
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                  ref={(el) => {
                    itemsRefs.current[idx] = el;
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "240px",
                      aspectRatio: "1 / 1",
                      background: "rgba(255, 255, 255, 0.3)",
                      border:
                        selectedIndex === idx
                          ? "2px solid rgba(0, 0, 0, 0.8)"
                          : "1px solid rgba(0, 0, 0, 0.3)",
                      borderRadius: 4,
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: g.id ? "pointer" : "default",
                    }}
                    onMouseEnter={() => setHoverIndex(idx)}
                    onMouseLeave={() => setHoverIndex(null)}
                    onClick={() => {
                      if (g.id) setMySelectedGameId(g.id);
                    }}
                  >
                    {hasImage ? (
                      <img
                        src={g.thumbnailUrl}
                        alt={title}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      <span style={{ padding: 8, textAlign: "center" }}>
                        {title}
                      </span>
                    )}

                    {myGames.length > 1 && (
                      <div
                        style={{
                          display: hoverIndex === idx ? "flex" : "none",
                          position: "absolute",
                          top: 8,
                          right: 8,
                          cursor: "pointer",
                          justifyContent: "center",
                        }}
                      >
                        <button
                          style={{
                            fontSize: 12,
                            cursor: "pointer",
                            color: "#b00020",
                          }}
                          onClick={async (e) => {
                            e.stopPropagation();
                            const confirmText = `DELETE ${title}`;
                            const input = window.prompt(
                              `Type \"${confirmText}\" to confirm deletion`,
                            );
                            if (input !== confirmText) return;
                            try {
                              const res = await fetch("/api/deleteGame", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ token, gameId: g.id }),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (res.ok && data?.ok) {
                                await refresh();
                              }
                            } catch (e) {
                              console.error(e);
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div
              key="create-new"
              className={`pop-seq-item${visibleItemsCount > myGames.length ? " visible" : ""}`}
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
              ref={(el) => {
                itemsRefs.current[myGames.length] = el;
              }}
              onMouseEnter={() => setSelectedIndex(myGames.length)}
            >
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  aspectRatio: "1 / 1",
                  background: "rgba(255, 255, 255, 0.3)",
                  border:
                    selectedIndex === myGames.length
                      ? "2px solid rgba(0, 0, 0, 0.8)"
                      : "1px solid rgba(0, 0, 0, 0.3)",
                  borderRadius: 4,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
                onClick={() => {
                  setCreateGamePopupOpen(true);
                }}
                title="Create Game"
                aria-label="Create Game"
              >
                <span
                  style={{ fontSize: 40, lineHeight: 1, userSelect: "none" }}
                >
                  +
                </span>
              </div>
            </div>
          </div>
          <style jsx>{`
            .pop-seq-item {
              visibility: hidden;
              transform: scale(0);
            }
            .pop-seq-item.visible {
              visibility: visible;
              animation: popIn 500ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
            }
            @keyframes popIn {
              0% {
                transform: scale(0);
                opacity: 0;
              }
              60% {
                transform: scale(1.08);
                opacity: 1;
              }
              80% {
                transform: scale(0.98);
              }
              100% {
                transform: scale(1);
              }
            }
          `}</style>
        </div>
      )}

      <CreateGameModal
        isOpen={createGamePopupOpen}
        onClose={() => setCreateGamePopupOpen(false)}
        token={token}
        onCreated={refresh}
      />

      {/* <button onClick={() => {
        goHome();
        setDisableTopBar(false);
      }}>Go Home</button> */}
    </div>
  );
}

function DetailView({
  game,
  onBack,
  token,
  onUpdated,
  SlackId,
  onOpenProfile,
  profile,
  myGames,
  setMyGames,
}) {
  const [name, setName] = useState(game?.name || "");
  const [description, setDescription] = useState(game?.description || "");
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(game?.thumbnailUrl || "");
  const [previewUrl, setPreviewUrl] = useState(game?.thumbnailUrl || "");
  const [GitHubURL, setGitHubURL] = useState(game?.GitHubURL || "");
  const [ShowreelLink, setShowreelLink] = useState(game?.ShowreelLink || "");
  const [availableProjects, setAvailableProjects] = useState([]);
  const [projectsWithTime, setProjectsWithTime] = useState([]);
  const [selectedProjectsCsv, setSelectedProjectsCsv] = useState(
    game?.HackatimeProjects || "",
  );

  // Helper function to format time in hours and minutes
  const formatTime = (minutes) => {
    if (!minutes || minutes === 0) return '';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return mins > 0 ? `(${hours}h ${mins}m)` : `(${hours}h)`;
    }
    return `(${mins}m)`;
  };
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projectSearchTerm, setProjectSearchTerm] = useState("");
  const projectPickerContainerRef = useRef(null);
  const projectSearchInputRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [postContent, setPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [postMessage, setPostMessage] = useState("");
  const [postFiles, setPostFiles] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]); // Store uploaded file results
  const [uploadProgress, setUploadProgress] = useState({}); // Track upload progress
  const [isUploading, setIsUploading] = useState(false);
  const [isArtlogUploading, setIsArtlogUploading] = useState(false);
  const [postType, setPostType] = useState("moment"); // 'moment' | 'ship' | 'artlog'
  const [isDragging, setIsDragging] = useState(false);
  const [slackProfile, setSlackProfile] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const artlogFormRef = useRef(null);
  const MAX_TOTAL_BYTES = 50 * 1024 * 1024; // 50MB limit for misc files
  const totalAttachmentBytes = useMemo(
    () =>
      (postFiles || []).reduce(
        (sum, f) => sum + (typeof f.size === "number" ? f.size : 0),
        0,
      ),
    [postFiles],
  );
  const overTotalLimit = totalAttachmentBytes > MAX_TOTAL_BYTES;
  const [buildFile, setBuildFile] = useState(null);
  const [uploadAuthToken, setUploadAuthToken] = useState(
    process.env.NEXT_PUBLIC_UPLOAD_AUTH_TOKEN || "NeverTrustTheLiving#446",
  );
  const [userProfile, setUserProfile] = useState(null);
  const [feedbackResponses, setFeedbackResponses] = useState({});
  const [reportMessages, setReportMessages] = useState({});
  const [showReportForm, setShowReportForm] = useState({});

  // Refs for file inputs
  const buildFileInputRef = useRef(null);
  const momentsFileInputRef = useRef(null);

  // Key to force re-render of file inputs when needed
  const [fileInputKey, setFileInputKey] = useState(0);

  // Function to clear file inputs
  const clearFileInputs = () => {
    if (buildFileInputRef.current) buildFileInputRef.current.value = "";
    if (momentsFileInputRef.current) momentsFileInputRef.current.value = "";
    // Force re-render of file inputs
    setFileInputKey((prev) => prev + 1);
  };

  // Function to upload files to S3 when selected
  const uploadFilesToS3 = async (files) => {
    if (!files || files.length === 0) return;
    
    setIsUploading(true);
    const newUploadedFiles = [];
    const newProgress = {};
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
      
      try {
        // Set initial progress
        newProgress[fileKey] = 0;
        setUploadProgress({ ...newProgress });
        
        // Simulate progress updates during upload
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            const current = prev[fileKey] || 0;
            if (current < 90) {
              return { ...prev, [fileKey]: current + Math.random() * 10 };
            }
            return prev;
          });
        }, 200);
        
        // Upload file to S3
        const apiBase = process.env.NEXT_PUBLIC_API_BASE || "";
        const uploadResult = await uploadMiscFile({
          file: file,
          apiBase: apiBase,
        });
        
        // Clear progress interval
        clearInterval(progressInterval);
        
        if (uploadResult.ok) {
          newUploadedFiles.push({
            ...uploadResult,
            originalFile: file,
            fileKey: fileKey
          });
          
          // Set progress to 100%
          newProgress[fileKey] = 100;
          setUploadProgress({ ...newProgress });
        } else {
          console.error(`Upload failed for ${file.name}:`, uploadResult.error);
          // Set progress to error state
          newProgress[fileKey] = -1; // -1 indicates error
          setUploadProgress({ ...newProgress });
        }
      } catch (error) {
        console.error(`Upload error for ${file.name}:`, error);
        newProgress[fileKey] = -1; // -1 indicates error
        setUploadProgress({ ...newProgress });
      }
    }
    
    setUploadedFiles(newUploadedFiles);
    setIsUploading(false);
  };

  // Handle artlog post submission
  const handleArtlogSubmit = async (postData) => {
    if (!token || !game?.id) return;
    
    setIsPosting(true);
    setPostMessage("");
    
    try {
      const res = await fetch("/api/createPost", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                          token,
                          gameId: game.id,
                          content: postData.content,
                          postType: 'artlog',
                          timelapseVideoId: postData.timelapseVideoId,
                          githubImageLink: postData.githubImageLink,
                          timeScreenshotId: postData.timeScreenshotId,
                          hoursSpent: postData.hoursSpent,
                          minutesSpent: postData.minutesSpent
                        }),
      });
      
      const data = await res.json();
      
      if (data.ok) {
        setPostContent("");
        clearFileInputs();
        setPostType("moment"); // Reset to default
        
        // Add the new post to the game's posts array
        const newPost = {
          id: data.post?.id || undefined,
          postId: data.post?.PostID || undefined,
          content: data.post?.content || "",
          createdAt: data.post?.createdAt || new Date().toISOString(),
          PlayLink: typeof data.post?.PlayLink === "string" ? data.post.PlayLink : "",
          attachments: Array.isArray(data.post?.attachments) ? data.post.attachments : [],
          badges: Array.isArray(data.post?.badges) ? data.post.badges : [],
          postType: 'artlog',
          timelapseVideoId: data.post?.timelapseVideoId || "",
          githubImageLink: data.post?.githubImageLink || "",
          timeScreenshotId: data.post?.timeScreenshotId || "",
          hoursSpent: data.post?.hoursSpent || 0,
          minutesSpent: data.post?.minutesSpent || 0
        };
        
        onUpdated?.({
          id: game.id,
          posts: [newPost, ...(Array.isArray(game.posts) ? game.posts : [])],
        });
      } else {
        setPostMessage(`❌ Failed to post artlog: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      setPostMessage(`❌ Failed to post artlog: ${error.message}`);
    } finally {
      setIsPosting(false);
    }
  };

  useEffect(() => {
    setName(game?.name || "");
    setDescription(game?.description || "");
    setThumbnailUrl(game?.thumbnailUrl || "");
    setThumbnailFile(null);
    setPreviewUrl(game?.thumbnailUrl || "");
    setGitHubURL(game?.GitHubURL || "");
    setShowreelLink(game?.ShowreelLink || "");
    setSelectedProjectsCsv(game?.HackatimeProjects || "");
    setPostContent("");
    setPostMessage("");
    setProjectSearchTerm("");
    // Clear file inputs when switching games
    setBuildFile(null);
    setPostFiles([]);
    setUploadedFiles([]);
    setUploadProgress({});
    setIsUploading(false);
    setIsArtlogUploading(false);
    clearFileInputs();
    
    // Load existing feedback responses
    loadFeedbackResponses();
  }, [game?.id, game?.Feedback, game?.feedbackResponses]);

  const loadFeedbackResponses = () => {
    if (!game?.Feedback || !Array.isArray(game.Feedback) || game.Feedback.length === 0) {
      console.log("No feedback to load for game:", game?.id);
      return;
    }

    try {
      const responses = {};
      const messages = {};
      
      // Use the feedbackResponses array that's already processed by the API
      console.log("game.feedbackResponses:", game.feedbackResponses);
      if (game.feedbackResponses && Array.isArray(game.feedbackResponses)) {
        console.log("Processing feedbackResponses array with length:", game.feedbackResponses.length);
        game.feedbackResponses.forEach((feedbackResponse, index) => {
          const feedbackKey = `${game.id}-${index}`;
          console.log(`Processing feedback ${index}:`, {
            feedbackKey,
            feedbackResponse,
            response: feedbackResponse.response,
            responseMessage: feedbackResponse.responseMessage
          });
          
          // Convert "None" to null for consistency
          if (feedbackResponse.response && feedbackResponse.response !== "None") {
            responses[feedbackKey] = feedbackResponse.response;
            console.log(`Set response for ${feedbackKey}:`, feedbackResponse.response);
          }
          
          if (feedbackResponse.responseMessage && feedbackResponse.responseMessage !== "None") {
            messages[feedbackKey] = feedbackResponse.responseMessage;
            console.log(`Set message for ${feedbackKey}:`, feedbackResponse.responseMessage);
          }
        });
      } else {
        console.log("No feedbackResponses array found or it's not an array");
      }
      
      console.log("Setting feedback responses:", { responses, messages });
      console.log("Game object received:", {
        id: game.id,
        feedbackResponses: game.feedbackResponses,
        Feedback: game.Feedback
      });
      setFeedbackResponses(responses);
      setReportMessages(messages);
    } catch (error) {
      console.error("Error loading feedback responses:", error);
    }
  };

  useEffect(() => {
    // Fetch Hackatime projects via server proxy to avoid CORS
    const fetchProjects = async () => {
      console.log('Fetching projects for SlackId:', SlackId, 'and gameId:', game?.id);
      if (!SlackId) return;
      let url = `/api/hackatimeProjects?slackId=${encodeURIComponent(SlackId)}`;
      if (userProfile?.email) {
        url += `&email=${encodeURIComponent(userProfile.email)}`;
      }
      if (game?.id) {
        url += `&gameId=${encodeURIComponent(game.id)}`;
      }
      try {
        const res = await fetch(url);
        const json = await res.json().catch(() => ({}));
        const names = Array.isArray(json?.projects) ? json.projects : [];
        const projectsWithTimeData = Array.isArray(json?.projectsWithTime) ? json.projectsWithTime : [];
        console.log('Hackatime API response:', json);
        console.log('Projects with time:', projectsWithTimeData);
        setAvailableProjects(names);
        setProjectsWithTime(projectsWithTimeData);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    };
    fetchProjects();
  }, [SlackId, game?.id]);

  // Fetch user profile
  useEffect(() => {
    let cancelled = false;
    const fetchProfile = async () => {
      if (!token) return;
      try {
        const res = await fetch("/api/getMyProfile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.ok) {
          setUserProfile(data.profile || null);
        }
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    };
    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Fetch Slack displayName and image via cachet
  useEffect(() => {
    let cancelled = false;
    const fetchSlack = async () => {
      if (!SlackId) return;
      try {
        const res = await fetch(`/api/slackProfiles?slackId=${encodeURIComponent(SlackId)}`);
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

  // Close picker when clicking outside of the input/picker container
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!showProjectPicker) return;
      const node = projectPickerContainerRef.current;
      if (node && !node.contains(event.target)) {
        setShowProjectPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [showProjectPicker]);

  // When user selects a file or types a new URL, update the preview accordingly
  useEffect(() => {
    let objectUrl = null;
    if (thumbnailFile) {
      objectUrl = URL.createObjectURL(thumbnailFile);
      setPreviewUrl(objectUrl);
    } else if (thumbnailUrl) {
      setPreviewUrl(thumbnailUrl);
    } else {
      setPreviewUrl("");
    }
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [thumbnailFile, thumbnailUrl]);

  const hasChanges = useMemo(() => {
    const initialName = game?.name || "";
    const initialDescription = game?.description || "";
    const initialGitHub = game?.GitHubURL || "";
    const initialShowreel = game?.ShowreelLink || "";
    const initialProjects = game?.HackatimeProjects || "";
    const nameChanged = (name || "") !== initialName;
    const descriptionChanged = (description || "") !== initialDescription;
    const gitChanged = (GitHubURL || "") !== initialGitHub;
    const showreelChanged = (ShowreelLink || "") !== initialShowreel;
    const projectsChanged = (selectedProjectsCsv || "") !== initialProjects;
    const thumbnailChanged = Boolean(thumbnailFile);
    return (
      nameChanged ||
      descriptionChanged ||
      gitChanged ||
      showreelChanged ||
      projectsChanged ||
      thumbnailChanged
    );
  }, [
    game?.name,
    game?.description,
    game?.GitHubURL,
    game?.ShowreelLink,
    game?.HackatimeProjects,
    name,
    description,
    GitHubURL,
    ShowreelLink,
    selectedProjectsCsv,
    thumbnailFile,
  ]);

  const profileCompletionData = useMemo(() => {
    if (!userProfile) return { isComplete: false, missingFields: [] };

    const missingFields = [
      !userProfile.firstName && "First Name",
      !userProfile.lastName && "Last Name",
      !userProfile.email && "Email",
      !userProfile.githubUsername && "GitHub Username",
      !userProfile.birthday && "Birthday",
      !userProfile.phoneNumber && "Phone Number",
      !userProfile.slackId && "Slack Connection",
      !userProfile.address?.street1 && "Street Address",
      !userProfile.address?.city && "City",
      !userProfile.address?.state && "State/Province",
      !userProfile.address?.zipcode && "Zipcode",
      !userProfile.address?.country && "Country",
    ].filter(Boolean);

    return {
      isComplete: missingFields.length === 0,
      missingFields
    };
  }, [userProfile]);

  const isProfileComplete = profileCompletionData.isComplete;

  const handleUpdate = async () => {
    if (!token || !game?.id) return;
    setSaving(true);
    try {
      let uploadedUrl = thumbnailUrl;
      let thumbnailUpload = null;
      if (thumbnailFile) {
        // Convert selected file to base64 for direct Airtable content upload (<= 5MB)
        const toBase64 = (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve(String(reader.result).split(",")[1] || "");
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
          });
        const base64 = await toBase64(thumbnailFile);
        thumbnailUpload = {
          fileBase64: base64,
          contentType: thumbnailFile.type || "application/octet-stream",
          filename: thumbnailFile.name || "upload",
        };
      }
      const res = await fetch("/api/updateGame", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          gameId: game.id,
          name,
          description,
          thumbnailUrl: uploadedUrl,
          thumbnailUpload,
          GitHubURL,
          ShowreelLink,
          HackatimeProjects: selectedProjectsCsv,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ok && data?.game) {
        const updated = {
          id: game.id,
          name: data.game.name,
          description: data.game.description,
          thumbnailUrl: data.game.thumbnailUrl || uploadedUrl || "",
          GitHubURL: data.game.GitHubURL || GitHubURL || "",
          ShowreelLink: data.game.ShowreelLink || ShowreelLink || "",
          HackatimeProjects:
            data.game.HackatimeProjects || selectedProjectsCsv || "",
        };
        onUpdated?.(updated);
        // sync local input/preview/state to server response
        setName(updated.name);
        setDescription(updated.description);
        setThumbnailFile(null);
        setThumbnailUrl(updated.thumbnailUrl);
        setGitHubURL(updated.GitHubURL);
        setShowreelLink(updated.ShowreelLink);
        setSelectedProjectsCsv(updated.HackatimeProjects);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{ marginTop: 16, display: "flex", flexDirection: "row", gap: 16 }}
    >
      {/* Left column: existing form */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: 16,
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                document.getElementById("thumbnail-file-input")?.click();
              }
            }}
            onClick={() => {
              document.getElementById("thumbnail-file-input")?.click();
            }}
            title="Select Image"
            aria-label="Select Image"
            style={{
              width: 120,
              height: 120,
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "rgba(255,255,255,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="thumbnail"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: 12, opacity: 0.8 }}>Select Image</span>
            )}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              flex: 1,
            }}
          >
            <input
              className="nice-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Game Name"
            />
            <textarea
              className="nice-textarea"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Game Description"
            />
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#000",
            opacity: 0.9,
            marginTop: 6,
            lineHeight: 1.4,
          }}
        >
          Do these 3 quick steps: 1) join the{" "}
          <a
            href="https://slack.hackclub.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#ff6fa5",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Hack Club Slack
          </a>
          , 2) log in to{" "}
          <a
            href="https://hackatime.hackclub.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#ff6fa5",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Hackatime
          </a>{" "}
          with Slack, 3) install the{" "}
          <a
            href="http://godotengine.org/asset-library/asset/3484"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#ff6fa5",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Godot extension
          </a>{" "}
          to track time and earn playtest tickets.
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: "bold", color: "#333" }}>
            GitHub Repository
          </div>
          <input
            className="nice-input"
            type="text"
            value={GitHubURL}
            onChange={(e) => setGitHubURL(e.target.value)}
            placeholder="GitHub Link (https://github.com/{user}/{project})"
            onBlur={() => {
              const pattern =
                /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
              if (GitHubURL && !pattern.test(GitHubURL)) {
                alert("Please use format: https://github.com/{user}/{project}");
              }
            }}
          />
          <div style={{ fontSize: 14, fontWeight: "bold", color: "#333" }}>
            Showreel Demo
          </div>
          <input
            className="nice-input"
            type="text"
            value={ShowreelLink}
            onChange={(e) => setShowreelLink(e.target.value)}
            placeholder="Showreel Link"
          />
          <div
            style={{
              fontSize: 12,
              color: "#000",
              opacity: 0.7,
              lineHeight: 1.4,
            }}
          >
            Please share a 30-60 second youtube link to showcasing your game. Here are some examples:{" "}
            <a
              href="https://youtu.be/UAS_pUTFA7o?si=8NSmFMgGsB8LiOGb"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "#ff6fa5",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              https://youtu.be/UAS_pUTFA7o?si=8NSmFMgGsB8LiOGb
            </a>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          {/* Hackatime projects input with inline dropdown multi-select */}
          <div ref={projectPickerContainerRef} style={{ position: 'relative', flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: "bold", color: "#333", marginBottom: 8 }}>
              Hackatime Projects
            </div>
            <input
                className="nice-input"
                type="text"
                value={selectedProjectsCsv}
                readOnly
                placeholder="Hackatime Projects"
                style={{ width: '100%', paddingRight: 36 }}
                onClick={() => {
                  setShowProjectPicker((s) => !s);
                  // Auto-focus the search input when opening the dropdown
                  setTimeout(() => {
                    if (projectSearchInputRef.current) {
                      projectSearchInputRef.current.focus();
                    }
                  }, 0);
                }}
              />
            {showProjectPicker && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  width: "100%",
                  zIndex: 10,
                  border: "1px solid #ddd",
                  borderRadius: 4,
                  padding: 8,
                  background: "#fff",
                  maxHeight: 260,
                  overflow: "auto",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.28)",
                }}
              >
                {/* Search input */}
                <input
                  ref={projectSearchInputRef}
                  type="text"
                  placeholder="Search projects..."
                  value={projectSearchTerm}
                  onChange={(e) => setProjectSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '12px',
                    marginBottom: '8px',
                    boxSizing: 'border-box'
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                
                {/* Filtered projects */}
                {(() => {
                  const filteredProjects = availableProjects
                    .filter(name => name !== "Other") // Hide "Other" from the list
                    .filter(name =>
                      name.toLowerCase().includes(projectSearchTerm.toLowerCase())
                    );
                  
                  if (filteredProjects.length === 0) {
                    return (
                      <div style={{ opacity: 0.6, padding: '8px', textAlign: 'center' }}>
                        {availableProjects.length === 0 ? 'No projects found' : 'No projects match your search'}
                      </div>
                    );
                  }
                  
                  return filteredProjects.map((name, index) => {
                    const current = Array.from(new Set(selectedProjectsCsv.split(',').map((s) => s.trim()).filter(Boolean)));
                    const checked = current.includes(name);
                    const projectTime = projectsWithTime.find(p => p.name === name)?.time || 0;
                    const timeDisplay = formatTime(projectTime);
                    console.log(`Project: ${name}, Time: ${projectTime}, Display: ${timeDisplay}`);
                    return (
                      <div
                        key={name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 8px',
                          cursor: 'pointer',
                          borderTop: index === 0 ? 'none' : '1px solid #eee',
                        }}
                        onClick={(e) => {
                          // make entire row toggle
                          const set = new Set(current);
                          if (checked) set.delete(name); else set.add(name);
                          setSelectedProjectsCsv(Array.from(set).join(', '));
                        }}
                        role="checkbox"
                        aria-checked={checked}
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === ' ' || e.key === 'Enter') {
                            e.preventDefault();
                            const set = new Set(current);
                            if (checked) set.delete(name); else set.add(name);
                            setSelectedProjectsCsv(Array.from(set).join(', '));
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          style={{ pointerEvents: 'none' }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                          <span style={{ fontSize: 12, color: '#333' }}>{name}</span>
                          {timeDisplay && (
                            <span style={{ fontSize: 10, color: '#666', fontStyle: 'italic' }}>
                              {timeDisplay}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
        <input
          id="thumbnail-file-input"
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0] || null;
            setThumbnailFile(file);
          }}
        />
        {(hasChanges || saving) && (
          <button
            disabled={saving}
            onClick={handleUpdate}
            className="big-cta-btn"
          >
            {saving ? "Updating..." : "Update"}
          </button>
        )}

        {/* Game Radar Chart */}
        <div style={{ 
          marginTop: 24,
          backgroundColor: "rgba(255, 255, 255, 0.75)",
          borderRadius: 12,
          padding: 20,
          border: "1px solid rgba(0, 0, 0, 0.18)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
        }}>
          <h3 style={{ 
            fontSize: 16, 
            fontWeight: "bold", 
            marginBottom: 12,
            color: "#333",
            textAlign: "left"
          }}>
            Game Radar Chart
          </h3>
          <div style={{ 
            display: "flex", 
            justifyContent: "flex-start",
            marginBottom: 16
          }}>
                      <RadarChart
            data={[
              Math.round(game?.AverageFunScore || 0),
              Math.round(game?.AverageArtScore || 0),
              Math.round(game?.AverageCreativityScore || 0),
              Math.round(game?.AverageAudioScore || 0),
              Math.round(game?.AverageMoodScore || 0)
            ]}
            labels={["Fun", "Art", "Creativity", "Audio", "Mood"]}
            width={300}
            height={300}
            isMiniature={true}
          />
          </div>
          {game?.TicketsGiven != null && (
            <div style={{ 
              textAlign: "left",
              fontSize: 14,
              color: "#666",
              fontWeight: "500",
              marginBottom: 8
            }}>
              Playtests Given: {game.TicketsGiven} ({game?.numberComplete || 0} completed)
            </div>
          )}
          <div style={{ 
            textAlign: "left",
            fontSize: 14,
            color: "#666",
            fontWeight: "500",
            marginBottom: 8
          }}>
            Based on {game?.numberComplete || 0} people who playtested your game
          </div>
          <div style={{ 
            textAlign: "left",
            fontSize: 14,
            color: "#666",
            fontWeight: "500"
          }}>
            Average Playtest Time: {Math.round((game?.AveragePlaytestSeconds || 0) / 60)} minutes
          </div>
          
          {/* Feedback Section */}
          {game?.Feedback && Array.isArray(game.Feedback) && game.Feedback.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h4 style={{ 
                fontSize: 14, 
                fontWeight: "bold", 
                marginBottom: 8,
                color: "#333",
                textAlign: "left"
              }}>
                Feedback on your game:
              </h4>
              <div style={{ 
                textAlign: "left",
                fontSize: 13,
                color: "#555",
                lineHeight: 1.5,
                fontStyle: "italic"
              }}>
                {game.Feedback.map((feedback, index) => {
                  // Skip rendering if feedback is empty, but keep original index for responses
                  if (!feedback || typeof feedback !== 'string' || !feedback.trim()) {
                    return null;
                  }
                  
                  const feedbackKey = `${game.id}-${index}`;
                  const currentResponse = feedbackResponses[feedbackKey];
                  console.log(`Feedback ${index} (${feedbackKey}):`, {
                    currentResponse,
                    allResponses: feedbackResponses,
                    feedbackStatus: game.FeedbackStatus?.[index],
                    feedbackMessage: game.FeedbackMessage?.[index]
                  });
                  
                  return (
                    <div key={index} style={{ 
                      marginBottom: 8,
                      padding: "8px 12px",
                      backgroundColor: "rgba(255, 255, 255, 0.5)",
                      borderRadius: 8,
                      border: "1px solid rgba(0, 0, 0, 0.1)"
                    }}>
                      <div style={{ marginBottom: 8 }}>
                        {(() => {
                          // Handle null/undefined feedback
                          if (!feedback || typeof feedback !== 'string') {
                            return `"${feedback || ''}"`;
                          }
                          
                          // Split feedback by common category patterns
                          const categories = ['Additional Feedback:', 'Fun:', 'Art:', 'Creativity:', 'Audio:', 'Mood:'];
                          let formattedFeedback = feedback;
                          
                          // Find the first category that exists in the feedback
                          const firstCategoryIndex = categories.findIndex(cat => 
                            formattedFeedback.toLowerCase().includes(cat.toLowerCase())
                          );
                          
                          if (firstCategoryIndex !== -1) {
                            // Split by categories and format
                            const parts = [];
                            let currentText = formattedFeedback;
                            
                            categories.forEach((category, index) => {
                              const categoryLower = category.toLowerCase();
                              const textLower = currentText.toLowerCase();
                              
                              if (textLower.includes(categoryLower)) {
                                const categoryIndex = textLower.indexOf(categoryLower);
                                const beforeCategory = currentText.substring(0, categoryIndex).trim();
                                const afterCategory = currentText.substring(categoryIndex + category.length).trim();
                                
                                if (beforeCategory) {
                                  parts.push(beforeCategory);
                                }
                                
                                // Find the next category or end of text
                                let nextCategoryIndex = -1;
                                for (let i = index + 1; i < categories.length; i++) {
                                  const nextCategoryLower = categories[i].toLowerCase();
                                  const nextIndex = afterCategory.toLowerCase().indexOf(nextCategoryLower);
                                  if (nextIndex !== -1) {
                                    nextCategoryIndex = nextIndex;
                                    break;
                                  }
                                }
                                
                                const categoryContent = nextCategoryIndex !== -1 
                                  ? afterCategory.substring(0, nextCategoryIndex).trim()
                                  : afterCategory;
                                
                                parts.push({ category, content: categoryContent });
                                currentText = nextCategoryIndex !== -1 
                                  ? afterCategory.substring(nextCategoryIndex)
                                  : '';
                              }
                            });
                            
                            return (
                              <div>
                                {parts.map((part, partIndex) => {
                                  if (typeof part === 'string') {
                                    return (
                                      <div key={partIndex} style={{ marginBottom: '8px' }}>
                                        "{part}"
                                      </div>
                                    );
                                  } else {
                                    return (
                                      <div key={partIndex} style={{ marginBottom: '8px' }}>
                                        <strong>{part.category}</strong> {part.content}
                                      </div>
                                    );
                                  }
                                })}
                              </div>
                            );
                          } else {
                            // No categories found, display as regular text
                            return `"${feedback}"`;
                          }
                        })()}
                      </div>
                      <div style={{ 
                        display: "flex", 
                        gap: "12px", 
                        marginTop: "8px" 
                      }}>
                        <button
                          style={{
                            background: currentResponse === "Like" ? "#666" : "none",
                            border: "1px solid #ccc",
                            color: currentResponse === "Like" ? "#fff" : "#666",
                            textDecoration: "none",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "11px",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                          onClick={async () => {
                            const newResponse = currentResponse === "Like" ? null : "Like";
                            console.log("Like button clicked:", { feedbackKey, currentResponse, newResponse });
                            setFeedbackResponses(prev => ({
                              ...prev,
                              [feedbackKey]: newResponse
                            }));
                            
                            // Update in Airtable
                            try {
                              const res = await fetch("/api/updateFeedbackResponse", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ 
                                  token, 
                                  feedbackText: feedback, 
                                  response: newResponse 
                                }),
                              });
                              const data = await res.json();
                              console.log("Update response:", data);
                              if (!res.ok) {
                                console.error("Failed to update feedback response:", data.message);
                              }
                            } catch (error) {
                              console.error("Error updating feedback response:", error);
                            }
                          }}
                        >
                          <img 
                            src="/thumb_up.svg" 
                            alt="Like" 
                            style={{ 
                              width: "14px", 
                              height: "14px", 
                              filter: currentResponse === "Like" ? "brightness(0) invert(1)" : "opacity(0.6)" 
                            }} 
                          />
                          Like Feedback
                        </button>
                        <button
                          style={{
                            background: currentResponse === "Dislike" ? "#666" : "none",
                            border: "1px solid #ccc",
                            color: currentResponse === "Dislike" ? "#fff" : "#666",
                            textDecoration: "none",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "11px",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                          onClick={async () => {
                            const newResponse = currentResponse === "Dislike" ? null : "Dislike";
                            setFeedbackResponses(prev => ({
                              ...prev,
                              [feedbackKey]: newResponse
                            }));
                            
                            // Update in Airtable
                            try {
                              const res = await fetch("/api/updateFeedbackResponse", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ 
                                  token, 
                                  feedbackText: feedback, 
                                  response: newResponse 
                                }),
                              });
                              const data = await res.json();
                              if (!res.ok) {
                                console.error("Failed to update feedback response:", data.message);
                              }
                            } catch (error) {
                              console.error("Error updating feedback response:", error);
                            }
                          }}
                        >
                          <img 
                            src="/thumb_down.svg" 
                            alt="Dislike" 
                            style={{ 
                              width: "14px", 
                              height: "14px", 
                              filter: currentResponse === "Dislike" ? "brightness(0) invert(1)" : "opacity(0.6)" 
                            }} 
                          />
                          Dislike Feedback
                        </button>
                        <button
                          style={{
                            background: currentResponse === "Report" ? "#666" : "none",
                            border: "1px solid #ccc",
                            color: currentResponse === "Report" ? "#fff" : "#666",
                            textDecoration: "none",
                            padding: "4px 8px",
                            borderRadius: "4px",
                            cursor: "pointer",
                            fontSize: "11px",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            gap: "4px"
                          }}
                          onClick={async () => {
                            if (currentResponse === "Report") {
                              // If already reporting, deselect it
                              const newResponse = null;
                              setFeedbackResponses(prev => ({
                                ...prev,
                                [feedbackKey]: newResponse
                              }));
                              setShowReportForm(prev => ({
                                ...prev,
                                [feedbackKey]: false
                              }));
                              
                              // Update in Airtable
                              try {
                                const res = await fetch("/api/updateFeedbackResponse", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ 
                                    token, 
                                    feedbackText: feedback, 
                                    response: newResponse,
                                    responseMessage: null
                                  }),
                                });
                                const data = await res.json();
                                if (!res.ok) {
                                  console.error("Failed to update feedback response:", data.message);
                                }
                              } catch (error) {
                                console.error("Error updating feedback response:", error);
                              }
                            } else {
                              // If selecting Report, show the form
                              setShowReportForm(prev => ({
                                ...prev,
                                [feedbackKey]: true
                              }));
                            }
                          }}
                        >
                          <img 
                            src="/flag.svg" 
                            alt="Report" 
                            style={{ 
                              width: "14px", 
                              height: "14px", 
                              filter: currentResponse === "Report" ? "brightness(0) invert(1)" : "opacity(0.6)" 
                            }} 
                          />
                          Report Feedback
                        </button>
                      </div>
                      
                      {/* Report Form */}
                      {showReportForm[feedbackKey] && (
                        <div style={{ 
                          marginTop: "12px", 
                          padding: "12px", 
                          backgroundColor: "rgba(255, 255, 255, 0.8)",
                          borderRadius: "8px",
                          border: "1px solid rgba(0, 0, 0, 0.1)"
                        }}>
                          <div style={{ 
                            fontSize: "12px", 
                            fontWeight: "bold", 
                            marginBottom: "8px",
                            color: "#333"
                          }}>
                            Explain why you're reporting this post
                          </div>
                          <textarea
                            value={reportMessages[feedbackKey] || ""}
                            onChange={e => setReportMessages(prev => ({
                              ...prev,
                              [feedbackKey]: e.target.value
                            }))}
                            placeholder="Please explain why you're reporting this feedback..."
                            style={{
                              width: "100%",
                              minHeight: "60px",
                              padding: "8px",
                              border: "1px solid #ccc",
                              borderRadius: "4px",
                              fontSize: "12px",
                              fontFamily: "inherit",
                              resize: "vertical",
                              boxSizing: "border-box"
                            }}
                          />
                          <div style={{ 
                            display: "flex", 
                            gap: "8px", 
                            marginTop: "8px",
                            justifyContent: "flex-end"
                          }}>
                            <button
                              onClick={() => {
                                setShowReportForm(prev => ({
                                  ...prev,
                                  [feedbackKey]: false
                                }));
                                setReportMessages(prev => ({
                                  ...prev,
                                  [feedbackKey]: ""
                                }));
                              }}
                              style={{
                                background: "none",
                                border: "1px solid #ccc",
                                color: "#666",
                                padding: "6px 12px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "11px",
                                fontFamily: "inherit"
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={async () => {
                                const message = reportMessages[feedbackKey] || "";
                                if (!message.trim()) {
                                  alert("Please provide a reason for reporting this feedback.");
                                  return;
                                }
                                
                                // Set the response to "Report" and update in Airtable
                                setFeedbackResponses(prev => ({
                                  ...prev,
                                  [feedbackKey]: "Report"
                                }));
                                setShowReportForm(prev => ({
                                  ...prev,
                                  [feedbackKey]: false
                                }));
                                
                                try {
                                  const res = await fetch("/api/updateFeedbackResponse", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ 
                                      token, 
                                      feedbackText: feedback, 
                                      response: "Report",
                                      responseMessage: message.trim()
                                    }),
                                  });
                                  const data = await res.json();
                                  if (!res.ok) {
                                    console.error("Failed to update feedback response:", data.message);
                                    // Revert the state if API call failed
                                    setFeedbackResponses(prev => ({
                                      ...prev,
                                      [feedbackKey]: currentResponse
                                    }));
                                    setShowReportForm(prev => ({
                                      ...prev,
                                      [feedbackKey]: true
                                    }));
                                  }
                                } catch (error) {
                                  console.error("Error updating feedback response:", error);
                                  // Revert the state if API call failed
                                  setFeedbackResponses(prev => ({
                                    ...prev,
                                    [feedbackKey]: currentResponse
                                  }));
                                  setShowReportForm(prev => ({
                                    ...prev,
                                    [feedbackKey]: true
                                  }));
                                }
                              }}
                              style={{
                                background: "#666",
                                border: "1px solid #666",
                                color: "#fff",
                                padding: "6px 12px",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "11px",
                                fontFamily: "inherit"
                              }}
                            >
                              Submit Report
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          borderLeft: "1px solid #ccc",
          padding: 16,
          minHeight: "100vh",
        }}
      >
        {/* Game Challenges Section */}
        {(() => {
          // Get challenges for this specific game (already filtered by API)
          const gameChallenges = game.challenges || [];
          
          // Debug logging
          console.log('Game challenges data:', gameChallenges);
          gameChallenges.forEach((challenge, index) => {
            console.log(`Challenge ${index}:`, {
              status: challenge.status,
              earnableSSS: challenge.earnableSSS,
              sssEarned: challenge.sssEarned,
              challenge: challenge.challenge
            });
          });
          
          if (gameChallenges.length === 0) return null;
          
          return (
            <div style={{ 
              marginBottom: 24,
              backgroundColor: "rgba(255, 255, 255, 0.75)",
              borderRadius: 12,
              padding: 20,
              border: "1px solid rgba(0, 0, 0, 0.18)"
            }}>
              <h3 style={{ 
                fontSize: 16, 
                fontWeight: "bold", 
                marginBottom: 12,
                color: "#333",
                textAlign: "left"
              }}>
                Game Challenges ({gameChallenges.filter(c => c.status?.trim() === "Confirmed").length}/{gameChallenges.length})
              </h3>
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                maxHeight: "800px",
                overflowY: "auto"
              }}>
                {gameChallenges.map((challenge, index) => (
                  <div key={challenge.id || index} style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "12px",
                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                    borderRadius: "8px",
                    border: "1px solid rgba(0, 0, 0, 0.1)",
                    fontSize: "13px"
                  }}>
                    {/* iOS-style circular checkbox on the left */}
                    <div style={{ flexShrink: 0, marginTop: "2px" }}>
                      {challenge.status?.trim() === "Not Submitted" ? (
                        <button
                          onClick={async () => {
                            // Toggle the challenge status between "Not Submitted" and "Pending"
                            const updatedGames = myGames.map(g => {
                              if (g.id === game.id) {
                                return {
                                  ...g,
                                  challenges: g.challenges.map(c => 
                                    c.id === challenge.id 
                                      ? { ...c, status: c.status === "Not Submitted" ? "Pending" : "Not Submitted" }
                                      : c
                                  )
                                };
                              }
                              return g;
                            });
                            setMyGames(updatedGames);
                            
                            // Make API call to update the challenge status in Airtable
                            try {
                              const newStatus = challenge.status === "Not Submitted" ? "Pending" : "Not Submitted";
                              console.log('Making API call with:', {
                                token: token,
                                challengeId: challenge.airtableId,
                                status: newStatus,
                                challenge: challenge,
                                challengeKeys: Object.keys(challenge)
                              });
                              
                              const response = await fetch('/api/adjustGameChallenge', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  token: token,
                                  challengeId: challenge.airtableId,
                                  status: newStatus
                                }),
                              });
                              
                              if (!response.ok) {
                                console.error('Failed to update challenge status');
                              }
                            } catch (error) {
                              console.error('Error updating challenge status:', error);
                            }
                          }}
                          style={{
                            appearance: "none",
                            border: "2px solid #ccc",
                            background: "white",
                            borderRadius: "50%",
                            width: "20px",
                            height: "20px",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.borderColor = "#999";
                            e.target.style.transform = "scale(1.1)";
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.borderColor = "#ccc";
                            e.target.style.transform = "scale(1)";
                          }}
                        />
                      ) : challenge.status?.trim() === "Pending" ? (
                        <button
                          onClick={async () => {
                            // Toggle the challenge status between "Not Submitted" and "Pending"
                            const updatedGames = myGames.map(g => {
                              if (g.id === game.id) {
                                return {
                                  ...g,
                                  challenges: g.challenges.map(c => 
                                    c.id === challenge.id 
                                      ? { ...c, status: c.status === "Not Submitted" ? "Pending" : "Not Submitted" }
                                      : c
                                  )
                                };
                              }
                              return g;
                            });
                            setMyGames(updatedGames);
                            
                            // Make API call to update the challenge status in Airtable
                            try {
                              const newStatus = challenge.status === "Not Submitted" ? "Pending" : "Not Submitted";
                              console.log('Making API call with:', {
                                token: token,
                                challengeId: challenge.airtableId,
                                status: newStatus,
                                challenge: challenge,
                                challengeKeys: Object.keys(challenge)
                              });
                              
                              const response = await fetch('/api/adjustGameChallenge', {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  token: token,
                                  challengeId: challenge.airtableId,
                                  status: newStatus
                                }),
                              });
                              
                              if (!response.ok) {
                                console.error('Failed to update challenge status');
                              }
                            } catch (error) {
                              console.error('Error updating challenge status:', error);
                            }
                          }}
                          style={{
                            appearance: "none",
                            border: "2px solid #6c757d",
                            background: "#6c757d",
                            borderRadius: "50%",
                            width: "20px",
                            height: "20px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            position: "relative",
                            cursor: "pointer",
                            padding: 0
                          }}
                        >
                          {/* Green checkmark in the center */}
                          <div
                            style={{
                              width: "4px",
                              height: "4px",
                              background: "#28a745",
                              borderRadius: "50%"
                            }}
                          />
                        </button>
                      ) : null}
                    </div>
                    
                    {/* Challenge content on the right */}
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: "bold", 
                        marginBottom: "6px", 
                        color: challenge.status?.trim() === "Pending" ? "#999" : "#333",
                        textDecoration: challenge.status?.trim() === "Pending" ? "line-through" : "none"
                      }}>
                        {challenge.challenge}
                      </div>
                      <div style={{ 
                        display: "flex", 
                        gap: "16px", 
                        fontSize: "12px", 
                        color: challenge.status?.trim() === "Pending" ? "#999" : "#666"
                      }}>
                        <span><strong>Earnable:</strong> {challenge.earnableSSS} SSS</span>
                        <span><strong>Earned:</strong> {challenge.status?.trim() === "Confirmed" ? (challenge.sssEarned || challenge.earnableSSS) : 0} SSS</span>
                        <span><strong>Status:</strong> {challenge.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
        
        <p style={{ fontWeight: "bold" }}>Shiba Moments & Releases</p>

        <br />
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          Every 3–4 hours: post a Shiba Moment. Add a short note of what you
          added and a screenshot/GIF/video (up to 50MB).
        </p>
        <br />
        <p style={{ fontSize: 12, opacity: 0.7 }}>
          Every ~10 hours: ship a new demo. We'll try it, award play tickets
          based on your time, and send it to other hack clubbers in the
          community to playtest.
        </p>
        <p
          style={{
            fontSize: 11,
            opacity: 0.6,
            fontStyle: "italic",
            marginTop: 8,
            marginBottom: 8,
          }}
        >
          <strong>Demo Upload Tip:</strong> Upload a ZIP file containing your
          game. There must be an index.html file in the ZIP. Or upload a .html
          file that contains your entire game.
        </p>
        <p
          style={{
            fontSize: 11,
            opacity: 0.6,
            fontStyle: "italic",
            marginTop: 8,
            marginBottom: 8,
          }}
        >
          <strong>Extra demo upload debugging tips #1, 2 & 3:</strong> If you get 404 then reupload with these tips:
        </p>
        <ul
          style={{
            fontSize: 11,
            opacity: 0.6,
            fontStyle: "italic",
            marginTop: 4,
            marginBottom: 8,
            marginLeft: 16,
            paddingLeft: 8,
          }}
        >
          <li>Make sure you're uploading from Chrome</li>
          <li>You're uploading a zip of the files, not a zip of the folder. So there was issue in past where if you zip the folder and not the files, it wouldn't upload properly. If you're on mac select the files and then right click compress instead of selecting the folder itself.</li>
          <li>It's named index.html inside of the folder, not the nameOfYourGame.html</li>
        </ul>

        <p
          style={{
            fontSize: 11,
            opacity: 0.6,
            fontStyle: "italic",
            marginTop: 8,
            marginBottom: 8,
          }}
        >
          <strong>Artlog?!</strong> Upload a timelapse video, a screenshot of the time (eg. procreate canvas), and a link to the art asset in your Github repo to count time for art!
        </p>
        {isArtlogUploading && (
          <p style={{ fontSize: 11, color: "#1976d2", fontStyle: "italic", marginTop: 4, marginBottom: 8 }}>
            ⏳ Artlog files uploading... Please wait before posting.
          </p>
        )}
        <div style={{ marginTop: 16 }}>
          <div
            className={`moments-composer${isDragActive ? " drag-active" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              setIsDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragActive(false);
            }}
            onDrop={async (e) => {
              e.preventDefault();
              setIsDragActive(false);
              const incomingAll = Array.from(e.dataTransfer?.files || []);
              const incoming = incomingAll.filter((f) => {
                const t = (f.type || "").toLowerCase();
                // Allow images, videos, and audio for moments; disallow drops for ships
                return (
                  postType === "moment" &&
                  (t.startsWith("image/") ||
                    t.startsWith("video/") ||
                    t.startsWith("audio/"))
                );
              });
              if (incoming.length === 0) return;
              
              setPostFiles((prev) => {
                const byKey = new Map();
                const addAll = (arr) => {
                  for (const f of arr) {
                    const key = `${f.name}|${f.size}|${f.lastModified}`;
                    if (!byKey.has(key)) byKey.set(key, f);
                  }
                };
                addAll(prev || []);
                addAll(incoming);
                return Array.from(byKey.values());
              });
              
              // Upload new files to S3
              await uploadFilesToS3(incoming);
            }}
          >
            <textarea
              className="moments-textarea"
              placeholder={
                postType === "ship" && !isProfileComplete
                  ? `Complete missing profile fields to unlock demo posting: ${profileCompletionData.missingFields.join(", ")}`
                  : "Write what you added here..."
              }
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              disabled={postType === "ship" && !isProfileComplete}
              style={{
                opacity: postType === "ship" && !isProfileComplete ? 0.5 : 1,
                cursor:
                  postType === "ship" && !isProfileComplete
                    ? "not-allowed"
                    : "text",
              }}
              onPaste={async (e) => {
                // Only handle image paste for moments, not ships
                if (postType !== "moment") return;

                const items = Array.from(e.clipboardData.items);
                const imageItem = items.find((item) =>
                  item.type.startsWith("image/"),
                );

                if (imageItem) {
                  e.preventDefault(); // Prevent default paste behavior for images

                  const file = imageItem.getAsFile();
                  if (file) {
                    // Check file size (5MB limit)
                    if (file.size > 5 * 1024 * 1024) {
                      alert(
                        "Pasted image is too large. Please use an image under 5MB.",
                      );
                      return;
                    }

                    // Add the pasted image to postFiles
                    setPostFiles((prev) => {
                      const byKey = new Map();
                      const addAll = (arr) => {
                        for (const f of arr) {
                          const key = `${f.name}|${f.size}|${f.lastModified}`;
                          if (!byKey.has(key)) byKey.set(key, f);
                        }
                      };
                      addAll(prev || []);
                      addAll([file]);
                      return Array.from(byKey.values());
                    });
                    
                    // Upload the pasted file to S3
                    await uploadFilesToS3([file]);
                  }
                }
                // For non-image items, let the default paste behavior happen
              }}
            />
            {/* Previews */}
            {Array.isArray(postFiles) && postFiles.length > 0 && (
              <div className="moments-previews">
                {postFiles.map((file, idx) => {
                  const fileKey = `${file.name}-${file.size}-${file.lastModified}`;
                  const progress = uploadProgress[fileKey] || 0;
                  const uploadedFile = uploadedFiles.find(uf => uf.fileKey === fileKey);
                  const url = uploadedFile?.url || URL.createObjectURL(file);
                  const type = (file.type || "").split("/")[0];
                  const isUploading = progress > 0 && progress < 100;
                  const hasError = progress === -1;
                  
                  return (
                    <div
                      key={fileKey}
                      className="moments-preview-item"
                    >
                      {type === "video" ? (
                        <video
                          src={url}
                          className="moments-preview-media"
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={url}
                          alt={file.name || ""}
                          className="moments-preview-media"
                        />
                      )}
                      
                      {/* Upload Progress Overlay */}
                      {isUploading && (
                        <div className="upload-progress-overlay">
                          <div className="upload-progress-bar">
                            <div 
                              className="upload-progress-fill"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div className="upload-progress-text">
                            {Math.round(progress)}%
                          </div>
                        </div>
                      )}
                      
                      <button
                        type="button"
                        className="moments-remove-btn"
                        title="Remove"
                        onClick={() => {
                          setPostFiles((prev) =>
                            prev.filter((_, i) => i !== idx),
                          );
                          setUploadedFiles((prev) =>
                            prev.filter(uf => uf.fileKey !== fileKey)
                          );
                          setUploadProgress((prev) => {
                            const newProgress = { ...prev };
                            delete newProgress[fileKey];
                            return newProgress;
                          });
                          if (!uploadedFile) {
                            URL.revokeObjectURL(url);
                          }
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="moments-footer">
              {/* Attachment control: depends on postType */}
              {postType === "ship" ? (
                <>
                  <input
                    key={`build-file-${fileInputKey}`}
                    ref={buildFileInputRef}
                    type="file"
                    accept=".zip"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file =
                        (e.target.files && e.target.files[0]) || null;
                      console.log("Build file selected:", file?.name);

                      // Validate file extension
                      if (file && !file.name.toLowerCase().endsWith(".zip")) {
                        alert(
                          "❌ Invalid file format!\n\nPlease select a .zip file from your Godot HTML5 export.\n\nIn Godot: Project → Export → Web → Export Project → Export as HTML5",
                        );
                        e.target.value = "";
                        setBuildFile(null);
                        return;
                      }

                      setBuildFile(file);
                    }}
                  />
                  <button
                    type="button"
                    className="moments-attach-btn"
                    onClick={() => {
                      console.log(
                        "Build file button clicked, ref exists:",
                        !!buildFileInputRef.current,
                      );
                      buildFileInputRef.current?.click();
                    }}
                    title="Upload a .zip file from Godot HTML5 export (Project → Export → Web → Export as HTML5)"
                  >
                    {buildFile
                      ? `Selected: ${buildFile.name}`
                      : "Upload Godot Web Build (.zip)"}
                  </button>
                  <input type="hidden" value={uploadAuthToken} readOnly />
                </>
              ) : postType === "artlog" ? (
                <ArtlogPostForm
                  ref={artlogFormRef}
                  onSubmit={handleArtlogSubmit}
                  onCancel={() => setPostType("moment")}
                  postContent={postContent}
                  setPostContent={setPostContent}
                  isPosting={isPosting}
                  setIsPosting={setIsPosting}
                  setPostMessage={setPostMessage}
                  onUploadStateChange={(isUploading) => {
                    console.log('Artlog upload state changed:', isUploading);
                    setIsArtlogUploading(isUploading);
                    
                    // Also log the current state for debugging
                    console.log('Current artlog upload state:', isUploading);
                    console.log('Post button should be disabled:', isPosting || isUploading || isArtlogUploading);
                  }}
                />
              ) : (
                <>
                  <input
                    key={`moments-file-${fileInputKey}`}
                    ref={momentsFileInputRef}
                    type="file"
                    accept="image/*,video/*,audio/*,.mp3,.mp4,.gif,.mov,.wav,.ogg,.m4a,.aac"
                    style={{ display: "none" }}
                    onChange={async (e) => {
                      const f = (e.target.files && e.target.files[0]) || null;
                      console.log("Moments file selected:", f?.name);

                      // Validate file type for moments
                      if (f) {
                        const validTypes = ["image/", "video/", "audio/"];
                        const isValidType = validTypes.some((type) =>
                          f.type.startsWith(type),
                        );
                        if (!isValidType) {
                          alert(
                            "❌ Invalid file type!\n\nPlease select an image, video, or audio file for your Shiba Moment.",
                          );
                          e.target.value = "";
                          return;
                        }
                      }

                      setPostFiles(f ? [f] : []);
                      setUploadedFiles([]); // Clear previous uploads
                      setUploadProgress({}); // Clear progress
                      
                      // Upload file to S3 if selected
                      if (f) {
                        await uploadFilesToS3([f]);
                      }
                      
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className="moments-attach-btn"
                    onClick={() => {
                      console.log(
                        "Moments file clicked, ref exists:",
                        !!momentsFileInputRef.current,
                      );
                      momentsFileInputRef.current?.click();
                    }}
                  >
                    {postFiles.length
                      ? `Selected: ${postFiles[0].name}`
                      : "Upload Screenshots"}
                  </button>
                </>
              )}
              <div className="moments-footer-spacer" />
              {/* Visual toggle: Shiba Moment vs Shiba Ship vs Artlog */}
              <div
                className="moment-type-toggle"
                role="tablist"
                aria-label="Post type"
              >
                <button
                  type="button"
                  className={`moment-type-option${postType === "moment" ? " active" : ""}`}
                  aria-selected={postType === "moment"}
                  onClick={() => {
                    setPostType("moment");
                    setBuildFile(null);
                    setPostFiles([]);
                    setIsArtlogUploading(false);
                    clearFileInputs();
                  }}
                >
                  Devlog
                </button>
                <button
                  type="button"
                  className={`moment-type-option${postType === "ship" ? " active" : ""}`}
                  aria-selected={postType === "ship"}
                  onClick={() => {
                    setPostType("ship");
                    setBuildFile(null);
                    setPostFiles([]);
                    setIsArtlogUploading(false);
                    clearFileInputs();
                  }}
                >
                  Demo
                </button>
                <button
                  type="button"
                  className={`moment-type-option${postType === "artlog" ? " active" : ""}`}
                  aria-selected={postType === "artlog"}
                  onClick={() => {
                    setPostType("artlog");
                    setBuildFile(null);
                    setPostFiles([]);
                    setIsArtlogUploading(false);
                    // Don't clear file inputs for artlog - let the form handle its own state
                  }}
                >
                  Artlog
                </button>
              </div>
              <button
                className="moments-post-btn"
                disabled={
                  isPosting || 
                  isUploading || 
                  isArtlogUploading ||
                  (postType === "moment" && postFiles.length > 0 && uploadedFiles.length === 0) ||
                  (postType === "ship" && !isProfileComplete) ||
                  (postType === "artlog" && (!postContent.trim() || !artlogFormRef.current))
                }
                onClick={async () => {
                  if (!token || !game?.id || !postContent.trim()) return;
                  if (postType === "moment" && postFiles.length === 0) {
                    alert(
                      "Add a media file (image/video/audio) of what you added in this update",
                    );
                    return;
                  }
                  if (postType === "artlog") {
                    // For artlog posts, validate the form and submit
                    if (!artlogFormRef.current) {
                      alert("Artlog form not ready");
                      return;
                    }
                    
                    const artlogData = artlogFormRef.current.getFormData();
                    if (!artlogData) {
                      return; // Validation errors will be shown by the form
                    }
                    
                    // Submit the artlog post
                    await handleArtlogSubmit(artlogData);
                    return;
                  }
                  if (postType === "ship") {
                    if (!isProfileComplete) {
                      alert(
                        `You must complete your profile before uploading your demo. Missing fields: ${profileCompletionData.missingFields.join(", ")}. See your profile on the top left corner of the main Shiba Homescreen.`,
                      );
                      return;
                    }
                    if (!game?.GitHubURL || game.GitHubURL.trim() === "") {
                      alert(
                        "You must update your game to have a GitHub Repository to upload your demo. All games in Shiba must be open-sourced.",
                      );
                      return;
                    }
                    if (!buildFile || !uploadAuthToken) {
                      alert(
                        "Zip your godot web build and add it here with a msg of what you added!",
                      );
                      return;
                    }
                  }
                  
                  setIsPosting(true);
                  setPostMessage("");
                  try {
                    let contentToSend = postContent.trim();
                    let attachmentsUpload = undefined;
                    if (postType === "ship" && buildFile) {
                      const apiBase = process.env.NEXT_PUBLIC_API_BASE || "";
                      const uploadResp = await uploadGameUtil({
                        file: buildFile,
                        name: game?.name || "game",
                        token: uploadAuthToken,
                        apiBase,
                      });
                      if (!uploadResp.ok) {
                        if (uploadResp.validationError && uploadResp.details) {
                          // Show detailed validation error with guidance
                          alert(
                            `Upload Failed: ${uploadResp.error}\n\n${uploadResp.details}`,
                          );
                        } else {
                          setPostMessage(
                            `Upload failed: ${uploadResp.error || "Unknown error"}`,
                          );
                        }
                        setIsPosting(false);
                        return;
                      }
                      const absolutePlayUrl = apiBase
                        ? `${apiBase}${uploadResp.playUrl}`
                        : uploadResp.playUrl;
                      var playLink = absolutePlayUrl;
                    }
                    // For moments, use the already uploaded files
                    if (postType === "moment" && postFiles.length) {
                      const f = postFiles[0];
                      const fileKey = `${f.name}-${f.size}-${f.lastModified}`;
                      const uploadedFile = uploadedFiles.find(uf => uf.fileKey === fileKey);
                      
                      if (!uploadedFile) {
                        setPostMessage("Please wait for file upload to complete");
                        setIsPosting(false);
                        return;
                      }
                      
                      // Use the uploaded file URL as an attachment
                      attachmentsUpload = [
                        {
                          url: uploadedFile.url,
                          type: f.type || "application/octet-stream",
                          contentType: f.type || "application/octet-stream",
                          filename: f.name || "attachment",
                          id: uploadedFile.fileId,
                          size: f.size
                        },
                      ];
                    }
                    const res = await fetch("/api/createPost", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        token,
                        gameId: game.id,
                        content: contentToSend,
                        attachmentsUpload,
                        playLink,
                      }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok && data?.ok) {
                      setPostContent("");
                      setBuildFile(null);
                      setPostFiles([]);
                      setPostMessage("Posted!");
                      setTimeout(() => setPostMessage(""), 2000);

                      // If this was a Demo post, sync with YSWSDB
                      if (postType === "ship") {
                        try {
                          await fetch("/api/SyncUserWithYSWSDB", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              token,
                              gameId: game.id,
                              githubUrl: game.GitHubURL,
                              playLink: playLink,
                            }),
                          });
                        } catch (syncError) {
                          console.error(
                            "Failed to sync with YSWSDB:",
                            syncError,
                          );
                          // Don't fail the post if sync fails
                        }
                      }

                      // Update parent state with the new post for this game
                      const newPost = {
                        id: data.post?.id || undefined,
                        postId: data.post?.PostID || undefined,
                        content: data.post?.content || "",
                        createdAt:
                          data.post?.createdAt || new Date().toISOString(),
                        PlayLink:
                          typeof data.post?.PlayLink === "string"
                            ? data.post.PlayLink
                            : "",
                        attachments: Array.isArray(data.post?.attachments)
                          ? data.post.attachments
                          : [],
                        badges: Array.isArray(data.post?.badges) ? data.post.badges : [],
                      };
                      onUpdated?.({
                        id: game.id,
                        posts: [
                          newPost,
                          ...(Array.isArray(game.posts) ? game.posts : []),
                        ],
                      });
                    } else {
                      setPostMessage(data?.message || "Failed to post");
                      // Clear file inputs on failure
                      setBuildFile(null);
                      setPostFiles([]);
                      clearFileInputs();
                    }
                  } catch (e) {
                    // eslint-disable-next-line no-console
                    console.error(e);
                    setPostMessage("Failed to post");
                    // Clear file inputs on error
                    setBuildFile(null);
                    setPostFiles([]);
                    clearFileInputs();
                  } finally {
                    setIsPosting(false);
                  }
                }}
              >
                {isPosting
                  ? postType === "ship"
                    ? "Shipping…"
                    : "Posting…"
                  : isUploading || isArtlogUploading
                    ? "Uploading…"
                    : overTotalLimit
                      ? "Files exceed 50MB"
                      : postType === "ship"
                        ? "Ship"
                        : "Post"}
              </button>
            </div>
          </div>
          {overTotalLimit ? (
            <p style={{ marginTop: 8, color: "#b00020" }}>
              Total files must be under 50MB. Try removing some files or
              using smaller ones.
            </p>
          ) : null}
          {postType === "ship" && !isProfileComplete && (
            <div
              style={{
                marginTop: 8,
                padding: "12px",
                backgroundColor: "white",
                border: "2px solid #b00020",
                borderRadius: "8px",
                fontSize: "12px",
                color: "#b00020",
                fontWeight: "bold",
              }}
            >
              ⚠️ Missing profile fields: {profileCompletionData.missingFields.join(", ")}.{" "}
              <button
                onClick={() => {
                  onBack();
                  if (onOpenProfile) {
                    onOpenProfile();
                  }
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ff6fa5",
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0,
                  font: "inherit",
                  fontSize: "inherit",
                  fontWeight: "bold",
                }}
              >
                Complete your profile
              </button>{" "}
              to unlock demo posting
            </div>
          )}
          {postMessage ? (
            <p style={{ marginTop: 8, opacity: 0.7 }}>{postMessage}</p>
          ) : null}
          {Array.isArray(game.posts) && game.posts.length > 0 && (
            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {game.posts
                .sort((a, b) => {
                  // Sort by createdAt in descending order (newest first)
                  const dateA = new Date(a.createdAt || a.createdTime || 0);
                  const dateB = new Date(b.createdAt || b.createdTime || 0);
                  return dateB - dateA;
                })
                .map((p, pIdx) => (
                  <div key={p.id || pIdx} className="moment-card" style={{ position: "relative" }}>
                    {(() => {
                    // Check if post was created within the last 24 hours
                    const postDate = new Date(p.createdAt);
                    const now = new Date();
                    const hoursDiff = (now - postDate) / (1000 * 60 * 60);
                    const isWithin24Hours = hoursDiff <= 24;
                    
                    return isWithin24Hours ? (
                      <button
                        style={{
                          position: "absolute",
                          top: 8,
                          right: 8,
                          fontSize: 12,
                          cursor: "pointer",
                          color: "#b00020",
                          background: "none",
                          border: "none",
                          padding: "4px 8px",
                          borderRadius: "4px",
                          opacity: 0.7,
                          transition: "opacity 0.2s ease",
                          zIndex: 1,
                        }}
                        onMouseEnter={(e) => (e.target.style.opacity = "1")}
                        onMouseLeave={(e) => (e.target.style.opacity = "0.7")}
                        onClick={async () => {
                          const confirmText = `DELETE POST`;
                          const input = window.prompt(
                            `Type "${confirmText}" to confirm deletion`,
                          );
                          if (input !== confirmText) return;

                          try {
                            const res = await fetch("/api/deletePost", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ token, postId: p.id }),
                            });
                            const data = await res.json().catch(() => ({}));
                            if (res.ok && data?.ok) {
                              // Remove the post from local state
                              const updatedPosts = game.posts.filter(
                                (_, index) => index !== pIdx,
                              );
                              onUpdated?.({ id: game.id, posts: updatedPosts });
                            } else {
                              alert("Failed to delete post");
                            }
                          } catch (e) {
                            console.error(e);
                            alert("Failed to delete post");
                          }
                        }}
                      >
                        Delete
                      </button>
                    ) : null;
                  })()}
                  <PostAttachmentRenderer
                    content={p.content}
                    attachments={p.attachments}
                    playLink={p.PlayLink}
                    gameName={game?.name || ""}
                    thumbnailUrl={game?.thumbnailUrl || ""}
                    token={token}
                    slackId={SlackId}
                    createdAt={p.createdAt}
                    badges={p.badges}
                    gamePageUrl={`https://shiba.hackclub.com/games/${SlackId}/${encodeURIComponent(game?.name || '')}`}
                    onPlayCreated={(play) => {
                      console.log("Play created:", play);
                    }}
                    postType={p.postType}
                    timelapseVideoId={p.timelapseVideoId}
                    githubImageLink={p.githubImageLink}
                    timeScreenshotId={p.timeScreenshotId}
                    HoursSpent={p.HoursSpent}
                    hoursSpent={p.hoursSpent}
                    timeSpentOnAsset={p.timeSpentOnAsset}
                    minutesSpent={p.minutesSpent}
                    postId={p.PostID}
                    currentUserProfile={profile}
                    onTimeUpdated={(postId, newTime) => {
                      // Update the game's posts in the parent component
                      onUpdated({
                        ...game,
                        posts: game.posts.map(post => 
                          post.PostID === postId 
                            ? { ...post, timeSpentOnAsset: newTime }
                            : post
                        )
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <style jsx>{`
        .moments-composer {
          border: 1px solid rgba(0, 0, 0, 0.18);
          border-radius: 10px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.75);
          transition:
            border-color 120ms ease,
            box-shadow 120ms ease,
            background 120ms ease;
        }
        .moments-composer.drag-active {
          border-color: rgba(0, 0, 0, 0.35);
          box-shadow: 0 0 0 3px rgba(255, 111, 165, 0.25);
          background: rgba(255, 255, 255, 0.85);
        }
        .moment-card {
          border: 1px solid rgba(0, 0, 0, 0.18);
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.8);
          padding: 12px;
        }
        .slack-avatar {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          border: 1px solid rgba(0, 0, 0, 0.18);
          background-size: cover;
          background-position: center;
          background-color: #fff;
        }
        .moments-previews {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          padding: 8px;
          background: rgba(255, 255, 255, 0.65);
          border-bottom: 1px solid rgba(0, 0, 0, 0.12);
        }
        .moments-preview-item {
          position: relative;
          width: 88px;
          height: 88px;
          border: 1px solid #ddd;
          border-radius: 6px;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.85);
        }
        .moments-preview-media {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .moments-remove-btn {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 18px;
          height: 18px;
          line-height: 18px;
          border-radius: 9999px;
          border: 1px solid rgba(0, 0, 0, 0.18);
          background: rgba(255, 255, 255, 0.9);
          color: rgba(0, 0, 0, 0.8);
          cursor: pointer;
          font-size: 12px;
          padding: 0;
        }
        .moments-textarea {
          width: 100%;
          min-height: 120px;
          resize: vertical;
          font-size: 14px;
          box-sizing: border-box;
          padding: 10px;
          outline: none;
          border: 0;
          border-bottom: 1px solid rgba(0, 0, 0, 0.12);
          border-radius: 10px 10px 0 0;
          background: transparent;
        }
        .moments-footer {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background: rgba(255, 255, 255, 0.65);
          border-radius: 0 0 10px 10px;
        }
        .moment-type-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-right: 6px;
          border: 1px solid rgba(0, 0, 0, 0.18);
          border-radius: 12px;
          padding: 4px;
          background: rgba(255, 255, 255, 0.85);
        }
        .moment-type-option {
          appearance: none;
          border: 0;
          background: rgba(255, 255, 255, 0.75);
          color: rgba(0, 0, 0, 0.8);
          border-radius: 9999px;
          padding: 6px 10px;
          cursor: pointer;
          font-weight: 700;
          font-size: 12px;
        }
        .moment-type-option.active {
          border: 0;
          color: #fff;
          background: linear-gradient(180deg, #ff8ec3 0%, #ff6fa5 100%);
        }
        .moments-footer-spacer {
          flex: 1;
        }
        .moments-attach-btn {
          appearance: none;
          border: 1px solid rgba(0, 0, 0, 0.18);
          background: rgba(255, 255, 255, 0.75);
          color: rgba(0, 0, 0, 0.8);
          border-radius: 8px;
          padding: 8px 10px;
          cursor: pointer;
          font-weight: 600;
          font-size: 12px;
        }
        .moments-post-btn {
          appearance: none;
          border: 0;
          background: linear-gradient(180deg, #ff8ec3 0%, #ff6fa5 100%);
          color: #fff;
          border-radius: 10px;
          padding: 10px 14px;
          cursor: pointer;
          font-weight: 800;
          font-size: 13px;
        }
        .moments-post-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          background: #ccc;
        }
        .upload-progress-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          z-index: 10;
        }
        .upload-progress-bar {
          width: 80%;
          height: 8px;
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 8px;
          border: 1px solid rgba(255, 255, 255, 0.5);
        }
        .upload-progress-fill {
          height: 100%;
          background: #ff6fa5;
          transition: width 0.3s ease;
        }
        .upload-progress-text {
          font-size: 11px;
          font-weight: normal;
          margin-top: 4px;
          opacity: 0.9;
        }

        .nice-input {
          padding: 10px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.18);
          background: rgba(255, 255, 255, 0.75);
          outline: none;
        }
        .nice-textarea {
          padding: 10px;
          border-radius: 10px;
          border: 1px solid rgba(0, 0, 0, 0.18);
          background: rgba(255, 255, 255, 0.75);
          outline: none;
        }
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
          transition:
            transform 120ms ease,
            opacity 120ms ease;
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
