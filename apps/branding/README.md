# Original app icon artwork

- `admin.png`: supplied `appLOGO admin.png`, for Windows admin app/installer.
- `customer.png`: supplied `appLOGO.png`, for Android customer launcher.

Original PNG files are retained without modification. `scripts/generate-app-icons.cjs` performs resizing and platform-format conversion only, without cropping or redesigning the artwork.

Run `npm run apps:icons` to regenerate Windows ICO/PNG, Android density PNGs and adaptive foreground. It uses the project's Sharp dependency, or `POLYLOOT_SHARP_PATH` if supplied. To import replacement files with the same original filenames, run `npm run apps:icons -- "C:/path/to/source-folder"`.

Windows ICO contains 16, 24, 32, 48, 64, 128 and 256 px images. Android foreground uses a 108dp canvas with centered 60dp artwork and a white background so launcher masks preserve the logo.
