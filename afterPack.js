// afterPack hook: inject custom icon + version info into the packaged exe.
// rcedit has a known bug with paths containing spaces, so we work on a
// space-free temp copy and swap it back.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

exports.default = async function (context) {
  if (context.electronPlatformName !== 'win32') return;

  const exe = path.join(context.appOutDir, 'DeepSeek Harness.exe');
  const icon = path.join(__dirname, 'icon.ico');
  const rcedit = path.join(__dirname, 'tools', 'rcedit-x64.exe');
  const tmp = path.join(os.tmpdir(), 'dsh_app_icon.exe');

  fs.copyFileSync(exe, tmp);
  execFileSync(rcedit, [
    tmp,
    '--set-icon', icon,
    '--set-version-string', 'ProductName', 'DeepSeek Harness',
    '--set-version-string', 'FileDescription', 'DeepSeek Harness Desktop',
    '--set-file-version', '1.0.0',
    '--set-product-version', '1.0.0',
  ]);
  fs.copyFileSync(tmp, exe);
  fs.unlinkSync(tmp);
};
