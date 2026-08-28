"""Kokoro TTS server with voice blending for the Great Sage preset.

Start: python kokoro_server.py
"""

import io
import wave

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import numpy as np
from kokoro_onnx import Kokoro

app = FastAPI(title="kokoro-tts")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_tts = None

def get_tts():
    global _tts
    if _tts is None:
        _tts = Kokoro("kokoro-v1.0.onnx", "voices-v1.0.bin")
    return _tts

_VOICES = {
    "af_heart": "af_heart",
    "af_bella": "af_bella",
    "af_sarah": "af_sarah",
    "af_nicole": "af_nicole",
    "af_sky": "af_sky",
    "af": "af",
    "bf": "bf_emma",
    "am_adam": "am_adam",
    "am_michael": "am_michael",
}

# ── Custom blended voices ──────────────────────────────────────────────

def _blend(tts, components):
    """Blend Kokoro voice style tensors by weighted average.

    components: list of (voice_name: str, weight: float) tuples.
    """
    blended = None
    total = 0.0
    for name, weight in components:
        style = tts.get_voice_style(name)
        if blended is None:
            blended = style.astype(np.float32) * weight
        else:
            blended += style.astype(np.float32) * weight
        total += weight
    return blended / total

# The Great Sage: calm, analytical, slightly ethereal anime AI voice.
# Blend weights calibrated for an English female timbre that sounds
# deliberate, neutral-affect, and dignified.
GREAT_SAGE_VOICE = [
    ("af_nicole", 0.45),   # calm American female — base tone
    ("bf_emma",   0.25),   # British female — dignity, formality
    ("af_kore",   0.15),   # adds slightly cooler/neutral tone
    ("af_bella",  0.10),   # clarity, precision
    ("af_sky",    0.05),   # tiny bit of brightness so it's not muddy
]

def blended_voice_tensor(tts, components):
    """Return the blended (510, 1, 256) float32 style tensor."""
    return _blend(tts, components)


def encode_wav(audio, sample_rate):
    """Encode float32 [-1,1] numpy array to 16-bit PCM WAV bytes."""
    int16 = (np.clip(audio, -1, 1) * 32767).astype("<i2")
    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(int16.tobytes())
    return buf.getvalue()


@app.post("/v1/audio/speech")
async def speech(req: dict):
    text = (req.get("input") or "").strip()
    if not text:
        raise HTTPException(400, "No input text")

    voice_name = req.get("voice", "af_nicole")

    tts = get_tts()

    # Custom blended voices
    if voice_name == "great_sage":
        voice = blended_voice_tensor(tts, GREAT_SAGE_VOICE)
    elif voice_name in _VOICES:
        voice = _VOICES[voice_name]
    else:
        voice = "af_nicole"

    audio, sr = tts.create(text, voice=voice, speed=1.0, lang="en-us")
    wav_bytes = encode_wav(audio, sr)
    return Response(wav_bytes, media_type="audio/wav")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "voices": list(_VOICES.keys()) + ["great_sage"],
        "great_sage_blend": [{"voice": v, "weight": w} for v, w in GREAT_SAGE_VOICE],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8880, log_level="info")