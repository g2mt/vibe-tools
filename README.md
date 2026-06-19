# globalize

Minimal map projection viewer using raylib 6.0. Renders an equirectangular image on a cube (flat, Mercator) or sphere.

## Build

```sh
make
```

Requires [raylib](https://www.raylib.com/) (`pkg-config --cflags --libs raylib`).

## Usage

```sh
./globalize equirectangular_image.png
```

## Controls

| Key | Action |
|---|---|
| Left drag | Rotate |
| Shift + left drag | Pan |
| Scroll wheel | Zoom |
| **S** | Screenshot to current folder |
| **Tab** | Toggle UI |
