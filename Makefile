.PHONY: build build-windows build-linux-arm64 build-all clean frontend

frontend:
	cd frontend && NODE_ENV=development npm install && npm run build

build: frontend
	mkdir -p dist
	CGO_ENABLED=1 go build -o dist/openeventor ./cmd/server

build-windows: frontend
	mkdir -p dist
	GOOS=windows GOARCH=amd64 CGO_ENABLED=1 CC=x86_64-w64-mingw32-gcc go build -o dist/openeventor.exe ./cmd/server

build-linux-arm64: frontend
	mkdir -p dist
	GOOS=linux GOARCH=arm64 CGO_ENABLED=1 CC=aarch64-linux-gnu-gcc go build -o dist/openeventor-linux-arm64 ./cmd/server

build-all: frontend build build-windows build-linux-arm64

clean:
	rm -rf dist
