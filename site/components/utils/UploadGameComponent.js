/* eslint-disable react/prop-types */
import React, { useState } from "react";
import { uploadGame } from "@/components/utils/uploadGame";

export default function UploadGameComponent({ apiBase, onComplete }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setStatus("Uploading...");
    setResult(null);
    // Get the token with local storage under "token"
    const token = localStorage.getItem("token");
    if (!token) {
      setStatus("Auth error, no token found");
      return;
    }
    const resp = await uploadGame({ file, name, token, apiBase });
    if (resp.ok) {
      setStatus("Upload complete!");
      setResult(resp);
      if (onComplete) onComplete(resp);
    } else {
      setStatus(`Upload failed: ${resp.error || "Unknown error"}`);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ maxWidth: 640 }}>
      <label style={{ display: "block", marginTop: 12, fontWeight: 600 }}>
        Name (used for gameId)
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={{ width: "100%", padding: 8 }}
        />
      </label>
      <label style={{ display: "block", marginTop: 12, fontWeight: 600 }}>
        Zip file (.zip)
        <input
          type="file"
          accept=".zip"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          required
          style={{ width: "100%", padding: 8 }}
        />
      </label>
      <button
        type="submit"
        style={{ marginTop: 16, padding: "10px 16px", fontSize: 16 }}
      >
        Upload
      </button>
      <div style={{ marginTop: 12 }}>{status}</div>
      {result && result.playUrl && (
        <div style={{ marginTop: 8 }}>
          Play URL:{" "}
          <a href={result.playUrl} target="_blank" rel="noreferrer">
            {typeof window !== "undefined"
              ? window.location.origin + result.playUrl
              : result.playUrl}
          </a>
        </div>
      )}
    </form>
  );
}
