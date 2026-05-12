#!/usr/bin/env bash
# scripts/setup-android-signing.sh
#
# Regenerates `android/keystore.properties` by reading the release keystore
# password from macOS Keychain. Run this once after a fresh `npx cap sync`
# or after cloning the repo on a new machine.
#
# Prerequisites (one-time setup, done locally on 2026-05-12):
#   - Keystore file at ~/.config/petpanic/petpanic-release.keystore
#   - Password stored in macOS Keychain:
#       service: petpanic-android-release-keystore
#       account: petpanic
#
# To recover on a new machine you need BOTH the keystore file AND the
# Keychain entry. Both should be backed up separately — losing the keystore
# means losing the ability to publish updates to Google Play.

set -euo pipefail

KEYSTORE_PATH="${HOME}/.config/petpanic/petpanic-release.keystore"
KEYCHAIN_SERVICE="petpanic-android-release-keystore"
KEYCHAIN_ACCOUNT="petpanic"
ALIAS="petpanic"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROPS_FILE="${REPO_ROOT}/android/keystore.properties"

if [ ! -f "${KEYSTORE_PATH}" ]; then
  echo "ERROR: keystore not found at ${KEYSTORE_PATH}" >&2
  echo "Restore it from backup, or regenerate (warning: invalidates the SHA256 in assetlinks.json)." >&2
  exit 1
fi

PASSWORD=$(security find-generic-password -s "${KEYCHAIN_SERVICE}" -a "${KEYCHAIN_ACCOUNT}" -w 2>/dev/null) || {
  echo "ERROR: password not found in Keychain (service=${KEYCHAIN_SERVICE}, account=${KEYCHAIN_ACCOUNT})" >&2
  echo "Restore it from your password manager." >&2
  exit 1
}

cat > "${PROPS_FILE}" <<EOF
storeFile=${KEYSTORE_PATH}
storePassword=${PASSWORD}
keyAlias=${ALIAS}
keyPassword=${PASSWORD}
EOF

chmod 600 "${PROPS_FILE}"
echo "Wrote ${PROPS_FILE} (mode 600)"
echo "Release signing is now configured. You can build with:"
echo "  cd android && ./gradlew bundleRelease    # AAB for Play Store"
echo "  cd android && ./gradlew assembleRelease  # APK for sideload"
