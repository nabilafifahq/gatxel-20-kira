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


_SUPERSCRIPT = str.maketrans("\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079", "0123456789")


def _rupiah(m: "re.Match[str]") -> str:
    raw = m.group(1)
    amount = raw.rstrip(".,")
    tail = raw[len(amount):]
    # Titik dan koma pemisah ribuan (Rp1.000, Rp 8,000) dibuang supaya dibaca satu bilangan, bukan desimal.
    if re.fullmatch(r"\d{1,3}([.,]\d{3})+", amount):
        amount = re.sub(r"[.,]", "", amount)
    return f"{amount} rupiah{tail}"


def _power(m: "re.Match[str]") -> str:
    # 10\u00b2\u2075 dibaca "10 to the power of 25", bukan digit yang ditempel.
    return " to the power of " + m.group(1).translate(_SUPERSCRIPT)


SUPERSCRIPT = str.maketrans("⁰¹²³⁴⁵⁶⁷⁸⁹", "0123456789")


def _power(m: "re.Match[str]") -> str:
    digits = m.group(0).translate(SUPERSCRIPT)
    return {"2": " squared", "3": " cubed"}.get(digits, f" to the power of {digits}")


def prepare_text(text: str) -> str:
    t = " ".join(text.split())
    t = re.sub(r"[⁰¹²³⁴⁵⁶⁷⁸⁹]+", _power, t)  # 15² = 15 squared, 2²⁰²⁶ = 2 to the power of 2026
    t = re.sub(r"(?<=\d)([\u2070\u00b9\u00b2\u00b3\u2074-\u2079]+)", _power, t)
    t = re.sub(r"\bRp\.?\s*(\d[\d.,]*)", _rupiah, t)
    t = re.sub(r"\s\+\s", " plus ", t)
    t = re.sub(r"(?<![\d/])(\d{1,3})/(\d{1,3})(?![\d/])", _fraction, t)
    t = re.sub(r"(?<=\d)\s*(cm|mm|km|kg|ml|g|l|m)\b", lambda m: " " + UNITS[m.group(1)], t)
    t = re.sub(r"(?<=\d)\s*°\s*C\b", " degrees Celsius", t)
    t = t.replace("&", " and ").replace("=", " equals ").replace("%", " percent")
    t = re.sub(r"(?<=\d)\s*[x×]\s*(?=\d)", " times ", t)
    t = re.sub(r"(?<=\d)\s*÷\s*(?=\d)", " divided by ", t)
    t = re.sub(r"(?<=\d)\s*\+\s*(?=\d)", " plus ", t)
    t = re.sub(r"(?<=\d)\s+[-\u2212\u2013]\s+(?=\d)", " minus ", t)
    return " ".join(t.split())
