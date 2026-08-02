#!/usr/bin/env bash
# Rebuilds the 3 example PDFs and preview screenshots for the live page.
# Run this on a machine with a LaTeX toolchain (pdflatex, pdfinfo, pdftoppm),
# not on the Mac (see the repo-wide rule against regenerable build output on
# the local machine). ampere-dev already has these tools installed.
#
# Usage (from the ampere-dev VM, after rsyncing multi-resume-kit/template/):
#   ./build-preview.sh
#
# Then scp the contents of output/ back into ../../public/multi-resume-kit/.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RES="$ROOT/template/Roles/Example"
OUT="$ROOT/output"
mkdir -p "$OUT"

for variant in ats digital physical; do
  dir="$RES/$variant"
  base=$(basename "$(ls "$dir"/*.tex)" .tex)

  (cd "$dir" && pdflatex -interaction=nonstopmode "$base.tex" >/dev/null
   pdflatex -interaction=nonstopmode "$base.tex" >/dev/null)

  pages=$(pdfinfo "$dir/$base.pdf" | grep Pages | awk '{print $2}')
  if [ "$pages" != "1" ]; then
    echo "WARNING: $variant compiled to $pages pages, expected 1" >&2
  fi

  cp "$dir/$base.pdf" "$OUT/$variant.pdf"
  pdftoppm -png -r 150 "$dir/$base.pdf" "$OUT/${variant}_preview"
  echo "$variant: $pages page(s), OK"
done

find "$RES" \( -name "*.aux" -o -name "*.log" -o -name "*.out" -o -name "*.pdf" \) -delete
echo "Done. Compiled PDFs and previews are in $OUT/"
