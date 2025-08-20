package structs

import (
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type Server struct {
	AirtableAPIKey    string
	AirtableBaseID    string
	S3Client          *s3.Client
	AdminToken        string
}
