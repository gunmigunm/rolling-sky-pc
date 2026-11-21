# 从零重建「滚动的天空 PC 版」
# 依赖：Windows 10/11 + Microsoft Edge + .NET Framework 4 (自带 csc.exe)
param([string]$OutDir = "$PSScriptRoot\滚动的天空PC")

$ErrorActionPreference = 'Stop'
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
$base = 'https://rollingsky.3kh0.net/'
$game = Join-Path $OutDir 'game'
New-Item -ItemType Directory -Force -Path (Join-Path $game 'web\Build') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $game 'assets\music') | Out-Null

Write-Host '[1/4] 下载 Unity WebGL 构建 (约 51MB)'
$files = @('index.html', 'web/p.css', 'web/m.js', 'web/p.js', 'web/Build/UnityLoader.js', 'web/Build/WebPlayer.json',
  'web/Build/WebPlayer.asm.memory.unityweb', 'web/Build/WebPlayer.asm.framework.unityweb',
  'web/Build/WebPlayer.asm.code.unityweb', 'web/Build/WebPlayer.data.unityweb')
foreach ($f in $files) {
  $out = Join-Path $game $f.Replace('/', '\')
  curl.exe -sL -A $ua ($base + $f) -o $out
  Write-Host "  $f"
}

Write-Host '[2/4] 下载 41 首关卡 BGM (约 470MB)'
# 曲目编号：1-42, 70（mp3/flac 混排），完整清单见 3kh0/rolling-sky 仓库 assets/music
$tracks = @('1.mp3','2.mp3','3.mp3','4.mp3','5.mp3') + (6..30 | ForEach-Object { "$_.flac" }) + @('32.flac','33.flac','35.flac','36.flac','37.flac','38.flac','39.flac','40.flac','41.flac','42.flac','70.flac')
foreach ($t in $tracks) { curl.exe -sL -A $ua ($base + 'assets/music/' + $t) -o (Join-Path $game "assets\music\$t") }

Write-Host '[3/4] 注入 Bot 与键盘映射'
$idx = Join-Path $game 'index.html'
$t = Get-Content -LiteralPath $idx -Raw
if ($t -notmatch 'bot.js') {
  $inject = "`n<script>`n(function(){var o=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(t,a){if(t===`"webgl`"||t===`"webgl2`"||t===`"experimental-webgl`"){a=a||{};a.preserveDrawingBuffer=true;}return o.call(this,t,a);};})();`n</script>`n<script src=`"bot.js`" defer></script>`n"
  $t = $t -replace '(<title>[^<]*</title>)', ("`$1" + $inject)
  Set-Content -LiteralPath $idx -Value $t -Encoding UTF8
}
Copy-Item (Join-Path $PSScriptRoot 'bot.js') (Join-Path $game 'bot.js') -Force

Write-Host '[4/4] 编译启动器'
$csc = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $csc /nologo /target:winexe /out:(Join-Path $OutDir '滚动的天空.exe') (Join-Path $PSScriptRoot 'launcher.cs')
Copy-Item (Join-Path $PSScriptRoot '使用说明.txt') (Join-Path $OutDir '使用说明.txt') -Force
Write-Host "完成：$OutDir"
