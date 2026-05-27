export function buildTranscriptParams(videoId: string): string {
  const videoIdBytes = new TextEncoder().encode(videoId);

  // Manually packs the videoId into a serialized Protobuf structure (tags 0x0a, 0x12, 0x1a)
  // to fetch YouTube InnerTube transcripts without relying on page-scraped session tokens.
  const inner = new Uint8Array(2 + videoIdBytes.length);
  inner[0] = 0x0a;
  inner[1] = videoIdBytes.length;
  inner.set(videoIdBytes, 2);

  const outer = new Uint8Array(2 + inner.length);
  outer[0] = 0x12;
  outer[1] = inner.length;
  outer.set(inner, 2);

  const wrapper = new Uint8Array(2 + outer.length);
  wrapper[0] = 0x1a;
  wrapper[1] = outer.length;
  wrapper.set(outer, 2);

  return btoa(String.fromCharCode.apply(null, Array.from(wrapper)));
}
