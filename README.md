# 🎨 mini-scraper

[![NPM version](https://img.shields.io/npm/v/@sinedied/mini-scraper.svg)](https://www.npmjs.com/package/@sinedied/mini-scraper)
[![Build Status](https://github.com/sinedied/mini-scraper/workflows/build/badge.svg)](https://github.com/sinedied/mini-scraper/actions)
![Node version](https://img.shields.io/node/v/@sinedied/mini-scraper.svg)
[![XO code style](https://img.shields.io/badge/code_style-XO-5ed9c7.svg)](https://github.com/sindresorhus/xo)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

<img src="https://raw.githubusercontent.com/sinedied/mini-scraper/refs/heads/main/pic.jpg" alt="picture of a scraped boxart" width="180" align="right">

Artwork scraper for [MinUI](https://github.com/shauninman/MinUI), [NextUI](https://github.com/LoveRetro/NextUI) and [muOS](https://muos.dev/).

> [!NOTE]
> MinUI does't officially support boxarts, but still has [some support for it as stated by its author](https://www.reddit.com/r/SBCGaming/comments/1hycyqx/minui_box_art/).

**Features:**
- Scrapes boxart for your ROMs, in a compatible format with multiple frontends/OSes
- No account needed, uses [libretro thumbnails](https://github.com/libretro-thumbnails/libretro-thumbnails)
- Optionally uses local AI with [Ollama](https://ollama.com/) for better boxart matching
- No configuration needed

## Getting started

### Running Locally

Requires [Node.js](https://nodejs.org/), and optionally [Ollama](https://ollama.com/) for AI matching. You need to install these to be able to use the scraper.

This tool works with a Command Line Interface (CLI), and need to be installed and run from a terminal application.

Install the CLI globally by opening a terminal and running the following command:

```bash
npm install -g @sinedied/mini-scraper
```

To run the scraper, open a terminal and use the following command:

```bash
mscraper <rompath> [options]
```

Explanation:

- `<rompath>`: This is the path to the directory containing your ROMs.
- `[options]`: Replace this with the command-line arguments to be passed to the scraper.

### Running with Docker

Using the Docker image is the easiest way to run the scraper without needing to install Node.js or Ollama.

Firstly you will need to have Docker installed on your system. You can download and install Docker from the [official website](https://www.docker.com/).

Once this is done build the Docker image by running the following command in the project directory:

```bash
docker build -t mini-scraper .
```

Then, you can run the scraper with the following command:

```bash
docker run --rm -v <rompath>:/roms mini-scraper /roms [options]
```

Explanation:

- `--rm`: This removes the container after it has finished running.
- `-v <rompath>:/roms`: This mounts your ROMs directory to the /roms directory inside the container.  Replace <rompath> with the actual path to your ROMs.
- `mini-scraper`: This is the name of the Docker image.
- `/roms`: This is the directory inside the container where the ROMs are mounted.
- `[options]`: Replace this with the command-line arguments to be passed to the scraper.

## Options

When running the scraper, you can pass the following options:

- `-w, --width <size>`: Max width of the image (default: 300)
- `-h, --height <size>`: Max height of the image
- `-t, --type <type>`: Type of image to scrape (can be `boxart`, `snap`, `title`, `box+snap`, `box+title`) (default: `boxart`)
- `-o, --output <format>`: Artwork format (can be (`minui`, `nextui`, `muos`, `anbernic`) (default: `minui`)
- `-a, --ai`: Use AI for advanced matching (default: false)
- `-m, --ai-model <name>`: Ollama model to use for AI matching (default: `gemma2:2b`)
- `-r, --regions <regions>`: Preferred regions to use for AI matching (default: `World,Europe,USA,Japan`)
- `-f, --force`: Force scraping over existing images
- `--cleanup`: Removes all scraped images in target folder
- `--verbose`: Show detailed logs
- `-v, --version`: Show current version

> [!TIP]
> Max width must be adjusted depending of the device and output format, the default works well for Trimui Brick. For 640x480 devices, try with `--width 200`.

## Example

```bash
mscraper myroms --width 300 --ai
```

This will scrape the ROMs in the `myroms` folder with a max image width of 300 and using AI for advanced matching.

## Supported Systems

The following systems are supported for scraping:

<details>
<summary>Click to expand</summary>

- Nintendo - Game Boy Color
- Nintendo - Game Boy Advance
- Nintendo - Game Boy
- Nintendo - Super Nintendo Entertainment System
- Nintendo - Nintendo 64DD
- Nintendo - Nintendo 64
- Nintendo - Family Computer Disk System
- Nintendo - Nintendo Entertainment System
- Nintendo - Nintendo DSi
- Nintendo - Nintendo DS
- Nintendo - Pokemon Mini
- Nintendo - Virtual Boy
- Handheld Electronic Game
- Sega - 32X
- Sega - Dreamcast
- Sega - Mega Drive - Genesis
- Sega - Mega-CD - Sega CD
- Sega - Game Gear
- Sega - Master System - Mark III
- Sega - Saturn
- Sega - Naomi 2
- Sega - Naomi
- Sony - PlayStation
- Sony - PlayStation Portable
- Amstrad - CPC
- Atari - 2600
- Atari - 5200
- Atari - 7800
- Atari - Jaguar
- Atari - Lynx
- Atari - ST
- Bandai - WonderSwan Color
- Bandai - WonderSwan
- Coleco - ColecoVision
- Commodore - Amiga
- Commodore - VIC-20
- Commodore - 64
- FBNeo - Arcade Games
- GCE - Vectrex
- GamePark - GP32
- MAME
- Microsoft - MSX
- Mattel - Intellivision
- NEC - PC Engine CD - TurboGrafx-CD
- NEC - PC Engine SuperGrafx
- NEC - PC Engine - TurboGrafx 16
- SNK - Neo Geo CD
- SNK - Neo Geo Pocket Color
- SNK - Neo Geo Pocket
- SNK - Neo Geo
- Magnavox - Odyssey2
- TIC-80
- Sharp - X68000
- Watara - Supervision
- DOS
- DOOM
- ScummVM
- Atomiswave

</details>
