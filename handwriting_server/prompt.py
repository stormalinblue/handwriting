import random
import string


class VocabPrompter:
  def __init__(self, vocabulary):
    self.vocabulary = vocabulary
    self.rng = random.Random()

  def next_prompt(self):
    return self.rng.choice(self.vocabulary)


class LowercaseAlphaPrompter(VocabPrompter):
  def __init__(self):
    super().__init__(string.ascii_lowercase)

class ExponentialPrompter:
  def __init__(self, vocabulary, min_length=1, survive=0.75):
    self.vocab = vocabulary
    self.rng = random.Random()
    self.min_length = min_length
    self.survive = survive

  def next_prompt(self):
    parts = []
    for _ in range(self.min_length):
      parts.append(self.rng.choice(self.vocab))

    while True:
      result = self.rng.binomialvariate(p = self.survive)
      if result == 0:
        break
      parts.append(self.rng.choice(self.vocab))

    return ''.join(parts)

class LowercaseExponentialPrompter(ExponentialPrompter):
  def __init__(self, min_length=1, survive=0.75):
    super().__init__(
      string.ascii_lowercase,
      min_length=min_length,
      survive=survive)
