# Sub-Hex Extraction

These pieces are cut from `hex-tile-*.png` in `D:\Code\Mapster\Examples\Hexs`.

## Slots per source tile

- `nw`
- `n`
- `ne`
- `sw`
- `c` (center)
- `se`
- `s`

Each source tile folder contains:

- `...--<slot>.png` (transparent masked small hex)
- `...--sheet.png` (quick visual check)

## Regenerate

```powershell
cd D:\Code\Mapster
python .\scripts\cut_subhexes.py
```

