// Compiles the Go backend as a Tauri sidecar:
//   src-tauri/binaries/productivity-backend-<rust target triple>[.exe]
//
// Usage: node scripts/build-backend.mjs [--target <triple>]
// The target defaults to the host triple reported by `rustc -vV`.

import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const frontendDir = resolve(here, "..")
const backendDir = resolve(frontendDir, "..", "Backend")
const outDir = join(frontendDir, "src-tauri", "binaries")

const GO_TARGETS = {
  "x86_64-pc-windows-msvc": { GOOS: "windows", GOARCH: "amd64" },
  "aarch64-pc-windows-msvc": { GOOS: "windows", GOARCH: "arm64" },
  "x86_64-apple-darwin": { GOOS: "darwin", GOARCH: "amd64" },
  "aarch64-apple-darwin": { GOOS: "darwin", GOARCH: "arm64" },
  "x86_64-unknown-linux-gnu": { GOOS: "linux", GOARCH: "amd64" },
  "aarch64-unknown-linux-gnu": { GOOS: "linux", GOARCH: "arm64" },
}

function hostTriple() {
  const out = execFileSync("rustc", ["-vV"], { encoding: "utf8" })
  const match = out.match(/^host:\s*(\S+)/m)
  if (!match) throw new Error("Could not read the host target from `rustc -vV`.")
  return match[1]
}

const targetFlag = process.argv.indexOf("--target")
const triple = targetFlag > -1 ? process.argv[targetFlag + 1] : process.env.TAURI_ENV_TARGET_TRIPLE || hostTriple()
const goTarget = GO_TARGETS[triple]
if (!goTarget) {
  console.error(`Unsupported target ${triple}. Supported: ${Object.keys(GO_TARGETS).join(", ")}`)
  process.exit(1)
}

const { version } = JSON.parse(readFileSync(join(frontendDir, "src-tauri", "tauri.conf.json"), "utf8"))
const ext = goTarget.GOOS === "windows" ? ".exe" : ""
const output = join(outDir, `productivity-backend-${triple}${ext}`)
mkdirSync(outDir, { recursive: true })

console.log(`Building Go backend ${version} for ${triple} -> ${output}`)
execFileSync(
  "go",
  ["build", "-trimpath", "-ldflags", `-s -w -X main.version=${version}`, "-o", output, "./cmd/server"],
  {
    cwd: backendDir,
    stdio: "inherit",
    env: { ...process.env, ...goTarget, CGO_ENABLED: "0" },
  },
)
