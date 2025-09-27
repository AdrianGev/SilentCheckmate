# Icon Creation Instructions

For the Silent Checkmate application, you'll need icons in different formats for different platforms:

1. **Windows**: `icon.ico` (16x16, 32x32, 48x48, 256x256)
2. **macOS**: `icon.icns` (16x16, 32x32, 128x128, 256x256, 512x512)
3. **Linux**: `icon.png` (512x512 recommended)

## Icon Design Suggestions

For a chess application, consider using:
- A chess piece (like a knight or queen) as the main element
- A simple, recognizable silhouette
- Limited color palette (2-3 colors maximum)
- Clean lines and shapes

## How to Create Icons

### Option 1: Use an Online Icon Generator

1. Create a base image (PNG) using a tool like Figma, Adobe Illustrator, or even PowerPoint
2. Use an online converter like https://convertio.co/ or https://icoconvert.com/ to convert to different formats

### Option 2: Use Icon Creation Software

- **IconWorkshop** (Windows)
- **Image2icon** (macOS)
- **GIMP** (cross-platform, free)

## Icon Placement

Place the generated icons in the following locations:
- `public/icon.ico` (Windows)
- `public/icon.icns` (macOS)
- `public/icon.png` (Linux)

These paths are already configured in the `package.json` file for electron-builder.
