/**
 * Audio recording service for push-to-talk voice input.
 * Uses expo-av for native recording.
 */
import { Audio } from 'expo-av';
import { InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { transcribeAudio } from '@/services/apiClient';
import type { TranscriptionResponse } from '@/schemas/indexing';

export type RecordingState = 'idle' | 'recording' | 'processing' | 'error';

export interface RecordingResult {
  uri: string;
  durationMs: number;
}

let recording: Audio.Recording | null = null;
let recordingState: RecordingState = 'idle';

export function getRecordingState(): RecordingState {
  return recordingState;
}

const recordingOptions: Audio.RecordingOptions = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 64000,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 64000,
  },
};

export async function startRecording(): Promise<void> {
  const permission = await Audio.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Microphone permission is required for voice input.');
  }

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });

  recording = new Audio.Recording();
  recordingState = 'recording';
  await recording.prepareToRecordAsync(recordingOptions);
  await recording.startAsync();
}

export async function stopRecording(): Promise<RecordingResult | null> {
  if (!recording) {
    throw new Error('No recording in progress.');
  }

  recordingState = 'processing';
  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  recording = null;

  if (!uri) {
    recordingState = 'idle';
    throw new Error('Recording produced no file.');
  }

  const info = await FileSystem.getInfoAsync(uri);
  const result: RecordingResult = {
    uri,
    durationMs: info.exists ? info.size : 0,
  };
  recordingState = 'idle';
  return result;
}

export async function cancelRecording(): Promise<void> {
  if (recording) {
    recordingState = 'idle';
    await recording.stopAndUnloadAsync();
    recording = null;
  }
}

export async function transcribeFromUri(uri: string): Promise<TranscriptionResponse> {
  const blob = await (await fetch(uri)).blob();
  const formData = new FormData();
  formData.append('audio', blob, 'recording.m4a');

  recordingState = 'processing';
  try {
    const response = await transcribeAudio(formData);
    recordingState = 'idle';
    return response;
  } catch (err) {
    recordingState = 'error';
    throw err;
  }
}

export async function cleanup(): Promise<void> {
  if (recording) {
    await recording.stopAndUnloadAsync();
    recording = null;
  }
  recordingState = 'idle';
}
