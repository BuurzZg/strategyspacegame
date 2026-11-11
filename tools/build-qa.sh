#!/bin/bash
# Builds a tester (QA) package:  bash tools/build-qa.sh qa-1
# Copies the game into dist/driftforge-<name>/, stamps the build (name, commit, date) into
# src/version.js so it shows on the title screen and in bug reports, adds a README for players,
# and zips it for itch.io (index.html at the top of the zip, everything relative).
set -e
NAME=${1:?usage: bash tools/build-qa.sh qa-1}
cd "$(dirname "$0")/.."
COMMIT=$(git rev-parse --short HEAD)
DATE=$(date -u +%Y-%m-%d)
OUT=dist/driftforge-$NAME
ZIP=dist/driftforge-$NAME-itch.zip
rm -rf "$OUT" "$ZIP"
mkdir -p "$OUT"
cp -r index.html guide.html src lib content "$OUT"/
sed -i "s/export const BUILD = 'dev';/export const BUILD = '$NAME · $COMMIT · $DATE';/" "$OUT/src/version.js"
grep -q "$COMMIT" "$OUT/src/version.js" || { echo "could not stamp the build" >&2; exit 1; }
cat > "$OUT/README.txt" <<TXT
DRIFTFORGE, tester build $NAME ($COMMIT, $DATE)

A space survival game for the browser. Open guide.html for the tester guide: the controls, what
to test, and how to report a bug (press F8 in the game).

To play from this folder you need a small local web server, because browsers will not load the
game's modules from a file:// address. For example, in this folder:
    python3 -m http.server 8000
then open http://localhost:8000/ in Chrome, Edge, Firefox or Safari.

three.js is used under the MIT licence (lib/LICENSE).
TXT
(cd "$OUT" && zip -qr "../$(basename "$ZIP")" .)
echo "$OUT"
echo "$ZIP ($(du -h "$ZIP" | cut -f1))"
