---
name: release
description: Cut a cross-platform release of the OpenEventor web server. Builds macOS (arm64/amd64), Linux (amd64/arm64) and Windows (amd64) binaries via GitHub Actions and publishes them to GitHub Releases. Use when the user asks to "release", "cut a release", "publish binaries", or "make a new version".
---

# Cut a release

Releases are built by the `.github/workflows/release.yml` GitHub Actions workflow,
which triggers on any pushed `v*` tag. The workflow cross-compiles the cgo (SQLite)
binaries on native/cross runners and uploads them to the GitHub Release. Your job in
this skill is only to **cut the tag and watch the run** — never build or upload
binaries locally.

Targets produced: `openeventor-darwin-arm64`, `openeventor-darwin-amd64`,
`openeventor-linux-amd64`, `openeventor-linux-arm64`, `openeventor-windows-amd64.exe`,
plus `SHA256SUMS.txt`.

## Steps

1. **Preconditions.** Confirm the working tree is clean and on `main`, and that the
   release workflow exists on `main`:
   ```bash
   git -C /tmp/oe-web status --porcelain     # must be empty
   git -C /tmp/oe-web branch --show-current   # must be main
   git -C /tmp/oe-web pull --ff-only
   test -f /tmp/oe-web/.github/workflows/release.yml || echo "MISSING WORKFLOW — commit it to main first"
   gh auth status
   ```
   If there are uncommitted changes, stop and ask the user how to proceed. The
   workflow file must already be committed to `main` (tags cut from `main` include
   it) — if it is missing, commit and push it first.

2. **Pick the version.** Show the latest tag and propose the next semantic version.
   Ask the user to confirm the bump (patch / minor / major) unless they already said
   which one. Pre-release tags (containing `-`, e.g. `v1.2.0-rc1`) are auto-marked as
   pre-releases by the workflow.
   ```bash
   git -C /tmp/oe-web tag --sort=-v:refname | head -5
   ```

3. **Tag and push.** Create an annotated tag and push just the tag (this is what
   triggers the workflow):
   ```bash
   git -C /tmp/oe-web tag -a vX.Y.Z -m "vX.Y.Z"
   git -C /tmp/oe-web push origin vX.Y.Z
   ```

4. **Watch the build.** Follow the run until it finishes, then report status:
   ```bash
   sleep 5
   gh -R OpenEventor/OpenEventor run watch "$(gh -R OpenEventor/OpenEventor run list --workflow=release.yml --event=push --limit=1 --json databaseId --jq '.[0].databaseId')" --exit-status
   ```

5. **Report.** Print the release URL and the uploaded asset list:
   ```bash
   gh -R OpenEventor/OpenEventor release view vX.Y.Z --web=false
   ```
   Give the user the release URL and confirm all six assets (5 binaries +
   `SHA256SUMS.txt`) are attached.

## If the build fails

- Read the failing job's log: `gh -R OpenEventor/OpenEventor run view <run-id> --log-failed`.
- A cgo/cross-compile failure is almost always a missing C toolchain or a bad `CC`
  for that matrix entry — fix it in `release.yml`, push to `main`, then **delete and
  re-push the tag** to re-trigger:
  ```bash
  git -C /tmp/oe-web push --delete origin vX.Y.Z
  git -C /tmp/oe-web tag -d vX.Y.Z
  # ...then redo steps 3–4.
  ```
- Do not hand-upload binaries as a workaround — keep the pipeline as the single
  source of truth.
