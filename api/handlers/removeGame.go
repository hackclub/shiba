package handlers

import (
	"net/http"
	"os"
	"shiba-api/structs"

	"github.com/go-chi/chi/v5"
)

func RemoveGameHandler(srv *structs.Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		gameId := chi.URLParam(r, "gameId")
		adminToken := r.Header.Get("Authorization")
		if adminToken != srv.AdminToken {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		if gameId == "" {
			http.Error(w, "Game ID is required", http.StatusBadRequest)
			return
		}

		// Delete the folder in ./games/{gameId}

		gamePath := "./games/" + gameId
		err := os.RemoveAll(gamePath)
		if err != nil {
			http.Error(w, "Failed to remove game: "+err.Error(), http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusOK)
		w.Write([]byte("Game removed successfully"))
	}
}
