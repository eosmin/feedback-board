#!/usr/bin/env bash
# Verify every npm pin in §2 exists on the registry. Run before the first install.
set -uo pipefail
TDD="${1:-.docs/TDD.md}"

pins() {
  awk '
    /^## 2\. Tech Stack/   {inside=1; next}
    /^## 3\. Architecture/ {inside=0}
    !inside || !/^\| /     {next}
    {
      # Version: first **bolded** field starting with a digit. Prose after the closing **
      # is ignored; a suffix inside it ("24.21.0 LTS") is cut at the space.
      if (match($0, /\*\*[0-9][^*%]*\*\*/) == 0) next
      ver = substr($0, RSTART + 2, RLENGTH - 4); sub(/ .*/, "", ver)

      # Names: every `backticked` identifier in the first cell. One row may pin several
      # packages to one version (@nestjs/core, @nestjs/common, @nestjs/platform-express).
      split($0, cell, "|"); name_cell = cell[2]; n = 0
      while (match(name_cell, /`[^`]+`/)) {
        print substr(name_cell, RSTART + 1, RLENGTH - 2) "@" ver
        name_cell = substr(name_cell, RSTART + RLENGTH); n++
      }
      if (n > 0) next

      # No backticks: a prose label. Map the ones that are npm packages, drop the rest.
      gsub(/^[ \t]+|[ \t]+$/, "", cell[2]); label = cell[2]
      if      (label == "ESLint")       print "eslint@" ver
      else if (label == "Prettier")     print "prettier@" ver
      else if (label == "Supabase CLI") print "supabase@" ver
      else if (label == "pnpm")         print "pnpm@" ver
      else if (label == "TypeScript")   print "typescript@" ver
      else if (label == "husky")        print "husky@" ver
      else if (label == "lint-staged")  print "lint-staged@" ver
      # Node.js, PostgreSQL, Docker Engine and Docker Compose are not npm packages.
      # Stripe CLI is pinned to "latest" and never matches the digit-anchored regex.
    }
  ' "$TDD" | sort -u
}

fail=0
while IFS= read -r spec; do
  if npm view "$spec" version >/dev/null 2>&1; then
    echo "OK      $spec"
  else
    echo "MISSING $spec   -> npm view ${spec%@*} versions --json | tail -20"
    fail=1
  fi
done < <(pins)

echo
echo "checked $(pins | wc -l | tr -d ' ') pins"
[ "$fail" -eq 0 ] && echo "RESULT: all pins exist" || echo "RESULT: fix section 2 before installing"
exit "$fail"
