package handlers

import (
	"log"
	"net/http"
	"shiba-api/structs"

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

		var filepath = "./games/" + gameId + "/index.html"

		log.Printf("Serving game %s from %s", gameId, filepath)

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

			http.ServeFile(w, r, filepath)
		} else {
			var filepath = "./games/" + gameId + "/" + assetPath
			http.ServeFile(w, r, filepath)
		}
	}
}
