// Peer-to-peer transport over a single WebRTC DataChannel.
//
// Signaling is manual: the host produces an "offer" blob, the guest pastes it
// and produces an "answer" blob, the host pastes that back. After that the two
// browsers talk directly — no server of ours is ever in the loop.
//
// A public STUN server is used only to discover each peer's public address so
// the connection can cross typical home NATs. STUN does not relay game data;
// it just helps the two browsers find each other. (Symmetric NATs that need a
// TURN relay won't connect without one — see the README.)

export type NetMessage =
  | { type: 'move'; x: number; y: number }
  | { type: 'reset' };

interface Handlers {
  onOpen: () => void;
  onClose: () => void;
  onMessage: (msg: NetMessage) => void;
}

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export class Peer {
  private pc: RTCPeerConnection;
  private channel?: RTCDataChannel;
  private handlers: Handlers;

  constructor(handlers: Handlers) {
    this.handlers = handlers;
    this.pc = new RTCPeerConnection(RTC_CONFIG);
  }

  /** Host step 1: create the offer blob to send to the guest. */
  async createOffer(): Promise<string> {
    const channel = this.pc.createDataChannel('game', { ordered: true });
    this.setupChannel(channel);
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.waitForIce();
    return encode(this.pc.localDescription!);
  }

  /** Host step 2: accept the guest's answer blob and finish connecting. */
  async acceptAnswer(blob: string): Promise<void> {
    await this.pc.setRemoteDescription(decode(blob));
  }

  /** Guest: accept the host's offer blob and produce an answer blob. */
  async createAnswer(blob: string): Promise<string> {
    this.pc.ondatachannel = (e) => this.setupChannel(e.channel);
    await this.pc.setRemoteDescription(decode(blob));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this.waitForIce();
    return encode(this.pc.localDescription!);
  }

  send(msg: NetMessage): void {
    if (this.channel?.readyState === 'open') {
      this.channel.send(JSON.stringify(msg));
    }
  }

  private setupChannel(channel: RTCDataChannel): void {
    this.channel = channel;
    channel.onopen = () => this.handlers.onOpen();
    channel.onclose = () => this.handlers.onClose();
    channel.onmessage = (e) => {
      try {
        this.handlers.onMessage(JSON.parse(e.data) as NetMessage);
      } catch {
        /* ignore malformed messages */
      }
    };
  }

  // Wait until ICE candidate gathering finishes so the local description is
  // complete and self-contained — then it all fits in one copy-paste blob
  // (non-trickle ICE).
  private waitForIce(): Promise<void> {
    return new Promise((resolve) => {
      if (this.pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const check = () => {
        if (this.pc.iceGatheringState === 'complete') {
          this.pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      };
      this.pc.addEventListener('icegatheringstatechange', check);
    });
  }
}

function encode(desc: RTCSessionDescription): string {
  return btoa(JSON.stringify(desc));
}

function decode(blob: string): RTCSessionDescriptionInit {
  return JSON.parse(atob(blob.trim()));
}
