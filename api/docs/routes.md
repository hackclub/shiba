### "/health"

GET:
- **Description**: Check the health status of the service.
- **Response**:
  - `200 OK`: Service is healthy.

### "/uploadGame"

POST:
- **Description**: Upload a game file.
- **Request Body**:
  - `file`: The game file to upload _(required)_.
  - `gameId`: The id of the game, defaults to timestamp if not provided _(optional)_.
  - User token as a Bearer token in the Authorization header.
- **Response**:
  - `200 OK`: Game file uploaded successfully.
  - `400 Bad Request`: Invalid file type or missing file.
  - `500 Internal Server Error`: Error processing the upload.
  - `401 Unauthorized`: Invalid or missing authentication token.
