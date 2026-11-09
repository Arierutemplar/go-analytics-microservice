# syntax=docker/dockerfile:1

FROM golang:1.27-alpine AS build
WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
 && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/dlqctl ./cmd/dlqctl

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata \
 && addgroup -S app && adduser -S -G app app
COPY --from=build /out/api /usr/local/bin/api
COPY --from=build /out/dlqctl /usr/local/bin/dlqctl

USER app
EXPOSE 8080
ENTRYPOINT ["api"]
