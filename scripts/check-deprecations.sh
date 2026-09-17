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

# Each entry is "<extended-regex><TAB><why it is banned / what to use instead>".
#
# The separator is a literal tab, not a pipe: `|` is ERE alternation, so a pipe separator
# truncates any pattern that uses a group like `(render|hydrate)` at its first alternation and
# hands grep an unbalanced parenthesis. Combined with the error check below, that produced a
# scanner that reported "no banned APIs found" for patterns it never actually ran.
BANNED=(
  $'generateObject\tdeprecated in the ai package — use generateText + Output.object (§2.6.8a)'
  $'prisma-client-js\tlegacy generator — use prisma-client + @prisma/adapter-pg (§2.6.4)'
  $'\\$executeRawUnsafe\tunparameterized SQL — use set_config with bound parameters (§3.3)'
  $'@supabase/auth-helpers-nextjs\treplaced by @supabase/ssr 0.12 getAll/setAll (§2.6.6)'
  $'ReactDOM\\.(render|hydrate)\tremoved in React 19 — use createRoot/hydrateRoot (§2.3)'
  $'tailwind\\.config\\.js\tTailwind 4 is CSS-first — no JS config file (§2.6.9)'
  $'(queue|worker)\\.client\\b\tremoved from BullMQ 6 high-level classes — use getBackend().client (§2.6.14)'
  $'@nestjs/bull([^m]|$)\tthe Bull v3 package — use @nestjs/bullmq (§2.6.14)'
)

fail=0
for entry in "${BANNED[@]}"; do
  pattern="${entry%%$'\t'*}"
  reason="${entry#*$'\t'}"

  hits="$(grep -rInE "$pattern" . "${EXCLUDE_DIRS[@]}" "${EXCLUDE_FILES[@]}" 2>/dev/null)"
  status=$?

  # grep exits 0 on a hit, 1 on a clean pass, and >1 on an error such as a malformed regex.
  # Treating that third case as "clean" is how a broken pattern hides: the scan goes green
  # while checking nothing.
  if [ "$status" -gt 1 ]; then
    echo "SCANNER ERROR  $pattern"
    echo "               grep exited $status — the pattern is malformed, so nothing was checked"
    echo
    fail=1
    continue
  fi

  if [ "$status" -eq 0 ]; then
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
  echo "RESULT: banned APIs present or scanner broken — see TDD 7.6"
fi
exit "$fail"