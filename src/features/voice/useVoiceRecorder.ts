import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

export type MicPermissionStatus = 'unknown' | 'granted' | 'denied';

/**
 * push-to-talk録音フック。タップ/長押しで録音を開始し、離すと停止する。
 * マイク使用中は state.isRecording を画面側で常に明示する。
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 100);
  const [permission, setPermission] = useState<MicPermissionStatus>('unknown');
  const preparedRef = useRef(false);

  useEffect(() => {
    getRecordingPermissionsAsync()
      .then((res) => setPermission(res.granted ? 'granted' : 'unknown'))
      .catch(() => setPermission('unknown'));
  }, []);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const res = await requestRecordingPermissionsAsync();
    setPermission(res.granted ? 'granted' : 'denied');
    return res.granted;
  }, []);

  const start = useCallback(async () => {
    const granted = permission === 'granted' ? true : await ensurePermission();
    if (!granted) return false;
    if (!preparedRef.current) {
      await recorder.prepareToRecordAsync();
      preparedRef.current = true;
    }
    recorder.record();
    return true;
  }, [permission, ensurePermission, recorder]);

  const stop = useCallback(async (): Promise<string | null> => {
    if (!recorderState.isRecording) return recorder.uri;
    await recorder.stop();
    preparedRef.current = false;
    return recorder.uri;
  }, [recorder, recorderState.isRecording]);

  return {
    isRecording: recorderState.isRecording,
    durationMillis: recorderState.durationMillis,
    permission,
    ensurePermission,
    start,
    stop,
    uri: recorder.uri,
  };
}
