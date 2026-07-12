export interface TranscriptionPeer {
  readonly peer: RTCPeerConnection;
  readonly events: RTCDataChannel;
  commit(): void;
  close(): void;
}
export async function connectTranscriptionPeer(
  stream: MediaStream,
  brokerUrl: string,
  onEvent: (event: unknown) => void,
  signal: AbortSignal,
): Promise<TranscriptionPeer> {
  const peer = new RTCPeerConnection();
  for (const track of stream.getAudioTracks()) peer.addTrack(track, stream);
  const events = peer.createDataChannel("oai-events");
  events.addEventListener("message", (message) => {
    try {
      onEvent(JSON.parse(String(message.data)));
    } catch {
      onEvent({ type: "invalid_event" });
    }
  });
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  const offerSdp = offer.sdp;
  if (!offerSdp) {
    peer.close();
    throw new Error("WEBRTC_OFFER_INVALID");
  }
  const response = await fetch(brokerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/sdp",
      "x-role": "pharmacist",
      "x-tenant": "local-demo",
      "x-user": "local-user",
      "x-app-passcode": sessionStorage.getItem("pharmassist_access") ?? "",
    },
    body: offerSdp,
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    peer.close();
    throw new Error("REALTIME_UNAVAILABLE");
  }
  await peer.setRemoteDescription({
    type: "answer",
    sdp: await response.text(),
  });
  const commit = () => {
    const sendCommit = () =>
      events.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
    if (events.readyState === "open") sendCommit();
    else if (events.readyState === "connecting")
      events.addEventListener("open", sendCommit, { once: true });
    stream.getTracks().forEach((track) => track.stop());
  };
  const close = () => {
    stream.getTracks().forEach((track) => track.stop());
    events.close();
    peer.close();
  };
  signal.addEventListener("abort", close, { once: true });
  return { peer, events, commit, close };
}
