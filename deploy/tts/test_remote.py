import os
import unittest
from unittest import mock

import remote


class VoiceVersion(unittest.TestCase):
    def test_kokoro_uses_styles_version(self) -> None:
        with mock.patch.dict(os.environ, {"TTS_BACKEND": "kokoro"}, clear=True):
            self.assertEqual(remote.voice_version({"voiceVersion": "k1"}), "k1")

    def test_remote_version_names_backend_and_voice(self) -> None:
        env = {"TTS_BACKEND": "openai-compatible", "TTS_VOICE": "Gatxel Female"}
        with mock.patch.dict(os.environ, env, clear=True):
            self.assertEqual(remote.voice_version({}), "oa-gatxel-female")

    def test_different_voice_gives_different_version(self) -> None:
        a = {"TTS_BACKEND": "openai-compatible", "TTS_VOICE": "a"}
        b = {"TTS_BACKEND": "openai-compatible", "TTS_VOICE": "b"}
        with mock.patch.dict(os.environ, a, clear=True):
            va = remote.voice_version({})
        with mock.patch.dict(os.environ, b, clear=True):
            vb = remote.voice_version({})
        self.assertNotEqual(va, vb)

    def test_explicit_version_wins_and_is_sanitised(self) -> None:
        env = {"TTS_BACKEND": "openai-compatible", "TTS_VOICE": "a", "TTS_VOICE_VERSION": "G 2/x"}
        with mock.patch.dict(os.environ, env, clear=True):
            self.assertEqual(remote.voice_version({}), "g-2-x")

    def test_unknown_backend_stops(self) -> None:
        with mock.patch.dict(os.environ, {"TTS_BACKEND": "nope"}, clear=True):
            with self.assertRaises(SystemExit):
                remote.backend()

    def test_unreachable_backend_gives_clear_error(self) -> None:
        env = {"TTS_BACKEND": "openai-compatible", "TTS_BASE_URL": "http://127.0.0.1:1/api/v1", "TTS_VOICE": "v"}
        with mock.patch.dict(os.environ, env, clear=True):
            synth = remote.RemoteSynth({"styles": {}})
            with self.assertRaises(RuntimeError) as cm:
                synth._speak("Hello", "v", 1.0)
            self.assertIn("host.docker.internal", str(cm.exception))


class LanguageRouting(unittest.TestCase):
    def synth(self) -> "tuple[remote.RemoteSynth, list[str]]":
        import json
        import numpy as np

        styles = json.load(open(os.path.join(os.path.dirname(__file__), "styles.json"), encoding="utf-8"))
        env = {"TTS_BACKEND": "openai-compatible", "TTS_BASE_URL": "http://x/api/v1", "TTS_VOICE": "en", "TTS_VOICE_ID": "id", "TTS_MODEL": "piper"}
        with mock.patch.dict(os.environ, env, clear=True):
            s = remote.RemoteSynth(styles)
        seen: list[str] = []

        def fake(text: str, voice: str, speed: float):  # noqa: ANN202
            seen.append(voice)
            return np.zeros(2400, dtype=np.float32) + 0.1

        s._speak = fake  # type: ignore[method-assign]
        return s, seen

    def test_english_roles_never_use_the_indonesian_voice(self) -> None:
        s, seen = self.synth()
        env = {"TTS_VOICE_ID": "id"}
        with mock.patch.dict(os.environ, env):
            for style in ("teacher", "quizhost", "dictation", "second"):
                s.one(style, [{"text": "Hello there.", "kind": "statement"}])
        self.assertEqual(set(seen), {"en"})

    def test_indonesian_role_uses_the_indonesian_voice_only(self) -> None:
        s, seen = self.synth()
        with mock.patch.dict(os.environ, {"TTS_VOICE_ID": "id"}):
            s.one("indonesian", [{"text": "Selamat pagi.", "kind": "statement"}, {"text": "Apa kabar?", "kind": "question"}])
        self.assertEqual(seen, ["id", "id"])


if __name__ == "__main__":
    unittest.main()
