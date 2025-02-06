#!/bin/bash

# Create the icons directory if it doesn't exist
mkdir -p extension/public/icons

# Generate different sizes of the icon using ImageMagick
for size in 16 32 48 128; do
    convert -background none -resize ${size}x${size} extension/public/icons/shield.svg extension/public/icons/teeception-${size}.png
done

echo "Icons generated successfully!" 