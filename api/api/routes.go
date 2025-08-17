package api

import (
	"shiba-api/handlers"
	"shiba-api/structs"

	"github.com/go-chi/chi/v5"
)

func SetupRoutes(r *chi.Mux, srv *structs.Server) {
	r.Get("/", handlers.RootHandler)
	r.Get("/health", handlers.HealthCheckHandler)
	r.Post("/uploadGame", handlers.GameUploadHandler(srv))
	r.Post("/api/uploadGame", handlers.GameUploadHandler(srv)) // Probably required by vibecode..
	r.Get("/play/{gameId}", handlers.MainGamePlayHandler(srv))
	r.Get("/play/{gameId}/*", handlers.AssetsPlayHandler(srv))
	r.Get("/removeGame/{gameId}", handlers.RemoveGameHandler(srv))
}
