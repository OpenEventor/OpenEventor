#!/usr/bin/env bash
# Build OpenEventor web .ipk packages for OpenWRT (install via `opkg install`).
# Runs on macOS/Linux with Go + npm only — no OpenWRT SDK needed. Mirrors
# hub/openwrt/build-ipk.sh: the .ipk is a gzip tar of debian-binary +
# data.tar.gz + control.tar.gz (what modern opkg produces and reads).
#
# The binary embeds the React frontend and uses the pure-Go SQLite driver
# (-tags purego, CGO_ENABLED=0) — no C toolchain, no 32-bit MIPS support
# (modernc.org/sqlite requires ARM/x86; 16 MB-flash MIPS routers are too small
# for this binary anyway — run the hub there and the web app elsewhere).
set -euo pipefail
cd "$(dirname "$0")/../.."        # → web repo root

VERSION="${VERSION:-0.1.0}"
PKG="openeventor-web"
OUT="$(pwd)/dist/openwrt"         # absolute: build_ipk assembles inside a temp dir
FILES="$(pwd)/packaging/openwrt/files"
LDFLAGS="-s -w"

if [ ! -f frontend/dist/index.html ]; then
  echo "▸ building frontend (embedded into the binary)"
  (cd frontend && NODE_ENV=development npm install && npm run build)
fi

rm -rf "$OUT"; mkdir -p "$OUT"

# build_ipk <label> <GOARCH> <GOARM|""> <opkg-arch>
build_ipk() {
  local label="$1" goarch="$2" goarm="$3" opkgarch="$4"
  local work; work="$(mktemp -d)"
  local data="$work/data" control="$work/control"
  mkdir -p "$data/usr/bin" "$data/etc/init.d" "$data/etc/config" "$control"

  echo "▸ $label ($opkgarch)"
  GOOS=linux GOARCH="$goarch" GOARM="$goarm" CGO_ENABLED=0 \
    go build -tags purego -ldflags="$LDFLAGS" -o "$data/usr/bin/openeventor-web" ./cmd/server

  cp "$FILES/etc/init.d/openeventor-web" "$data/etc/init.d/openeventor-web"
  cp "$FILES/etc/config/openeventor-web" "$data/etc/config/openeventor-web"
  chmod 0755 "$data/usr/bin/openeventor-web" "$data/etc/init.d/openeventor-web"
  chmod 0644 "$data/etc/config/openeventor-web"

  local kb; kb=$(( ( $(wc -c < "$data/usr/bin/openeventor-web") + 1023 ) / 1024 ))
  cat > "$control/control" <<EOF
Package: $PKG
Version: $VERSION
Architecture: $opkgarch
Maintainer: OpenEventor <info@openeventor.com>
Section: net
Priority: optional
Installed-Size: $kb
Description: OpenEventor - timing and results platform for sports events.
 Self-contained web application (embedded UI + SQLite). Runs as a procd
 service on :8081. Pairs with the openeventor-hub package: add the
 "OpenEventor HUB" timing system pointing at 127.0.0.1:8080.
EOF
  cat > "$control/postinst" <<'EOF'
#!/bin/sh
[ -n "$IPKG_INSTROOT" ] || {
	/etc/init.d/openeventor-web enable
	/etc/init.d/openeventor-web start
}
exit 0
EOF
  cat > "$control/prerm" <<'EOF'
#!/bin/sh
[ -n "$IPKG_INSTROOT" ] || {
	/etc/init.d/openeventor-web stop
	/etc/init.d/openeventor-web disable
}
exit 0
EOF
  echo "/etc/config/openeventor-web" > "$control/conffiles"
  chmod 0755 "$control/postinst" "$control/prerm"

  # Root-owned ustar entries, portable across bsdtar (macOS) and GNU tar (CI).
  local T
  if tar --version 2>/dev/null | grep -q "GNU tar"; then
    T=(--owner=root:0 --group=root:0 --format=ustar)
  else
    T=(--uid 0 --gid 0 --uname root --gname root --no-mac-metadata --format ustar)
  fi
  COPYFILE_DISABLE=1 tar "${T[@]}" -czf "$work/control.tar.gz" -C "$control" .
  COPYFILE_DISABLE=1 tar "${T[@]}" -czf "$work/data.tar.gz"    -C "$data" .
  printf '2.0\n' > "$work/debian-binary"

  local ipk="$OUT/${PKG}_${VERSION}_${label}.ipk"
  COPYFILE_DISABLE=1 tar "${T[@]}" -czf "$ipk" -C "$work" ./debian-binary ./data.tar.gz ./control.tar.gz
  rm -rf "$work"
  echo "  → $(basename "$ipk")"
}

#         label   GOARCH GOARM opkg-arch
build_ipk arm64   arm64  ""    aarch64_cortex-a53   # GL-MT3000 (Beryl AX) & most new ARM routers
build_ipk armv7   arm    "7"   arm_cortex-a7        # older 32-bit ARM (ipq40xx, sunxi)
build_ipk x86_64  amd64  ""    x86_64               # x86 OpenWRT / VM / PC Engines

echo ""
echo "Packages in dist/openwrt/:"
ls -1 "$OUT"
