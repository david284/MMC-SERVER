#!/usr/bin/env bash

set -euo pipefail

VERSION="${1:-$(node -p "require('./package.json').version")}"

ARCHIVE="MMC-CLIENT-v${VERSION}.zip"
URL="https://github.com/jimmythedog/MMC-CLIENT/releases/download/v${VERSION}/${ARCHIVE}"

echo "Installing MMC-CLIENT ${VERSION}"

rm -rf public
mkdir -p public

curl --fail --location \
    "${URL}" \
    --output "${ARCHIVE}"

unzip -q "${ARCHIVE}" -d public

rm "${ARCHIVE}"

echo "MMC-CLIENT ${VERSION} installed into public/"
