import { spawnSync } from "node:child_process"
import { rmSync } from "node:fs"

const outputDirectory = "cpanel-deploy"
const archivePath = "cpanel-deploy.tar.gz"

rmSync(outputDirectory, { recursive: true, force: true })
rmSync(archivePath, { force: true })

const result = spawnSync(
  "docker",
  [
    "build",
    "--file",
    "Dockerfile.cpanel",
    "--target",
    "export",
    "--output",
    `type=local,dest=${outputDirectory}`,
    ".",
  ],
  { stdio: "inherit" },
)

if (result.error) {
  console.error("Không thể chạy Docker để build gói cPanel.", result.error)
  process.exit(1)
}

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}

const archiveResult = spawnSync(
  "tar",
  ["-czf", archivePath, "-C", outputDirectory, "."],
  { stdio: "inherit" },
)

if (archiveResult.error) {
  console.error("Không thể nén gói triển khai.", archiveResult.error)
  process.exit(1)
}

if (archiveResult.status !== 0) {
  process.exit(archiveResult.status ?? 1)
}

console.log(`Đã tạo thư mục ${outputDirectory}/ và file ${archivePath}`)
