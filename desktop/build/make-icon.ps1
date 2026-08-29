# Generates icon.ico + icon.png — Angry Bird God icon.
# Red bird body, fierce angry eyes, golden divine halo.
Add-Type -AssemblyName System.Drawing

function New-Icon([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

  $s = [double]$size
  $cx = $s / 2.0; $cy = $s / 2.0

  # --- Background: dark warm disc ---
  $bgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 26, 21, 16))
  $g.FillEllipse($bgBrush, 0, 0, $s - 1, $s - 1)

  # Subtle rim
  $rimPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(120, 80, 60, 45), [Math]::Max(1, $s / 40))
  $g.DrawEllipse($rimPen, 1, 1, $s - 3, $s - 3)

  # --- Divine halo (golden ring above head) ---
  $haloCx = $cx
  $haloCy = $cy - $s * 0.32
  $haloRw = $s * 0.22
  $haloRh = $s * 0.08
  $haloWidth = [Math]::Max(2, $s / 18)

  # Glow behind halo
  $haloGlow = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(60, 255, 210, 60), $haloWidth + [Math]::Max(2, $s / 12))
  $g.DrawEllipse($haloGlow, $haloCx - $haloRw, $haloCy - $haloRh, $haloRw * 2, $haloRh * 2)

  # Halo ring
  $haloPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 255, 200, 50), $haloWidth)
  $g.DrawEllipse($haloPen, $haloCx - $haloRw, $haloCy - $haloRh, $haloRw * 2, $haloRh * 2)

  # --- Bird body (big red circle) ---
  $bodyR = $s * 0.33
  $bodyCy = $cy + $s * 0.04

  # Shadow/glow behind body
  $bodyGlow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 200, 40, 20))
  $g.FillEllipse($bodyGlow, $cx - $bodyR - $s * 0.03, $bodyCy - $bodyR + $s * 0.02, $bodyR * 2 + $s * 0.06, $bodyR * 2 + $s * 0.04)

  # Main body: red gradient approximation (dark red bottom, bright red top)
  $bodyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 210, 45, 35))
  $g.FillEllipse($bodyBrush, $cx - $bodyR, $bodyCy - $bodyR, $bodyR * 2, $bodyR * 2)

  # Lighter red highlight (upper-left)
  $highlight = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(80, 255, 100, 70))
  $g.FillEllipse($highlight, $cx - $bodyR * 0.7, $bodyCy - $bodyR * 0.9, $bodyR * 1.1, $bodyR * 0.9)

  # Belly: lighter orange-red oval at bottom
  $bellyBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 235, 140, 90))
  $bellyRw = $bodyR * 0.55
  $bellyRh = $bodyR * 0.45
  $g.FillEllipse($bellyBrush, $cx - $bellyRw, $bodyCy + $bodyR * 0.15, $bellyRw * 2, $bellyRh * 2)

  # --- Eyes (big white circles, angled inward for anger) ---
  $eyeR = $s * 0.11
  $eyeOffsetX = $s * 0.10
  $eyeCy = $bodyCy - $s * 0.06

  # White of left eye
  $eyeWhite = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
  $g.FillEllipse($eyeWhite, $cx - $eyeOffsetX - $eyeR, $eyeCy - $eyeR, $eyeR * 2, $eyeR * 2)
  # White of right eye
  $g.FillEllipse($eyeWhite, $cx + $eyeOffsetX - $eyeR, $eyeCy - $eyeR, $eyeR * 2, $eyeR * 2)

  # Pupils (small black, slightly inward)
  $pupilR = $s * 0.04
  $pupilOff = $s * 0.02
  $pupilBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 20, 20, 20))
  $g.FillEllipse($pupilBrush, $cx - $eyeOffsetX + $pupilOff - $pupilR, $eyeCy - $pupilR + $s * 0.01, $pupilR * 2, $pupilR * 2)
  $g.FillEllipse($pupilBrush, $cx + $eyeOffsetX - $pupilOff - $pupilR, $eyeCy - $pupilR + $s * 0.01, $pupilR * 2, $pupilR * 2)

  # --- Angry eyebrows (thick dark lines, angled down toward center) ---
  $browWidth = [Math]::Max(2, $s / 14)
  $browPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 50, 25, 15), $browWidth)
  $browPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $browPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  # Left eyebrow: high outer, low inner
  $g.DrawLine($browPen,
    ($cx - $eyeOffsetX - $eyeR * 0.9), ($eyeCy - $eyeR - $s * 0.02),
    ($cx - $s * 0.02), ($eyeCy - $eyeR + $s * 0.04))
  # Right eyebrow: high outer, low inner
  $g.DrawLine($browPen,
    ($cx + $eyeOffsetX + $eyeR * 0.9), ($eyeCy - $eyeR - $s * 0.02),
    ($cx + $s * 0.02), ($eyeCy - $eyeR + $s * 0.04))

  # --- Beak (yellow-orange triangle) ---
  $beakBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 240, 170, 40))
  $beakTip = $cy + $s * 0.12
  $beakLeft = $cx - $s * 0.07
  $beakRight = $cx + $s * 0.07
  $beakTop = $eyeCy + $s * 0.06

  $beakPts = @(
    (New-Object System.Drawing.PointF($cx, $beakTip)),
    (New-Object System.Drawing.PointF($beakLeft, $beakTop)),
    (New-Object System.Drawing.PointF($beakRight, $beakTop))
  )
  $g.FillPolygon($beakBrush, $beakPts)

  # Beak shadow line
  $beakPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 200, 130, 20), [Math]::Max(1, $s / 40))
  $g.DrawLine($beakPen, $cx, $beakTop, $cx, $beakTip)

  # --- Head feather tuft (2-3 red spiky feathers on top) ---
  $featherPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 180, 30, 20), [Math]::Max(2, $s / 20))
  $featherPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $featherPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  # Center feather (tallest)
  $g.DrawLine($featherPen, $cx, ($bodyCy - $bodyR + $s * 0.02), ($cx - $s * 0.01), ($bodyCy - $bodyR - $s * 0.12))
  # Left feather
  $g.DrawLine($featherPen, ($cx - $s * 0.06), ($bodyCy - $bodyR + $s * 0.04), ($cx - $s * 0.10), ($bodyCy - $bodyR - $s * 0.08))
  # Right feather
  $g.DrawLine($featherPen, ($cx + $s * 0.06), ($bodyCy - $bodyR + $s * 0.04), ($cx + $s * 0.10), ($bodyCy - $bodyR - $s * 0.08))

  # --- Small crown spikes on top (god element) ---
  $crownBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 210, 50))
  $crownBaseY = $bodyCy - $bodyR - $s * 0.02
  $crownW = $s * 0.04
  $crownH = $s * 0.06
  for ($i = -1; $i -le 1; $i++) {
    $bx = $cx + $i * $s * 0.06
    $pts = @(
      (New-Object System.Drawing.PointF($bx - $crownW / 2, $crownBaseY)),
      (New-Object System.Drawing.PointF($bx, $crownBaseY - $crownH)),
      (New-Object System.Drawing.PointF($bx + $crownW / 2, $crownBaseY))
    )
    $g.FillPolygon($crownBrush, $pts)
  }

  $g.Dispose()
  return $bmp
}

