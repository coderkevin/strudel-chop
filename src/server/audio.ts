import { spawn } from 'node:child_process';
import type { AudioMetadata } from '../shared/types';

function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(stdout).toString('utf8'));
        return;
      }

      reject(new Error(Buffer.concat(stderr).toString('utf8') || `${command} exited ${code}`));
    });
  });
}

export async function probeAudio(filePath: string): Promise<AudioMetadata> {
  const raw = await runCommand('ffprobe', [
    '-v',
    'error',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    filePath
  ]);
  const probe = JSON.parse(raw) as {
    format?: { duration?: string; format_name?: string; bit_rate?: string };
    streams?: Array<{ codec_type?: string; sample_rate?: string; channels?: number }>;
  };
  const audioStream = probe.streams?.find((stream) => stream.codec_type === 'audio');

  return {
    duration: Number.parseFloat(probe.format?.duration ?? '0'),
    formatName: probe.format?.format_name,
    sampleRate: audioStream?.sample_rate ? Number.parseInt(audioStream.sample_rate, 10) : undefined,
    channels: audioStream?.channels,
    bitRate: probe.format?.bit_rate ? Number.parseInt(probe.format.bit_rate, 10) : undefined
  };
}

export async function exportWavSlice(
  inputPath: string,
  outputPath: string,
  start: number,
  end: number,
  fadeIn = 0,
  fadeOut = 0
): Promise<void> {
  const duration = Math.max(0, end - start);
  const filters = buildFadeFilters(duration, fadeIn, fadeOut);
  const args = [
    '-y',
    '-ss',
    start.toFixed(6),
    '-to',
    end.toFixed(6),
    '-i',
    inputPath,
    '-acodec',
    'pcm_s16le',
    '-ar',
    '44100'
  ];

  if (filters.length) {
    args.push('-af', filters.join(','));
  }

  args.push(outputPath);

  await runCommand('ffmpeg', args);
}

function buildFadeFilters(duration: number, fadeIn: number, fadeOut: number): string[] {
  const safeFadeIn = clampFadeDuration(fadeIn, duration);
  const safeFadeOut = clampFadeDuration(fadeOut, duration);
  const filters: string[] = [];

  if (safeFadeIn > 0) {
    filters.push(`afade=t=in:st=0:d=${safeFadeIn.toFixed(6)}`);
  }

  if (safeFadeOut > 0) {
    const fadeOutStart = Math.max(0, duration - safeFadeOut);
    filters.push(`afade=t=out:st=${fadeOutStart.toFixed(6)}:d=${safeFadeOut.toFixed(6)}`);
  }

  return filters;
}

function clampFadeDuration(value: number, duration: number): number {
  if (!Number.isFinite(value) || value <= 0 || duration <= 0) {
    return 0;
  }

  return Math.min(value, duration);
}
