import { createRequire } from 'node:module';
import type { ChopKeyDetection, ChopRegion, MusicalScale } from '../shared/types';
import { readMonoPcmSlice } from './audio';

const KEY_DETECTION_SAMPLE_RATE = 44100;
const MIN_KEY_DETECTION_DURATION = 0.5;
const MIN_KEY_DETECTION_STRENGTH = 0.35;

type KeyExtractorResult = {
  key?: string;
  scale?: string;
  strength?: number;
};

type EssentiaInstance = {
  arrayToVector: (audio: Float32Array) => unknown;
  KeyExtractor: (audio: unknown) => KeyExtractorResult;
};

type EssentiaConstructor = new (wasmModule: unknown) => EssentiaInstance;

type EssentiaModule = {
  Essentia: EssentiaConstructor;
  EssentiaWASM: unknown;
};

const require = createRequire(import.meta.url);
const { Essentia, EssentiaWASM } = require('essentia.js') as EssentiaModule;
const essentia = new Essentia(EssentiaWASM);

export async function detectChopKey(inputPath: string, chop: ChopRegion): Promise<ChopKeyDetection> {
  const detectedAt = new Date().toISOString();
  const duration = chop.end - chop.start;

  if (duration < MIN_KEY_DETECTION_DURATION) {
    return { status: 'no_clear_key', reason: 'too_short', detectedAt };
  }

  try {
    const audio = await readMonoPcmSlice(inputPath, chop.start, chop.end, KEY_DETECTION_SAMPLE_RATE);
    const result = essentia.KeyExtractor(essentia.arrayToVector(audio));
    const strength = Number.isFinite(result.strength) ? result.strength ?? 0 : 0;
    const scale = normalizeScale(result.scale);
    const tonic = result.key?.trim();

    if (!tonic || !scale || strength < MIN_KEY_DETECTION_STRENGTH) {
      return { status: 'no_clear_key', reason: 'low_confidence', strength, detectedAt };
    }

    return {
      status: 'detected',
      tonic,
      scale,
      strength,
      detectedAt
    };
  } catch {
    return { status: 'no_clear_key', reason: 'analysis_failed', detectedAt };
  }
}

function normalizeScale(scale: string | undefined): MusicalScale | null {
  if (scale === 'major' || scale === 'minor') {
    return scale;
  }

  return null;
}
