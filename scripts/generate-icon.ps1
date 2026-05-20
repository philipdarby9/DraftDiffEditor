Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class IconBackgroundCleaner
{
    public static Bitmap LoadCleaned(string path)
    {
        using (var original = new Bitmap(path))
        {
            var bitmap = new Bitmap(original.Width, original.Height, PixelFormat.Format32bppArgb);
            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.CompositingMode = CompositingMode.SourceCopy;
                graphics.DrawImage(original, 0, 0, original.Width, original.Height);
            }

            RemoveEdgeBackground(bitmap);
            return bitmap;
        }
    }

    public static Rectangle GetVisibleBounds(Image image)
    {
        using (var bitmap = new Bitmap(image))
        {
            int minX = bitmap.Width;
            int minY = bitmap.Height;
            int maxX = -1;
            int maxY = -1;

            for (int y = 0; y < bitmap.Height; y++)
            {
                for (int x = 0; x < bitmap.Width; x++)
                {
                    if (bitmap.GetPixel(x, y).A <= 12) continue;
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }

            if (maxX < minX || maxY < minY)
            {
                return new Rectangle(0, 0, bitmap.Width, bitmap.Height);
            }

            return Rectangle.FromLTRB(minX, minY, maxX + 1, maxY + 1);
        }
    }

    private static void RemoveEdgeBackground(Bitmap bitmap)
    {
        int width = bitmap.Width;
        int height = bitmap.Height;
        var rect = new Rectangle(0, 0, width, height);
        var data = bitmap.LockBits(rect, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
        int stride = data.Stride;
        int rowBytes = Math.Abs(stride);
        byte[] pixels = new byte[rowBytes * height];
        Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);

        bool[] seen = new bool[width * height];
        var queue = new Queue<int>();
        Action<int, int> enqueue = (x, y) =>
        {
            if (x < 0 || y < 0 || x >= width || y >= height) return;
            int index = y * width + x;
            if (seen[index]) return;
            if (!IsBackgroundLike(pixels, stride, rowBytes, height, x, y)) return;
            seen[index] = true;
            queue.Enqueue(index);
        };

        for (int x = 0; x < width; x++)
        {
            enqueue(x, 0);
            enqueue(x, height - 1);
        }

        for (int y = 0; y < height; y++)
        {
            enqueue(0, y);
            enqueue(width - 1, y);
        }

        while (queue.Count > 0)
        {
            int index = queue.Dequeue();
            int x = index % width;
            int y = index / width;
            int offset = PixelOffset(stride, rowBytes, height, x, y);
            pixels[offset + 3] = 0;

            enqueue(x - 1, y);
            enqueue(x + 1, y);
            enqueue(x, y - 1);
            enqueue(x, y + 1);
        }

        Marshal.Copy(pixels, 0, data.Scan0, pixels.Length);
        bitmap.UnlockBits(data);
    }

    private static bool IsBackgroundLike(byte[] pixels, int stride, int rowBytes, int height, int x, int y)
    {
        int offset = PixelOffset(stride, rowBytes, height, x, y);
        int blue = pixels[offset];
        int green = pixels[offset + 1];
        int red = pixels[offset + 2];
        int alpha = pixels[offset + 3];
        if (alpha < 10) return true;

        int max = Math.Max(red, Math.Max(green, blue));
        int min = Math.Min(red, Math.Min(green, blue));
        return alpha > 245 && red >= 235 && green >= 235 && blue >= 235 && (max - min) <= 10;
    }

    private static int PixelOffset(int stride, int rowBytes, int height, int x, int y)
    {
        int row = stride >= 0 ? y : height - 1 - y;
        return row * rowBytes + x * 4;
    }
}
"@

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $root "icon.png"
$buildDir = Join-Path $root "build"
$icoPath = Join-Path $buildDir "icon.ico"

if (-not (Test-Path -LiteralPath $sourcePath)) {
  throw "Source icon not found: $sourcePath"
}

New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

function Convert-SourceToPngBytes([System.Drawing.Image]$source, [int]$size) {
  $bitmap = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $graphics.Clear([System.Drawing.Color]::Transparent)

  $sourceBounds = [IconBackgroundCleaner]::GetVisibleBounds($source)
  $padding = [Math]::Max(1, [int][Math]::Round($size * 0.03))
  $availableSize = $size - ($padding * 2)
  $scale = [Math]::Min($availableSize / $sourceBounds.Width, $availableSize / $sourceBounds.Height)
  $drawWidth = [int][Math]::Round($sourceBounds.Width * $scale)
  $drawHeight = [int][Math]::Round($sourceBounds.Height * $scale)
  $x = [int][Math]::Floor(($size - $drawWidth) / 2)
  $y = [int][Math]::Floor(($size - $drawHeight) / 2)
  $graphics.DrawImage($source, (New-Object System.Drawing.Rectangle $x, $y, $drawWidth, $drawHeight), $sourceBounds, [System.Drawing.GraphicsUnit]::Pixel)

  $memoryStream = New-Object System.IO.MemoryStream
  $bitmap.Save($memoryStream, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $memoryStream.ToArray()

  $graphics.Dispose()
  $bitmap.Dispose()
  $memoryStream.Dispose()
  return ,$bytes
}

$source = [IconBackgroundCleaner]::LoadCleaned($sourcePath)
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$images = @()

foreach ($size in $sizes) {
  $images += [pscustomobject]@{
    Size = $size
    Bytes = Convert-SourceToPngBytes $source $size
  }
}

$source.Dispose()

$headerSize = 6
$entrySize = 16
$offset = $headerSize + ($entrySize * $images.Count)
$stream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter $stream

$writer.Write([UInt16]0)
$writer.Write([UInt16]1)
$writer.Write([UInt16]$images.Count)

foreach ($image in $images) {
  $iconSize = if ($image.Size -eq 256) { 0 } else { $image.Size }
  $writer.Write([byte]$iconSize)
  $writer.Write([byte]$iconSize)
  $writer.Write([byte]0)
  $writer.Write([byte]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]32)
  $writer.Write([UInt32]$image.Bytes.Length)
  $writer.Write([UInt32]$offset)
  $offset += $image.Bytes.Length
}

foreach ($image in $images) {
  $writer.Write($image.Bytes)
}

[System.IO.File]::WriteAllBytes($icoPath, $stream.ToArray())
$writer.Dispose()
$stream.Dispose()

Write-Host "Generated $icoPath from $sourcePath"
