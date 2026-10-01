export async function synthesizeSpeech(text: string): Promise<Blob | null> {
  try {
    const response = await fetch("/api/tts/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}