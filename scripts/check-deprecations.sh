#!/usr/bin/env bash
# Enforce the §7.6 banned-API list. A rule nothing enforces is decoration.
# Exits non-zero on the first hit. CI runs this as a lint step (§15).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# .docs/ is excluded on purpose: TDD.md names every banned identifier in order to ban it.
# CLAUDE.md and this script itself are excluded for exactly the same reason — they state the
# prohibition, so they must be allowed to spell out what is prohibited. Everything that is
# actually code stays in scope.
EXCLUDE_DIRS=(
  --exclude-dir=node_modules
  --exclude-dir=.git
  --exclude-dir=.docs
  --exclude-dir=dist
  --exclude-dir=build
  --exclude-dir=.next
  --exclude-dir=coverage
  --exclude-dir=generated
)
EXCLUDE_FILES=(
  --exclude=check-deprecations.sh
  --exclude=CLAUDE.md
  --exclude=pnpm-lock.yaml
)

# identifier <TAB> why it is banned / what to use instead
BANNED=(
  'generateObject|deprecated in the ai package — use generateText + Output.object (§2.6.8a)'
  'prisma-client-js|legacy generator — use prisma-client + @prisma/adapter-pg (§2.6.4)'
  '\$executeRawUnsafe|unparameterized SQL — use set_config with bound parameters (§3.3)'
  '@supabase/auth-helpers-nextjs|replaced by @supabase/ssr 0.12 getAll/setAll (§2.6.6)'
  'ReactDOM\.render|removed in React 19 — use createRoot (§2.3)'
  'tailwind\.config\.js|Tailwind 4 is CSS-first — no JS config file (§2.6.9)'
)

fail=0
for entry in "${BANNED[@]}"; do
  pattern="${entry%%|*}"
  reason="${entry#*|}"

  if hits="$(grep -rInE "$pattern" . "${EXCLUDE_DIRS[@]}" "${EXCLUDE_FILES[@]}" 2>/dev/null)"; then
    echo "BANNED  $pattern"
    echo "        $reason"
    echo "$hits" | sed 's/^/        /'
    echo
    fail=1
  fi
done

if [ "$fail" -eq 0 ]; then
  echo "RESULT: no banned APIs found (checked ${#BANNED[@]} patterns)"
else
  echo "RESULT: banned APIs present — see TDD 7.6"
fi
exit "$fail"