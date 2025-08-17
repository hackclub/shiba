package handlers

import (
	"archive/zip"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"shiba-api/structs"
	"shiba-api/sync"

	"github.com/google/uuid"
)

func GameUploadHandler(srv *structs.Server) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		if err := r.ParseMultipartForm(100 << 20); err != nil { // 100 MB max
			http.Error(w, "Failed to parse form: "+err.Error(), http.StatusBadRequest)
			return
		}

		// check if the auth bearer is a valid user token in airtable

		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "Authorization header is missing", http.StatusUnauthorized)
			return
		}

		var records, err = srv.AirtableBaseTable.GetRecords().WithFilterFormula(
			`{token} = "`+authHeader+`"`,
		).MaxRecords(1).ReturnFields("Email", "user_id").Do()

		if err != nil {
			http.Error(w, "Failed to validate token..", http.StatusInternalServerError)
			return
		}

		if len(records.Records) == 0 {
			http.Error(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		file, _, err := r.FormFile("file")
		if err != nil {
			http.Error(w, "Missing file field 'file': "+err.Error(), http.StatusBadRequest)
			return
		}
		defer file.Close()

		tmpFile, err := os.CreateTemp("", "game-upload-*.zip")
		if err != nil {
			http.Error(w, "Failed to create temporary file: "+err.Error(), http.StatusInternalServerError)
			return
		}
		defer os.Remove(tmpFile.Name())

		if _, err := io.Copy(tmpFile, file); err != nil {
			tmpFile.Close()
			http.Error(w, "Failed to write uploaded file: "+err.Error(), http.StatusInternalServerError)
			return
		}

		if err := tmpFile.Close(); err != nil {
			http.Error(w, "Failed to close temp file: "+err.Error(), http.StatusInternalServerError)
			return
		}

		zr, err := zip.OpenReader(tmpFile.Name())
		if err != nil {
			http.Error(w, "Uploaded file is not a valid zip: "+err.Error(), http.StatusBadRequest)
			return
		}
		defer zr.Close()

		id, err := uuid.NewV7()
		if err != nil {
			log.Fatal(err)
		}

		destDir := filepath.Join("./games/" + id.String() + "/")
		if err := os.MkdirAll(destDir, 0755); err != nil {
			http.Error(w, "Failed to create game directory: "+err.Error(), http.StatusInternalServerError)
			return
		}

		for _, f := range zr.File {
			// Don't do it if file is in a __MACOSX directory
			if strings.HasPrefix(f.Name, "__MACOSX/") {
				continue
			}
			fpath := filepath.Join(destDir, f.Name)
			if !strings.HasPrefix(fpath, filepath.Clean(destDir)+string(os.PathSeparator)) {
				http.Error(w, "Invalid file path in zip: "+f.Name, http.StatusBadRequest)
				return
			}

			if f.FileInfo().IsDir() {
				os.MkdirAll(fpath, f.Mode())
				continue
			}

			if err := os.MkdirAll(filepath.Dir(fpath), 0755); err != nil {
				http.Error(w, "Failed to create directory: "+err.Error(), http.StatusInternalServerError)
				return
			}

			rc, err := f.Open()
			if err != nil {
				http.Error(w, "Failed to open file in zip: "+err.Error(), http.StatusInternalServerError)
				return
			}

			// write locally first
			outFile, err := os.OpenFile(fpath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
			if err != nil {
				rc.Close()
				http.Error(w, "Failed to create file: "+err.Error(), http.StatusInternalServerError)
				return
			}

			_, err = io.Copy(outFile, rc)
			outFile.Close()
			rc.Close()
			if err != nil {
				http.Error(w, "Failed to write file: "+err.Error(), http.StatusInternalServerError)
				return
			}

		}

		log.Printf("User with email %s sucessfully uploaded a new game snapshot!", records.Records[0].Fields["Email"])

		go func(folder string, srv *structs.Server) {
			if err := sync.UploadFolder(folder, *srv); err != nil {
				log.Printf("Failed to sync folder %s to R2: %v", folder, err)
			}
		}(destDir, srv)

		// return a okay response + the game slug/id

		w.WriteHeader(http.StatusOK)
		w.Header().Set("Content-Type", "application/json")
		resp := struct {
			Ok      bool   `json:"ok"`
			GameID  string `json:"gameId"`
			PlayURL string `json:"playUrl"`
		}{
			Ok:      true,
			GameID:  id.String(),
			PlayURL: "/play/" + id.String() + "/",
		}

		responseBytes, _ := json.Marshal(resp)
		response := string(responseBytes)
		if _, err := w.Write([]byte(response)); err != nil {
			log.Printf("Failed to write response: %v", err)
			http.Error(w, "Failed to write response", http.StatusInternalServerError)
			return
		}
	}
}
