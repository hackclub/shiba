package handlers

import (
	"archive/zip"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"unicode"

	"shiba-api/structs"
	"shiba-api/sync"

	"github.com/google/uuid"
)

func validateZipFilePath(filePath, destDir string) bool {
	cleanPath := filepath.Clean(filePath)

	absDestDir, err := filepath.Abs(destDir)
	if err != nil {
		return false
	}

	absFilePath, err := filepath.Abs(filepath.Join(destDir, cleanPath))
	if err != nil {
		return false
	}

	return strings.HasPrefix(absFilePath, absDestDir+string(os.PathSeparator))
}

func isAllowedFileType(fileName string) bool {
	// // Allow everything - no file type restrictions
	// return true
	// hell no, only allow zip files
	// IDENTITY THEFT IS NOT A JOKE JIM, MILLIONS OF FAMILIES SUFFER EVERY YEAR
	return strings.HasSuffix(fileName, ".zip")
}

// see i have no idea how big godot can export, so this is a bit of a guess, and you guys may need to change it based on demand
const (
    maxZipEntries             = 2000            // like 2000 files for a bundled game is a lot unless you have a fuck ton of assets
    maxTotalUncompressedBytes = 500 << 20       // 500 mb max total size?
    maxPerFileUncompressed    = 200 << 20       // 200 mb per file
    maxCompressionRatio       = 100             // 100:1 compression ratio because yes :thumbsup:
)

func jsonValidationError(w http.ResponseWriter, status int, msg, details string) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(status)
    _ = json.NewEncoder(w).Encode(map[string]any{
        "error":            msg,
        "validationError":  true,
        "details":          details,
    })
}

func safeUint64ToInt64(u uint64) int64 {
    if u > ^uint64(0)>>1 {
        return int64(^uint64(0) >> 1)
    }
    return int64(u)
}

func lolCheckForZipBomb(zr *zip.ReadCloser) error {
    var entries int
    var totalUncompressed uint64
    for _, f := range zr.File {
        if strings.HasPrefix(f.Name, "__MACOSX/") {
            continue
        }
        entries++
        if entries > maxZipEntries {
            return errors.New("too many files in archive")
        }

        uc := f.UncompressedSize64
        if uc == 0 && f.UncompressedSize > 0 {
            uc = uint64(f.UncompressedSize)
        }
        totalUncompressed += uc
        if totalUncompressed > maxTotalUncompressedBytes {
            return errors.New("total uncompressed size exceeds limit")
        }

        cs := f.CompressedSize64
        if cs == 0 && f.CompressedSize > 0 {
            cs = uint64(f.CompressedSize)
        }
        if cs > 0 && uc > 0 {
            // blah lbah blah reject if the compression ratio is too high
            if uc/cs > maxCompressionRatio {
                return errors.New("excessive compression ratio detected")
            }
        }
        if uc > maxPerFileUncompressed {
            return errors.New("a file exceeds per-file uncompressed size limit")
        }
    }
    return nil
}