# Output next to this script (desktop/build/)
$outDir = $PSScriptRoot
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# PNG (256x256 for Electron / Linux)
$png = New-Icon 256
$png.Save((Join-Path $outDir 'icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$png.Dispose()

# ICO with multiple sizes (Windows taskbar / Start Menu / title bar)
$ms = New-Object System.IO.MemoryStream
$sizes = 16, 24, 32, 48, 64, 128, 256
$images = @()
foreach ($s in $sizes) { $images += ,(New-Icon $s) }

$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([UInt16]0); $bw.Write([UInt16]1); $bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
foreach ($img in $images) {
  $ims = New-Object System.IO.MemoryStream
  $img.Save($ims, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $ims.ToArray()
  $bw.Write([Byte]($img.Width % 256)); $bw.Write([Byte]($img.Height % 256))
  $bw.Write([Byte]0); $bw.Write([Byte]0)
  $bw.Write([UInt16]1); $bw.Write([UInt16]32)
  $bw.Write([UInt32]$bytes.Length); $bw.Write([UInt32]$offset)
  $offset += $bytes.Length
  $ims.Dispose()
}
foreach ($img in $images) {
  $ims = New-Object System.IO.MemoryStream
  $img.Save($ims, [System.Drawing.Imaging.ImageFormat]::Png)
  $bw.Write($ims.ToArray())
  $ims.Dispose()
  $img.Dispose()
}
[System.IO.File]::WriteAllBytes((Join-Path $outDir 'icon.ico'), $ms.ToArray())
$bw.Dispose(); $ms.Dispose()

Write-Host "Angry Bird God icons written to $outDir"
