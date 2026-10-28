#!/usr/bin/env bash
set -euo pipefail
# Only invoked by an explicit, signed workflow_dispatch run. No publishing occurs.
: "${IOS_CERTIFICATE_P12_BASE64:?Missing IOS_CERTIFICATE_P12_BASE64}"
: "${IOS_CERTIFICATE_PASSWORD:?Missing IOS_CERTIFICATE_PASSWORD}"
: "${IOS_PROFILE_BASE64:?Missing IOS_PROFILE_BASE64}"
TEMP_DIR="$(mktemp -d)"
KEYCHAIN_PATH="$TEMP_DIR/build.keychain-db"
KEYCHAIN_PASSWORD="$(openssl rand -hex 24)"
PROFILE_PATH=""
cleanup() {
  security delete-keychain "$KEYCHAIN_PATH" >/dev/null 2>&1 || true
  if [[ -n "$PROFILE_PATH" ]]; then rm -f -- "$PROFILE_PATH"; fi
  rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT
printf '%s' "$IOS_CERTIFICATE_P12_BASE64" | base64 --decode > "$TEMP_DIR/cert.p12"
printf '%s' "$IOS_PROFILE_BASE64" | base64 --decode > "$TEMP_DIR/profile.mobileprovision"
security cms -D -i "$TEMP_DIR/profile.mobileprovision" > "$TEMP_DIR/profile.plist"
export SIGNING_PROFILE_PLIST="$TEMP_DIR/profile.plist"
export EXPORT_OPTIONS_PATH="$TEMP_DIR/ExportOptions.plist"
python3 - <<'PY'
import os, plistlib, datetime
with open(os.environ['SIGNING_PROFILE_PLIST'], 'rb') as f: p=plistlib.load(f)
if p['ExpirationDate'] < datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None):
    raise SystemExit('Provisioning profile expired')
ent=p['Entitlements']; team=p['TeamIdentifier'][0]
app=ent['application-identifier'].split('.', 1)[1]
bundle=os.environ['BUNDLE_ID']
if app != bundle and not (app.endswith('*') and bundle.startswith(app[:-1])):
    raise SystemExit('Bundle ID does not match provisioning profile')
method='debugging' if ent.get('get-task-allow') else 'release-testing'
if not ent.get('get-task-allow') and not p.get('ProvisionedDevices'):
    raise SystemExit('Use an Ad Hoc profile with registered devices, or a development profile')
with open(os.environ['EXPORT_OPTIONS_PATH'], 'wb') as f:
    plistlib.dump({'method':method,'teamID':team,'signingStyle':'manual',
                  'provisioningProfiles':{bundle:p['UUID']},'stripSwiftSymbols':True},f)
PY
PROFILE_UUID=$(/usr/libexec/PlistBuddy -c 'Print UUID' "$TEMP_DIR/profile.plist")
TEAM_ID=$(/usr/libexec/PlistBuddy -c 'Print TeamIdentifier:0' "$TEMP_DIR/profile.plist")
[[ "$PROFILE_UUID" =~ ^[A-Fa-f0-9-]+$ ]] || { echo 'Invalid profile UUID'; exit 1; }
PROFILE_PATH="$HOME/Library/MobileDevice/Provisioning Profiles/$PROFILE_UUID.mobileprovision"
mkdir -p "$(dirname "$PROFILE_PATH")"
cp "$TEMP_DIR/profile.mobileprovision" "$PROFILE_PATH"
security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
security import "$TEMP_DIR/cert.p12" -P "$IOS_CERTIFICATE_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN_PATH" >/dev/null
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH" >/dev/null
security list-keychains -d user -s "$KEYCHAIN_PATH"
IDENTITY=$(security find-identity -v -p codesigning "$KEYCHAIN_PATH" | sed -nE 's/.*"([^"]+)".*/\1/p' | head -n 1)
[[ -n "$IDENTITY" ]] || { echo 'No signing identity in P12'; exit 1; }
xcodebuild -project ios/RetroFront.xcodeproj -scheme RetroFront -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/RetroFront.xcarchive \
  PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID" CURRENT_PROJECT_VERSION="$GITHUB_RUN_NUMBER" \
  DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="$IDENTITY" \
  PROVISIONING_PROFILE_SPECIFIER="$PROFILE_UUID" archive
xcodebuild -exportArchive -archivePath build/RetroFront.xcarchive \
  -exportPath build/signed -exportOptionsPlist "$TEMP_DIR/ExportOptions.plist"
