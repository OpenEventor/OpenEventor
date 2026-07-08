#!/bin/bash
# Packages the OpenEventor server binary into a double-clickable, signed &
# notarized OpenEventor.app inside a .dmg.
#
# Env in:
#   SERVER_BIN   path to the built server binary            (required)
#   ARCH         arm64 | amd64                              (default arm64)
#   VERSION      version string for Info.plist              (default 0.0.0)
#   OUT          output .dmg path                           (default OpenEventor-darwin-$ARCH.dmg)
#   BUNDLE_ID    bundle identifier                          (default com.openeventor.server)
#   SIGN_ID      Developer ID Application identity          (empty => ad-hoc, no notarization)
#   ASC_KEY_P8_PATH / ASC_KEY_ID / ASC_ISSUER_ID            App Store Connect API key => notarize+staple
set -euo pipefail

SERVER_BIN="${SERVER_BIN:?set SERVER_BIN to the built server binary}"
ARCH="${ARCH:-arm64}"
VERSION="${VERSION:-0.0.0}"
BUNDLE_ID="${BUNDLE_ID:-com.openeventor.server}"
OUT="${OUT:-OpenEventor-darwin-$ARCH.dmg}"
SIGN_ID="${SIGN_ID:-}"

HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
APP="$WORK/OpenEventor.app"
trap 'rm -rf "$WORK"' EXIT

echo "==> launcher ($ARCH)"
GOOS=darwin GOARCH="$ARCH" CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o "$WORK/launcher" "$HERE/launcher"

echo "==> assemble OpenEventor.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$WORK/launcher"       "$APP/Contents/MacOS/OpenEventor"
cp "$SERVER_BIN"          "$APP/Contents/Resources/openeventor"
cp "$HERE/run.command"    "$APP/Contents/Resources/run.command"
chmod +x "$APP/Contents/MacOS/OpenEventor" "$APP/Contents/Resources/openeventor" "$APP/Contents/Resources/run.command"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>OpenEventor</string>
  <key>CFBundleDisplayName</key><string>OpenEventor</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundleExecutable</key><string>OpenEventor</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST

echo "==> codesign"
ID="${SIGN_ID:--}"                      # "-" = ad-hoc
SIGN_FLAGS=(--force --sign "$ID" --options runtime)
[ "$ID" != "-" ] && SIGN_FLAGS+=(--timestamp)   # real timestamp needs a real identity
codesign "${SIGN_FLAGS[@]}" "$APP/Contents/Resources/openeventor"
codesign "${SIGN_FLAGS[@]}" "$APP"
codesign --verify --deep --strict "$APP"

echo "==> dmg"
rm -f "$OUT"
hdiutil create -quiet -volname "OpenEventor" -srcfolder "$APP" -ov -format UDZO "$OUT"
if [ "$ID" != "-" ]; then
  codesign --force --timestamp --sign "$ID" "$OUT"
fi

if [ -n "${ASC_KEY_P8_PATH:-}" ] && [ -n "${ASC_KEY_ID:-}" ] && [ -n "${ASC_ISSUER_ID:-}" ]; then
  echo "==> notarize + staple"
  xcrun notarytool submit "$OUT" --key "$ASC_KEY_P8_PATH" --key-id "$ASC_KEY_ID" --issuer "$ASC_ISSUER_ID" --wait
  xcrun stapler staple "$OUT"
  xcrun stapler validate "$OUT"
else
  echo "note: no App Store Connect creds — skipping notarization ($([ "$ID" = "-" ] && echo 'ad-hoc' || echo 'signed') dmg only)."
fi

echo "built $OUT"
