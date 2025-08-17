# Build stage
FROM golang:1.24 AS builder
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./main.go

# Runtime stage
FROM scratch
COPY --from=builder /src/server /server
EXPOSE 3001
CMD ["/server"]
