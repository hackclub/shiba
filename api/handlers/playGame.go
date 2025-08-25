package handlers

import (
	"log"
	"net/http"
	"os"
	"shiba-api/structs"
	"shiba-api/sync"

	"github.com/go-chi/chi/v5"
)

func MainGamePlayHandler(srv *structs.Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		gameId := chi.URLParam(r, "gameId")
		if gameId == "" {
			http.Error(w, "Game ID is required", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cross-Origin-Resource-Policy", "cross-origin")

		var filepath = "./games/" + gameId + "/index.html"

		log.Printf("Serving game %s from %s", gameId, filepath)

		// check if the file is present
		// if not, return 404
		if _, err := os.Stat(filepath); os.IsNotExist(err) {
			println("File does not exist:", filepath)
			// Trigger a fetch for the game from the sync manager using a goroutine
			go func() {
				err := sync.FetchGameFromR2(srv, gameId)
				if err != nil {
					log.Printf("Failed to fetch game %s: %v", gameId, err)
				} else {
					log.Printf("Successfully fetched game %s", gameId)
				}
			}()
			// Send a message saying to wait for the game to be fetched
			http.Error(w, "Game not found. The server will try to download it asap. Please try again later.", http.StatusNotFound)
		}

		http.ServeFile(w, r, filepath)
	}
}

func AssetsPlayHandler(srv *structs.Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		gameId := chi.URLParam(r, "gameId")
		if gameId == "" {
			http.Error(w, "Game ID is required", http.StatusBadRequest)
			return
		}

		assetPath := chi.URLParam(r, "*")
		if assetPath == "" {
			var filepath = "./games/" + gameId + "/index.html"
			w.Header().Set("Cross-Origin-Resource-Policy", "cross-origin")
			http.ServeFile(w, r, filepath)
		} else {
			var filepath = "./games/" + gameId + "/" + assetPath
			w.Header().Set("Cross-Origin-Resource-Policy", "cross-origin")
			http.ServeFile(w, r, filepath)
		}
	}
}
