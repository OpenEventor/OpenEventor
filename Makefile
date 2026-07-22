.PHONY: build build-windows build-linux-arm64 build-linux-amd64 build-linux-armv7 build-openwrt build-all clean frontend

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

build-linux-amd64: frontend
	mkdir -p dist
	GOOS=linux GOARCH=amd64 CGO_ENABLED=1 CC=x86_64-linux-gnu-gcc go build -o dist/openeventor-linux-amd64 ./cmd/server

build-linux-armv7: frontend
	mkdir -p dist
	GOOS=linux GOARCH=arm GOARM=7 CGO_ENABLED=1 CC=armv7-linux-gnueabihf-gcc go build -o dist/openeventor-linux-armv7 ./cmd/server

# OpenWRT router packages (.ipk) — pure-Go SQLite (-tags purego), no cross-toolchain needed.
build-openwrt: frontend
	./packaging/openwrt/build-ipk.sh

build-all: frontend build build-windows build-linux-arm64 build-linux-amd64 build-linux-armv7 build-openwrt

clean:
	rm -rf dist
