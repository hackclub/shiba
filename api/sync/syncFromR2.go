package sync

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"shiba-api/structs"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func SyncFromR2(server structs.Server) error {
	localFolder := "./games"
	bucket := os.Getenv("R2_BUCKET")
	client := server.S3Client

	// Check if we're in a debug env and not syncing if so

	if os.Getenv("DEBUG_ENV") == "true" {
		fmt.Println("Skipping R2 sync in debug environment")
		return nil
	}

	fmt.Println("Starting sync from R2 to local .games folder...")

	keys, err := ListR2Objects(bucket, "games/", client)
	if err != nil {
		return fmt.Errorf("failed to list R2 objects: %v", err)
	}

	for _, key := range keys {
		localPath := filepath.Join(localFolder, strings.TrimPrefix(key, "games/"))
		if _, err := os.Stat(localPath); err == nil {
			continue
		}

		if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
			fmt.Printf("Failed to create directory for %s: %v\n", localPath, err)
			continue
		}

		resp, err := client.GetObject(context.Background(), &s3.GetObjectInput{
			Bucket: aws.String(bucket),
			Key:    aws.String(key),
		})
		if err != nil {
			fmt.Printf("Failed to download %s: %v\n", key, err)
			continue
		}

		outFile, err := os.Create(localPath)
		if err != nil {
			resp.Body.Close()
			fmt.Printf("Failed to create local file %s: %v\n", localPath, err)
			continue
		}

		_, err = io.Copy(outFile, resp.Body)
		outFile.Close()
		resp.Body.Close()
		if err != nil {
			fmt.Printf("Failed to write file %s: %v\n", localPath, err)
			continue
		}

		fmt.Printf("Downloaded %s -> %s\n", key, localPath)
	}

	fmt.Println("Sync complete!")
	return nil
}

func ListR2Objects(bucket, prefix string, client *s3.Client) ([]string, error) {
	var keys []string
	input := &s3.ListObjectsV2Input{
		Bucket: aws.String(bucket),
		Prefix: aws.String(prefix),
	}

	paginator := s3.NewListObjectsV2Paginator(client, input)
	for paginator.HasMorePages() {
		page, err := paginator.NextPage(context.Background())
		if err != nil {
			return nil, err
		}
		for _, obj := range page.Contents {
			keys = append(keys, *obj.Key)
		}
	}

	return keys, nil
}
