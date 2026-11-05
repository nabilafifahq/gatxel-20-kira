import unittest

from check_clips import asr_score, judge, normalise, number_words


class Normalise(unittest.TestCase):
    def test_numbers_become_words(self) -> None:
        self.assertEqual(normalise("12 apples and 7 oranges"), "twelve apples and seven oranges".split())
        self.assertEqual(number_words(1250), "one thousand two hundred fifty")

    def test_spoken_form_matches_what_whisper_hears(self) -> None:
        self.assertGreater(asr_score("Rp 8,000 for 3 x 4.", "8000 rupiah for 3 times 4."), 0.9)

    def test_names_that_sound_alike_still_pass(self) -> None:
        self.assertGreater(asr_score("Lia and Budi play in the garden.", "Leah and Beauty play in the gardens."), 0.8)

    def test_different_sentence_fails(self) -> None:
        self.assertLess(asr_score("What can you see in the picture?", "Please open your books now."), 0.5)


class Judge(unittest.TestCase):
    def base(self, **over: object) -> dict:
        row = {"style": "teacher", "seconds": 4.0, "peak_db": -3.0, "clip_frac": 0.0, "lead_sil": 0.1, "trail_sil": 0.1, "inner_sil": 0.4, "silent_ratio": 0.1, "flags": []}
        row.update(over)
        return row

    def test_missing_initial_s_fails_only_on_s_clusters(self) -> None:
        quiet = self.base(lead_hiss_ms=5)
        self.assertTrue(any("bunyi s" in f for f in judge(dict(quiet), "Spoon and fork are on the table.")))
        self.assertFalse(any("bunyi s" in f for f in judge(dict(quiet), "Moon and stars are in the sky now.")))
        self.assertFalse(any("bunyi s" in f for f in judge(self.base(lead_hiss_ms=100), "Spoon and fork are on the table.")))
        self.assertFalse(any("bunyi s" in f for f in judge(dict(quiet), "Science is the study of the world.")))

    def test_clean_clip_passes(self) -> None:
        self.assertEqual(judge(self.base(), "What can you see in the picture?"), [])

    def test_clipping_and_quiet_and_jump(self) -> None:
        self.assertIn("clipping", judge(self.base(clip_frac=0.01), "What can you see in the picture?"))
        self.assertIn("terlalu pelan", judge(self.base(peak_db=-40.0), "What can you see in the picture?"))
        self.assertTrue(any("lompatan" in f for f in judge(self.base(phrase_jump_st=11.0), "What can you see in the picture?")))

    def test_duration_against_text(self) -> None:
        self.assertTrue(any("durasi" in f for f in judge(self.base(seconds=30.0), "Hello there my friend.")))
        self.assertTrue(any("durasi" in f for f in judge(self.base(seconds=0.4), "A very long sentence that cannot fit in half a second.")))

    def test_whisper_mismatch_flagged_but_single_words_are_not(self) -> None:
        row = self.base(asr_score=0.2, asr_text="completely different")
        self.assertTrue(any("Whisper" in f for f in judge(row, "What can you see in the picture?")))
        short = self.base(asr_score=0.0, asr_text="Puck.")
        self.assertEqual([f for f in judge(short, "park") if "Whisper cocok" in f], [])


if __name__ == "__main__":
    unittest.main()
