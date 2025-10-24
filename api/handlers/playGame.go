package handlers

import (
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-chi/chi/v5"
)

func MainGamePlayHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		gameId := chi.URLParam(r, "gameId")
		if gameId == "" {
			http.Error(w, "Game ID is required", http.StatusBadRequest)
			return
		}

		r2PublicURL := os.Getenv("R2_PUBLIC_URL")
		if r2PublicURL == "" {
			r2PublicURL = "https://juice.hackclub-assets.com"
		}

		// Build R2 URL
		r2URL := fmt.Sprintf("%s/games/%s/index.html", r2PublicURL, url.PathEscape(gameId))
		
		log.Printf("Proxying game %s from R2: %s", gameId, r2URL)
		
		// Fetch from R2
		resp, err := http.Get(r2URL)
		if err != nil {
			log.Printf("Failed to fetch game from R2: %v", err)
			http.Error(w, "Failed to load game", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			log.Printf("R2 returned non-200 status: %d", resp.StatusCode)
			http.Error(w, "Game not found", resp.StatusCode)
			return
		}

	// Read the HTML content
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read response body: %v", err)
		http.Error(w, "Failed to read game", http.StatusInternalServerError)
		return
	}

	// Inject virtual keyboard listener script
	virtualKeyboardScript := `
<script>
// Virtual keyboard listener for mobile WASD controls
(function() {
	const activeKeys = new Set();
	
	// Key code mappings
	const keyCodes = {
		'w': 87,
		'a': 65,
		's': 83,
		'd': 68
	};
	
	console.log('[Virtual Keyboard] Listener initialized');
	
	window.addEventListener('message', function(event) {
		console.log('[Virtual Keyboard] Message received:', event.data);
		
		if (!event.data || !event.data.type || !event.data.key) {
			console.log('[Virtual Keyboard] Invalid message data');
			return;
		}
		
		const eventType = event.data.type; // 'keydown' or 'keyup'
		const key = event.data.key.toLowerCase();
		const keyCode = keyCodes[key] || key.charCodeAt(0);
		
		console.log('[Virtual Keyboard] Processing:', eventType, key, keyCode);
		
		// Prevent duplicate keydown events
		if (eventType === 'keydown') {
			if (activeKeys.has(key)) {
				console.log('[Virtual Keyboard] Key already active:', key);
				return;
			}
			activeKeys.add(key);
		} else if (eventType === 'keyup') {
			activeKeys.delete(key);
		}
		
		// Create and dispatch keyboard event with multiple property formats
		const keyboardEvent = new KeyboardEvent(eventType, {
			key: key,
			code: 'Key' + key.toUpperCase(),
			keyCode: keyCode,
			which: keyCode,
			charCode: keyCode,
			bubbles: true,
			cancelable: true,
			composed: true
		});
		
		console.log('[Virtual Keyboard] Dispatching event:', keyboardEvent);
		
		// Dispatch to multiple targets
		document.dispatchEvent(keyboardEvent);
		window.dispatchEvent(keyboardEvent);
		document.body?.dispatchEvent(keyboardEvent);
		
		// Also try dispatching to canvas if it exists (common in games)
		const canvas = document.querySelector('canvas');
		if (canvas) {
			canvas.dispatchEvent(keyboardEvent);
			console.log('[Virtual Keyboard] Dispatched to canvas');
		}
		
		// Try dispatching to the active element
		if (document.activeElement && document.activeElement !== document.body) {
			document.activeElement.dispatchEvent(keyboardEvent);
			console.log('[Virtual Keyboard] Dispatched to active element:', document.activeElement);
		}
	});
	
	console.log('[Virtual Keyboard] Ready to receive messages');
})();
</script>
`

	// Inject before closing </body> or </html> tag
	htmlContent := string(bodyBytes)
	if strings.Contains(htmlContent, "</body>") {
		htmlContent = strings.Replace(htmlContent, "</body>", virtualKeyboardScript+"</body>", 1)
	} else if strings.Contains(htmlContent, "</html>") {
		htmlContent = strings.Replace(htmlContent, "</html>", virtualKeyboardScript+"</html>", 1)
	} else {
		// If neither tag found, append at the end
		htmlContent += virtualKeyboardScript
	}

	// Set correct content type for HTML
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	
	// Write modified HTML
	if _, err := w.Write([]byte(htmlContent)); err != nil {
		log.Printf("Failed to write response body: %v", err)
	}
	}
}

func AssetsPlayHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		gameId := chi.URLParam(r, "gameId")
		if gameId == "" {
			http.Error(w, "Game ID is required", http.StatusBadRequest)
			return
		}

		r2PublicURL := os.Getenv("R2_PUBLIC_URL")
		if r2PublicURL == "" {
			r2PublicURL = "https://juice.hackclub-assets.com"
		}

		assetPath := chi.URLParam(r, "*")
		var r2URL string
		var isIndexHTML bool
		
		if assetPath == "" {
			r2URL = fmt.Sprintf("%s/games/%s/index.html", r2PublicURL, url.PathEscape(gameId))
			isIndexHTML = true
		} else {
			r2URL = fmt.Sprintf("%s/games/%s/%s", r2PublicURL, url.PathEscape(gameId), assetPath)
			isIndexHTML = false
		}
		
		log.Printf("Proxying asset from R2: %s (isIndexHTML: %v)", r2URL, isIndexHTML)
		
		// Fetch from R2 and proxy with correct content-type
		resp, err := http.Get(r2URL)
		if err != nil {
			log.Printf("Failed to fetch asset from R2: %v", err)
			http.Error(w, "Failed to load asset", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			http.Error(w, "Asset not found", resp.StatusCode)
			return
		}

		// Detect content type from file extension
		var contentType string
		if isIndexHTML {
			// Force text/html for index.html
			contentType = "text/html; charset=utf-8"
		} else {
			contentType = mime.TypeByExtension(filepath.Ext(assetPath))
			if contentType == "" {
				// Fall back to R2's content type or octet-stream
				contentType = resp.Header.Get("Content-Type")
				if contentType == "" || contentType == "application/octet-stream" {
					// Try to guess based on extension
					ext := strings.ToLower(filepath.Ext(assetPath))
					switch ext {
					case ".js":
						contentType = "application/javascript"
					case ".css":
						contentType = "text/css"
					case ".png":
						contentType = "image/png"
					case ".jpg", ".jpeg":
						contentType = "image/jpeg"
					case ".gif":
						contentType = "image/gif"
					case ".svg":
						contentType = "image/svg+xml"
					case ".wasm":
						contentType = "application/wasm"
					case ".json":
						contentType = "application/json"
					case ".html":
						contentType = "text/html; charset=utf-8"
					default:
						contentType = "application/octet-stream"
					}
				}
			}
		}

	// Read response body
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read asset response body: %v", err)
		http.Error(w, "Failed to read asset", http.StatusInternalServerError)
		return
	}

	// If it's HTML, inject the virtual keyboard script
	if isIndexHTML || strings.Contains(contentType, "text/html") {
		virtualKeyboardScript := `
<script>
// Virtual keyboard listener for mobile WASD controls
(function() {
	const activeKeys = new Set();
	
	// Key code mappings
	const keyCodes = {
		'w': 87,
		'a': 65,
		's': 83,
		'd': 68
	};
	
	console.log('[Virtual Keyboard] Listener initialized');
	
	window.addEventListener('message', function(event) {
		console.log('[Virtual Keyboard] Message received:', event.data);
		
		if (!event.data || !event.data.type || !event.data.key) {
			console.log('[Virtual Keyboard] Invalid message data');
			return;
		}
		
		const eventType = event.data.type; // 'keydown' or 'keyup'
		const key = event.data.key.toLowerCase();
		const keyCode = keyCodes[key] || key.charCodeAt(0);
		
		console.log('[Virtual Keyboard] Processing:', eventType, key, keyCode);
		
		// Prevent duplicate keydown events
		if (eventType === 'keydown') {
			if (activeKeys.has(key)) {
				console.log('[Virtual Keyboard] Key already active:', key);
				return;
			}
			activeKeys.add(key);
		} else if (eventType === 'keyup') {
			activeKeys.delete(key);
		}
		
		// Create and dispatch keyboard event with multiple property formats
		const keyboardEvent = new KeyboardEvent(eventType, {
			key: key,
			code: 'Key' + key.toUpperCase(),
			keyCode: keyCode,
			which: keyCode,
			charCode: keyCode,
			bubbles: true,
			cancelable: true,
			composed: true
		});
		
		console.log('[Virtual Keyboard] Dispatching event:', keyboardEvent);
		
		// Dispatch to multiple targets
		document.dispatchEvent(keyboardEvent);
		window.dispatchEvent(keyboardEvent);
		document.body?.dispatchEvent(keyboardEvent);
		
		// Also try dispatching to canvas if it exists (common in games)
		const canvas = document.querySelector('canvas');
		if (canvas) {
			canvas.dispatchEvent(keyboardEvent);
			console.log('[Virtual Keyboard] Dispatched to canvas');
		}
		
		// Try dispatching to the active element
		if (document.activeElement && document.activeElement !== document.body) {
			document.activeElement.dispatchEvent(keyboardEvent);
			console.log('[Virtual Keyboard] Dispatched to active element:', document.activeElement);
		}
	});
	
	console.log('[Virtual Keyboard] Ready to receive messages');
})();
</script>
`

		// Inject before closing </body> or </html> tag
		htmlContent := string(bodyBytes)
		if strings.Contains(htmlContent, "</body>") {
			htmlContent = strings.Replace(htmlContent, "</body>", virtualKeyboardScript+"</body>", 1)
		} else if strings.Contains(htmlContent, "</html>") {
			htmlContent = strings.Replace(htmlContent, "</html>", virtualKeyboardScript+"</html>", 1)
		} else {
			// If neither tag found, append at the end
			htmlContent += virtualKeyboardScript
		}
		bodyBytes = []byte(htmlContent)
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Cache-Control", "public, max-age=3600")
	w.WriteHeader(http.StatusOK)
	
	// Write response body
	if _, err := w.Write(bodyBytes); err != nil {
		log.Printf("Failed to write asset response: %v", err)
	}
	}
}
