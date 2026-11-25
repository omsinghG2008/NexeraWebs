#!/bin/sh
# ---------------------------------------------------------------------------
# NEXERA · build-images.sh
# Turns one photo into five widths in AVIF, WebP and JPG, then prints the
# <picture> tag to paste into your HTML (static markup = best for SEO and speed).
#
# Usage:  sh tools/build-images.sh photo.jpg assets/img/team/om "Photo of Om Singh"
# Needs:  ImageMagick (the `magick` command).
# ---------------------------------------------------------------------------
src="$1"; out="$2"; alt="${3:-Describe the image}"
[ -z "$src" ] || [ -z "$out" ] && { echo "Usage: sh tools/build-images.sh photo.jpg assets/img/folder/name \"Alt text\""; exit 1; }
mkdir -p "$(dirname "$out")"

for w in 480 800 1200 1600 2000; do
  for ext in avif webp jpg; do
    magick "$src" -auto-orient -resize "${w}x>" -strip -quality 78 "$out-$w.$ext"
  done
done

set_for() { echo "$out-480.$1 480w, $out-800.$1 800w, $out-1200.$1 1200w, $out-1600.$1 1600w, $out-2000.$1 2000w"; }
echo
echo "Done. Paste this where the image belongs (set width/height to the real ratio):"
echo
echo "<picture>"
echo "  <source type=\"image/avif\" srcset=\"$(set_for avif)\" sizes=\"(max-width: 56rem) 92vw, 50vw\">"
echo "  <source type=\"image/webp\" srcset=\"$(set_for webp)\" sizes=\"(max-width: 56rem) 92vw, 50vw\">"
echo "  <img src=\"$out-1200.jpg\" srcset=\"$(set_for jpg)\" sizes=\"(max-width: 56rem) 92vw, 50vw\""
echo "       alt=\"$alt\" width=\"1200\" height=\"800\" loading=\"lazy\" decoding=\"async\">"
echo "</picture>"
