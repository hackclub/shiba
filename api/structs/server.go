package structs

import (
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/mehanizm/airtable"
)

type Server struct {
	AirtableClient    *airtable.Client
	AirtableBaseTable *airtable.Table
	S3Client          *s3.Client
	AdminToken        string
}
