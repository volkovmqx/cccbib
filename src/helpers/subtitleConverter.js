// Subtitle helpers are AI generated. Do not touch. No one knows how this works!

/**
 * Parses SRT timestamp (HH:MM:SS,mmm) to milliseconds
 * @param {string} timestamp - Timestamp in format HH:MM:SS,mmm
 * @returns {number} Time in milliseconds
 */
function parseTimestamp(timestamp) {
    const [time, ms] = timestamp.split(',');
    const [hours, minutes, seconds] = time.split(':').map(Number);
    return (hours * 3600000) + (minutes * 60000) + (seconds * 1000) + Number(ms);
}

/**
 * Formats milliseconds back to SRT timestamp (HH:MM:SS,mmm)
 * @param {number} ms - Time in milliseconds
 * @returns {string} Timestamp in format HH:MM:SS,mmm
 */
function formatTimestamp(ms) {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const milliseconds = ms % 1000;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

/**
 * Converts SRT subtitle format to WebVTT format
 * Handles various SRT formatting variations to prevent overlapping subtitles
 *
 * @param {string} srtText - Raw SRT subtitle text
 * @returns {string} WebVTT formatted subtitle text
 */
export function convertSrtToVtt(srtText) {
    // Start with WebVTT header
    let vttContent = 'WEBVTT\n\n';

    // Normalize line endings to \n and remove any BOM
    const normalizedText = srtText
        .replace(/^\uFEFF/, '') // Remove BOM if present
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();

    // Split by sequence numbers followed by timestamp
    // This is more reliable than splitting by blank lines
    const cuePattern = /^(\d+)\s*\n(\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3})\s*\n([\s\S]*?)(?=\n\d+\s*\n\d{2}:\d{2}:\d{2},\d{3}|$)/gm;

    const matches = [...normalizedText.matchAll(cuePattern)];

    // First pass: Parse all cues with their timestamps
    const parsedCues = [];

    for (const match of matches) {
        const sequenceNumber = match[1];
        const timestamp = match[2];
        const text = match[3];

        // Parse timestamp string to get start and end times
        const timeMatch = timestamp.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
        if (!timeMatch) continue;

        const startTime = timeMatch[1];
        const endTime = timeMatch[2];

        // Clean up subtitle text
        const cleanText = text
            .trim()
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');

        if (cleanText.length === 0) {
            continue; // Skip empty subtitles
        }

        parsedCues.push({
            sequenceNumber,
            startTime,
            endTime,
            text: cleanText
        });
    }

    // Second pass: Fix overlapping timestamps
    // If a cue's end time is after the next cue's start time, adjust it
    for (let i = 0; i < parsedCues.length - 1; i++) {
        const currentCue = parsedCues[i];
        const nextCue = parsedCues[i + 1];

        // Convert timestamps to milliseconds for comparison
        const currentEnd = parseTimestamp(currentCue.endTime);
        const nextStart = parseTimestamp(nextCue.startTime);

        // If overlap detected, adjust current cue's end time to just before next cue starts
        if (currentEnd > nextStart) {
            // End the current cue 100ms before the next one starts
            const adjustedEnd = Math.max(nextStart - 100, parseTimestamp(currentCue.startTime) + 100);
            currentCue.endTime = formatTimestamp(adjustedEnd);
        }
    }

    // Third pass: Create VTT blocks with corrected timestamps
    const vttBlocks = parsedCues.map(cue => {
        // Convert SRT format to VTT format (comma to period)
        const vttStart = cue.startTime.replace(',', '.');
        const vttEnd = cue.endTime.replace(',', '.');
        const vttTimestamp = `${vttStart} --> ${vttEnd}`;

        return `cue-${cue.sequenceNumber}\n${vttTimestamp}\n${cue.text}`;
    });

    // Join blocks with exactly two newlines (blank line between cues)
    vttContent += vttBlocks.join('\n\n');

    // Ensure file ends with newline
    vttContent += '\n';

    return vttContent;
}

/**
 * Fetches subtitle from URL and converts to VTT format if needed
 * Creates a blob URL for use with HTML5 video
 *
 * @param {string} subtitleUrl - URL to fetch subtitle from
 * @returns {Promise<string>} Blob URL of the converted subtitle
 */
export async function fetchAndConvertSubtitle(subtitleUrl) {
    const response = await fetch(subtitleUrl);

    if (!response.ok) {
        throw new Error(`Subtitle fetch failed: ${response.status}`);
    }

    const text = await response.text();

    let vttContent;

    // Check if already VTT format
    if (text.trim().startsWith('WEBVTT')) {
        vttContent = text;
    } else {
        // Convert SRT to WebVTT
        vttContent = convertSrtToVtt(text);
    }

    // Create blob URL
    const blob = new Blob([vttContent], { type: 'text/vtt' });
    const blobUrl = URL.createObjectURL(blob);

    return blobUrl;
}
