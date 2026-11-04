import unittest

from textprep import prepare_text


class PrepareText(unittest.TestCase):
    def test_rupiah(self) -> None:
        self.assertEqual(prepare_text("It costs Rp 8,000 today."), "It costs 8000 rupiah today.")

    def test_rupiah_thousands_separator_and_sums(self) -> None:
        self.assertEqual(prepare_text("Rp1.000 coin."), "1000 rupiah coin.")
        self.assertEqual(prepare_text("It is Rp1.000."), "It is 1000 rupiah.")
        self.assertEqual(prepare_text("Rp500 + Rp200 = Rp700"), "500 rupiah plus 200 rupiah equals 700 rupiah")

    def test_fractions(self) -> None:
        self.assertEqual(prepare_text("Shade 3/4 of it."), "Shade 3 quarters of it.")
        self.assertEqual(prepare_text("Eat 1/2 an apple."), "Eat one half an apple.")

    def test_units_only_after_digits(self) -> None:
        self.assertEqual(prepare_text("It is 5 cm long."), "It is 5 centimetres long.")
        self.assertEqual(prepare_text("I am here."), "I am here.")

    def test_powers(self) -> None:
        self.assertEqual(prepare_text("10\u00b2\u2075 is big"), "10 to the power of 25 is big")

    def test_operators(self) -> None:
        self.assertEqual(prepare_text("3 x 4 = 12"), "3 times 4 equals 12")
        self.assertEqual(prepare_text("7 - 2"), "7 minus 2")


if __name__ == "__main__":
    unittest.main()