func sanitizeForAirtableFormula(input string) string {
	input = strings.Map(func(r rune) rune {
		if unicode.IsSpace(r) {
			return -1
		}
		return r
	}, input)
	input = strings.ReplaceAll(input, `\`, `\\`)
	input = strings.ReplaceAll(input, `"`, `\\"`)
	return input
}

// i barely use airtable so this is mostly a guess? im trying to be as minimal as possible
type airtableListResponse struct {
	Records []struct {
		Fields map[string]interface{} `json:"fields"`
		ID     string                 `json:"id"`
	} `json:"records"`
}

// idk just find their token in airtable
func airtableFindUserByToken(srv *structs.Server, token string) (*airtableListResponse, error) {
	if srv.AirtableAPIKey == "" || srv.AirtableBaseID == "" {
		return nil, fmt.Errorf("airtable not configured")
	}
	client := &http.Client{}

	fields := []string{"token", "Token"}
	for _, field := range fields {
		params := url.Values{}
		params.Set("filterByFormula", fmt.Sprintf("{%s} = \"%s\"", field, token))
		params.Set("pageSize", "1")
		params.Add("fields[]", "Email")
		params.Add("fields[]", "user_id")

		reqURL := fmt.Sprintf("https://api.airtable.com/v0/%s/%s?%s",
			url.PathEscape(srv.AirtableBaseID), url.PathEscape("Users"), params.Encode())
		req, err := http.NewRequest(http.MethodGet, reqURL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+srv.AirtableAPIKey)
		req.Header.Set("Accept", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			b, _ := io.ReadAll(resp.Body)
			return nil, fmt.Errorf("airtable error %d: %s", resp.StatusCode, string(b))
		}
		var out airtableListResponse
		if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
			return nil, err
		}
		if len(out.Records) > 0 {
			return &out, nil
		}
	}
	return &airtableListResponse{Records: nil}, nil
}

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
		// and the airtable auth was commented out why??
		authHeader := r.Header.Get("Authorization")

		if authHeader == "" {
			http.Error(w, "Authorization header is missing", http.StatusUnauthorized)
			return
		}

		if strings.HasPrefix(authHeader, "Bearer ") {
			authHeader = strings.TrimPrefix(authHeader, "Bearer ")
		}

		log.Printf("Authorization header received: %s", authHeader)

		sanitizedHeader := sanitizeForAirtableFormula(authHeader)
		
		log.Printf("Attempting to validate token: %s", sanitizedHeader)

		airOut, err := airtableFindUserByToken(srv, sanitizedHeader)
		if err != nil {
			log.Printf("Airtable query error: %v", err)
			http.Error(w, "Failed to validate token..", http.StatusInternalServerError)
			return
		}

		log.Printf("Found %d records for token", len(airOut.Records))

		if len(airOut.Records) == 0 {
			log.Printf("No records found for token: %s", sanitizedHeader)
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

		destDir := filepath.Join("/games/" + id.String() + "/")
		if err := os.MkdirAll(destDir, 0755); err != nil {
			http.Error(w, "Failed to create game directory: "+err.Error(), http.StatusInternalServerError)
			return
		}

		// ok but zipbomb protection
		if err := lolCheckForZipBomb(zr); err != nil {
			jsonValidationError(w, http.StatusBadRequest, "Zip validation failed", err.Error())
			return
		}

		var totalWritten uint64
		for _, f := range zr.File {
			// Don't do it if file is in a __MACOSX directory
			if strings.HasPrefix(f.Name, "__MACOSX/") {
				continue
			}

			// Validate file path for path traversal
			if !validateZipFilePath(f.Name, destDir) {
				http.Error(w, "Invalid file path in zip: "+f.Name, http.StatusBadRequest)
				return
			}

			// Check if file type is allowed
			if !isAllowedFileType(f.Name) {
				http.Error(w, "File type not allowed: "+f.Name, http.StatusBadRequest)
				return
			}

			fpath := filepath.Join(destDir, f.Name)

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

			// copy with per file and total limits
			var writtenForFile uint64
			buf := make([]byte, 64*1024)
			for {
				n, readErr := rc.Read(buf)
				if n > 0 {
					writtenForFile += uint64(n)
					totalWritten += uint64(n)
					if writtenForFile > maxPerFileUncompressed {
						outFile.Close()
						rc.Close()
						os.Remove(fpath)
						jsonValidationError(w, http.StatusBadRequest, "File too large after decompression", f.Name)
						return
					}
					if totalWritten > maxTotalUncompressedBytes {
						outFile.Close()
						rc.Close()
						os.Remove(fpath)
						jsonValidationError(w, http.StatusBadRequest, "Archive total uncompressed size limit exceeded", "")
						return
					}
					if _, writeErr := outFile.Write(buf[:n]); writeErr != nil {
						outFile.Close()
						rc.Close()
						http.Error(w, "Failed to write file: "+writeErr.Error(), http.StatusInternalServerError)
						return
					}
				}
				if readErr == io.EOF {
					break
				}
				if readErr != nil {
					outFile.Close()
					rc.Close()
					http.Error(w, "Failed to read file in zip: "+readErr.Error(), http.StatusInternalServerError)
					return
				}
			}
			outFile.Close()
			rc.Close()

		}

		log.Printf("User successfully uploaded a new game snapshot!")

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
