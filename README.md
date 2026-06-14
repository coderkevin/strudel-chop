# strudel-chop

A tool for chopping up tracks and samples made for importing as strudel sample packs

## What it does

Strudel Chop is a local browser app for preparing one source track into one Strudel sound. Import an MP3, FLAC, or WAV file, create an editable beat grid, select waveform regions as chops, audition and loop those chops, then export numbered WAV files that Strudel can load by index.

## Prerequisites

1. Install Node.js 22.12 or newer.

   ```bash
   node --version
   npm --version
   ```

2. Install `ffmpeg` and `ffprobe`.

   On macOS with Homebrew:

   ```bash
   brew install ffmpeg
   ```

   Verify both commands are available:

   ```bash
   ffmpeg -version
   ffprobe -version
   ```

## Install

```bash
git clone https://github.com/kevinkillingsworth/strudel-chop.git
cd strudel-chop
npm install
```

## Run

```bash
npm run dev
```

Then open:

```text
http://localhost:5432/app
```

The Strudel sample root is:

```text
http://localhost:5432/
```

By default, Strudel Chop creates a local library at:

```text
./strudel-chop-library
```

That folder is gitignored because it contains copied source audio, source metadata, and exported WAV files.

You can choose another library folder:

```bash
npm run dev -- --library /absolute/path/to/your/library
```

You can choose another port:

```bash
npm run dev -- --port 5440
```

## Basic workflow

1. Click `Import audio` and choose an `.mp3`, `.flac`, or `.wav`.
2. Play to the first real downbeat.
3. Click `Set downbeat here`.
4. Adjust BPM until the red playhead line lands on the beat tick lines while the track plays.
5. Add later tempo sections if the track changes tempo.
6. Drag on the waveform, or click `New chop`, to create a chop region.
7. Drag the chop region edges to tighten the beginning and end.
8. Select a chop and use `Audition` or `Loop` to check it.
9. Reorder chops to control their Strudel indexes.
10. Click `Save`, then `Export`.

## Use in Strudel

After exporting, load the local sample root in Strudel:

```js
samples('http://localhost:5432/')
```

Then play the exported sound by index:

```js
n("0 1 2 3").s("my_sound")
```

The exported files are written as:

```text
strudel-chop-library/
  exports/
    strudel.json
    my_sound/
      000.wav
      001.wav
      002.wav
```

## Development

Run tests:

```bash
npm test
```

Run TypeScript checks:

```bash
npm run typecheck
```
