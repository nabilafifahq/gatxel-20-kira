"""Rapikan teks sebelum diucapkan: simbol, pecahan, dan satuan yang sering dibaca salah diganti kata.

Murni (tanpa model), jadi bisa diuji di mana saja: python -m unittest test_textprep
"""

from __future__ import annotations

import re

FRACTION_WORDS = {3: "third", 4: "quarter", 5: "fifth", 6: "sixth", 7: "seventh", 8: "eighth", 9: "ninth", 10: "tenth", 12: "twelfth"}
UNITS = {"cm": "centimetres", "mm": "millimetres", "km": "kilometres", "kg": "kilograms", "ml": "millilitres", "g": "grams", "l": "litres", "m": "metres"}


def _fraction(m: "re.Match[str]") -> str:
    top, bottom = int(m.group(1)), int(m.group(2))
    if top == 0 or bottom == 0:
        return f"{top} over {bottom}"
    if bottom == 2:
        return "one half" if top == 1 else f"{top} halves"
    word = FRACTION_WORDS.get(bottom)
    if word is None:
        return f"{top} over {bottom}"
    return f"one {word}" if top == 1 else f"{top} {word}s"


def prepare_text(text: str) -> str:
    t = " ".join(text.split())
    t = re.sub(r"\bRp\.?\s*(\d[\d.,]*)", r"\1 rupiah", t)
    t = re.sub(r"(?<![\d/])(\d{1,3})/(\d{1,3})(?![\d/])", _fraction, t)
    t = re.sub(r"(?<=\d)\s*(cm|mm|km|kg|ml|g|l|m)\b", lambda m: " " + UNITS[m.group(1)], t)
    t = re.sub(r"(?<=\d)\s*°\s*C\b", " degrees Celsius", t)
    t = t.replace("&", " and ").replace("=", " equals ").replace("%", " percent")
    t = re.sub(r"(?<=\d)\s*[x×]\s*(?=\d)", " times ", t)
    t = re.sub(r"(?<=\d)\s*÷\s*(?=\d)", " divided by ", t)
    t = re.sub(r"(?<=\d)\s*\+\s*(?=\d)", " plus ", t)
    t = re.sub(r"(?<=\d)\s+[-−–]\s+(?=\d)", " minus ", t)
    return " ".join(t.split())
