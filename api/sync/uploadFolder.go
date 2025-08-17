package sync

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"shiba-api/structs"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/feature/s3/manager"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

func UploadFolder(folderPath string, server structs.Server) error {
	fmt.Println("Syncing folder:", folderPath)

	uploader := manager.NewUploader(server.S3Client)

	err := filepath.Walk(folderPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		f, err := os.Open(path)
		if err != nil {
			fmt.Printf("Failed to open file %s: %v\n", path, err)
			return nil
		}
		defer f.Close()

		relPath, err := filepath.Rel(folderPath, path)
		if err != nil {
			fmt.Printf("Failed to get relative path for %s: %v\n", path, err)
			return nil
		}

		s3Key := filepath.ToSlash("games/" + filepath.Base(folderPath) + "/" + relPath)

		_, err = uploader.Upload(context.Background(), &s3.PutObjectInput{
			Bucket: aws.String(os.Getenv("R2_BUCKET")),
			Key:    aws.String(s3Key),
			Body:   f,
		})
		if err != nil {
			fmt.Printf("Failed to upload %s to R2: %v\n", path, err)
		} else {
			fmt.Printf("Uploaded %s to R2 as %s\n", path, s3Key)
		}
		return nil
	})

	if err != nil {
		return fmt.Errorf("error walking folder: %v", err)
	}

	fmt.Println("Sync complete for folder:", folderPath)
	return nil
}
