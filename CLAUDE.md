# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: smpl-stopwatch

A minimal stopwatch web application that prioritizes displaying the current lap time. Static site designed for GitHub Pages hosting.

## Architecture

- `index.html` - Main HTML structure
- `styles.css` - All styling 
- `script.js` - JavaScript functionality
- No build process or dependencies required
- Uses localStorage for theme persistence
- Implements the smpl design system with 7 color themes

## Key Features

- Lap time as primary display (resets to 00:00 on each lap)
- Total time as secondary display
- Keyboard shortcuts for all actions
- Theme switching with arrow keys
- Slide-in modal drawer for help/shortcuts

## Testing

Tests use Playwright for screenshot capture and are located in `tests/` directory. These are for development only and not required for the application to function.
