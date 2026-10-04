export class CameraController {
  private stream: MediaStream | null = null;
  private readonly video: HTMLVideoElement;

  constructor(video: HTMLVideoElement) { this.video = video; }

  get active(): boolean { return Boolean(this.stream); }
  get settings(): MediaTrackSettings | null { return this.stream?.getVideoTracks()[0]?.getSettings() ?? null; }

  async start(deviceId?: string): Promise<MediaStream> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('このブラウザでは安全なカメラ機能を利用できません。HTTPSのURLをSafariまたはChromeで開いてください。');
    this.stop();
    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: deviceId ? undefined : { ideal: 'user' },
        deviceId: deviceId ? { exact: deviceId } : undefined,
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30, max: 30 },
      },
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.stream = stream;
    this.video.srcObject = stream;
    this.video.muted = true;
    this.video.playsInline = true;
    await this.video.play();
    for (const track of stream.getVideoTracks()) track.addEventListener('ended', () => this.onEnded?.());
    return stream;
  }

  onEnded: (() => void) | undefined;

  async listVideoInputs(): Promise<MediaDeviceInfo[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    return (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput');
  }

  stop(): void {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
  }
}
