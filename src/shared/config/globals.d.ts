declare const APP_VERSION: string;
declare const APP_ID: string;
declare module '*.html' { const source: string; export default source; }
declare module '*.css';

interface Window {
  __cccbibReady?: () => void;
  webOSSystem?: { launchParams?: string };
  PalmSystem?: { launchParams?: string };
  PalmServiceBridge?: new () => {
    onservicecallback: (message: string) => void;
    call: (uri: string, params: string) => void;
    cancel: () => void;
  };
  VTTCue: typeof VTTCue;
}
interface HTMLVideoElement {
  mediaId?: string;
  audioTracks?: { length: number; [index: number]: { enabled: boolean } };
  webkitDecodedFrameCount?: number;
}
