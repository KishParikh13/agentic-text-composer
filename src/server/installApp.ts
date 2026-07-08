import { mkdir, writeFile, chmod } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

const PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Compose</string>
  <key>CFBundleDisplayName</key><string>Compose</string>
  <key>CFBundleIdentifier</key><string>dev.kish.compose</string>
  <key>CFBundleVersion</key><string>0.1.0</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>compose-open</string>
  <key>CFBundleDocumentTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeExtensions</key>
      <array><string>md</string><string>markdown</string></array>
      <key>CFBundleTypeName</key><string>Markdown Document</string>
      <key>CFBundleTypeRole</key><string>Editor</string>
    </dict>
  </array>
</dict>
</plist>
`

export async function installApp(targetDir?: string): Promise<string> {
  const cliPath = join(dirname(fileURLToPath(import.meta.url)), 'cli.js')
  const script = `#!/bin/bash\nexec "${process.execPath}" "${cliPath}" "$@"\n`

  const tryInstall = async (dir: string) => {
    const app = join(dir, 'Compose.app')
    const macos = join(app, 'Contents', 'MacOS')
    await mkdir(macos, { recursive: true })
    await writeFile(join(app, 'Contents', 'Info.plist'), PLIST, 'utf8')
    const exe = join(macos, 'compose-open')
    await writeFile(exe, script, 'utf8')
    await chmod(exe, 0o755)
    return app
  }

  let app: string
  if (targetDir) {
    app = await tryInstall(targetDir)
  } else {
    try {
      app = await tryInstall('/Applications')
    } catch {
      const fallback = join(os.homedir(), 'Applications')
      app = await tryInstall(fallback)
    }
  }

  console.log(`Installed ${app}`)
  console.log('To make it the default for markdown files:')
  console.log('  Right-click any .md file in Finder, Get Info, Open with: Compose, then Change All.')
  console.log('First launch may need right-click, Open, since the app is unsigned.')
  return app
}
