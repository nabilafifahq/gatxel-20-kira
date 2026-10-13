// __GTX_SEED__
// Soal contoh untuk 10 jenis soal baru, disalin dari soal di content/ supaya galeri learner menampilkan semuanya.
// Dibentuk dengan presentItem seperti di server. Tidak pernah masuk database produksi.

import type { ItemInput } from '@kira/content/schema'
import type { RunnerItem } from '@/lib/dto'
import { asRunner, make } from './learner-items'

export const N_STORY: ItemInput = {
  "id": "e2.reading-information.020",
  "skill": "e2.reading-information",
  "type": "story",
  "difficulty": 2,
  "prompt": "Bats sleep during the day. They hang upside down in dark places. At night they fly out to find insects to eat.",
  "hints": [
    "Find the word night in the text.",
    "Read the sentence about where bats hang.",
    "The last sentence tells what bats eat."
  ],
  "explanation": "Bats sleep in the day, hang upside down, and eat insects at night.",
  "parts": [
    {
      "type": "mcq",
      "prompt": "When do bats sleep?",
      "options": [
        {
          "text": "at night"
        },
        {
          "text": "during the day"
        },
        {
          "text": "only in winter"
        }
      ],
      "answer": 1
    },
    {
      "type": "mcq",
      "prompt": "How do bats sleep?",
      "options": [
        {
          "text": "upside down"
        },
        {
          "text": "on the ground"
        },
        {
          "text": "in the water"
        }
      ],
      "answer": 0
    },
    {
      "type": "text",
      "prompt": "What do bats eat? Write one word.",
      "answers": [
        "insects",
        "insect"
      ]
    }
  ]
}

export const N_LISTEN: ItemInput = {
  "id": "e1.letter-sounds.015",
  "skill": "e1.letter-sounds",
  "type": "listen",
  "difficulty": 1,
  "prompt": "Listen. Tap the picture of the word you hear.",
  "hints": [
    "Listen again. It is an animal.",
    "It is a bird that lives on a farm.",
    "It clucks and lays eggs."
  ],
  "explanation": "The speaker said \"a hen\". A hen is a farm bird that lays eggs.",
  "listenText": "A hen.",
  "options": [
    {
      "figure": {
        "kind": "icons",
        "items": [
          {
            "icon": "cat"
          }
        ],
        "alt": "A picture of a cat."
      }
    },
    {
      "figure": {
        "kind": "icons",
        "items": [
          {
            "icon": "dog"
          }
        ],
        "alt": "A picture of a dog."
      }
    },
    {
      "figure": {
        "kind": "icons",
        "items": [
          {
            "icon": "hen"
          }
        ],
        "alt": "A picture of a hen."
      }
    }
  ],
  "answer": 2
}

export const N_TILES: ItemInput = {
  "id": "e2.joining-words.019",
  "skill": "e2.joining-words",
  "type": "tiles",
  "difficulty": 3,
  "prompt": "Put the words in order to make a sentence.",
  "hints": [
    "The sentence has two ideas joined by a joining word.",
    "There is a comma before the joining word.",
    "The joining word shows the first idea is the reason for the second."
  ],
  "explanation": "I was tired, so I went to bed. The joining word so shows what happened because of the first idea.",
  "answer": "I was tired, so I went to bed.",
  "distractors": [
    "but"
  ]
}

export const N_SPELL: ItemInput = {
  "id": "e2.magic-e.019",
  "skill": "e2.magic-e",
  "type": "spell",
  "difficulty": 2,
  "prompt": "Listen, then spell the word.",
  "hints": [
    "The word has four letters.",
    "It ends with a silent e.",
    "The silent e makes the a say its name."
  ],
  "explanation": "The word is cake. The magic e at the end makes the a long.",
  "word": "cake",
  "sentence": "Mum made a cake."
}

export const N_CLOZE: ItemInput = {
  "id": "e2.irregular-past.020",
  "skill": "e2.irregular-past",
  "type": "cloze",
  "difficulty": 3,
  "prompt": "Last night I ___ my dinner and then I ___ to bed.",
  "hints": [
    "Last night means the past.",
    "Some past tense words do not end in -ed.",
    "Say the sentence aloud with each choice. Which one sounds right?"
  ],
  "explanation": "Ate is the past of eat and went is the past of go. They are irregular, so they do not end in -ed.",
  "gaps": [
    {
      "options": [
        "ate",
        "eat",
        "eaten"
      ],
      "answer": 0
    },
    {
      "options": [
        "goed",
        "go",
        "went"
      ],
      "answer": 2
    }
  ]
}

export const N_HOTSPOT: ItemInput = {
  "id": "s1.plant-parts.017",
  "skill": "s1.plant-parts",
  "type": "hotspot",
  "difficulty": 1,
  "prompt": "Tap the part that takes in water from the soil.",
  "figure": {
    "kind": "scene",
    "width": 320,
    "height": 260,
    "shapes": [
      {
        "t": "rect",
        "x": 0,
        "y": 190,
        "w": 320,
        "h": 70,
        "tone": "warn",
        "fill": "light"
      },
      {
        "t": "line",
        "x1": 160,
        "y1": 190,
        "x2": 160,
        "y2": 90,
        "tone": "science",
        "width": 6
      },
      {
        "t": "ellipse",
        "cx": 206,
        "cy": 126,
        "rx": 50.1,
        "ry": 18,
        "rot": -28.6,
        "tone": "science",
        "fill": "solid"
      },
      {
        "t": "circle",
        "cx": 182,
        "cy": 66,
        "r": 13,
        "tone": "english",
        "fill": "light"
      },
      {
        "t": "circle",
        "cx": 171,
        "cy": 85.1,
        "r": 13,
        "tone": "english",
        "fill": "light"
      },
      {
        "t": "circle",
        "cx": 149,
        "cy": 85.1,
        "r": 13,
        "tone": "english",
        "fill": "light"
      },
      {
        "t": "circle",
        "cx": 138,
        "cy": 66,
        "r": 13,
        "tone": "english",
        "fill": "light"
      },
      {
        "t": "circle",
        "cx": 149,
        "cy": 46.9,
        "r": 13,
        "tone": "english",
        "fill": "light"
      },
      {
        "t": "circle",
        "cx": 171,
        "cy": 46.9,
        "r": 13,
        "tone": "english",
        "fill": "light"
      },
      {
        "t": "circle",
        "cx": 160,
        "cy": 66,
        "r": 11,
        "tone": "star",
        "fill": "light"
      },
      {
        "t": "line",
        "x1": 160,
        "y1": 190,
        "x2": 160,
        "y2": 248,
        "tone": "warn",
        "width": 3
      },
      {
        "t": "line",
        "x1": 160,
        "y1": 202,
        "x2": 120,
        "y2": 238,
        "tone": "warn",
        "width": 3
      },
      {
        "t": "line",
        "x1": 160,
        "y1": 202,
        "x2": 200,
        "y2": 240,
        "tone": "warn",
        "width": 3
      },
      {
        "t": "line",
        "x1": 160,
        "y1": 222,
        "x2": 136,
        "y2": 252,
        "tone": "warn",
        "width": 3
      }
    ],
    "alt": "A plant growing in soil. It has a flower at the top, a long stem, one big leaf and roots under the ground."
  },
  "hints": [
    "Think about what is under the ground.",
    "These parts hold the plant in the soil.",
    "They drink water like thin straws."
  ],
  "explanation": "The roots take in water from the soil. They also hold the plant in place.",
  "regions": [
    {
      "label": "flower",
      "x": 50,
      "y": 25.4,
      "w": 18.8,
      "h": 21.5
    },
    {
      "label": "leaf",
      "x": 71.3,
      "y": 43.8,
      "w": 23.8,
      "h": 21.5
    },
    {
      "label": "stem",
      "x": 50,
      "y": 64.6,
      "w": 12.5,
      "h": 28.5
    },
    {
      "label": "roots",
      "x": 50,
      "y": 89.2,
      "w": 25,
      "h": 19.2
    }
  ],
  "answers": [
    3
  ]
}

export const N_LABEL: ItemInput = {
  "id": "s1.plant-parts.018",
  "skill": "s1.plant-parts",
  "type": "label",
  "difficulty": 1,
  "prompt": "Label the parts of the plant.",
  "figure": {
    "kind": "scene",
    "width": 320,
    "height": 260,
    "shapes": [
      {
        "t": "rect",
        "x": 0,
        "y": 190,
        "w": 320,
        "h": 70,
        "tone": "warn",
        "fill": "light"
      },
      {
        "t": "line",
        "x1": 160,
        "y1": 190,
        "x2": 160,
        "y2": 90,
        "tone": "science",
        "width": 6
      },
      {
        "t": "ellipse",
        "cx": 206,
        "cy": 126,
        "rx": 50.1,
        "ry": 18,
        "rot": -28.6,
        "tone": "science",
        "fill": "solid"
      },
      {
        "t": "circle",
        "cx": 182,
        "cy": 66,
        "r": 13,
        "tone": "english",
        "fill": "light"
      },
      {
        "t": "circle",
        "cx": 171,
        "cy": 85.1,
        "r": 13,
        "tone": "english",
        "fill": "light"
      },
      {
        "t": "circle",
        "cx": 149,
        "cy": 85.1,
        "r": 13,
        "tone": "english",
        "fill": "light"
      },
      {
        "t": "circle",
        "cx": 138,
        "cy": 66,
        "r": 13,
        "tone": "english",
        "fill": "light"
      },
      {
        "t": "circle",
        "cx": 149,
        "cy": 46.9,
        "r": 13,
        "tone": "english",
        "fill": "light"
      },
      {
        "t": "circle",
        "cx": 171,
        "cy": 46.9,
        "r": 13,
        "tone": "english",
        "fill": "light"
      },
      {
        "t": "circle",
        "cx": 160,
        "cy": 66,
        "r": 11,
        "tone": "star",
        "fill": "light"
      },
      {
        "t": "line",
        "x1": 160,
        "y1": 190,
        "x2": 160,
        "y2": 248,
        "tone": "warn",
        "width": 3
      },
      {
        "t": "line",
        "x1": 160,
        "y1": 202,
        "x2": 120,
        "y2": 238,
        "tone": "warn",
        "width": 3
      },
      {
        "t": "line",
        "x1": 160,
        "y1": 202,
        "x2": 200,
        "y2": 240,
        "tone": "warn",
        "width": 3
      },
      {
        "t": "line",
        "x1": 160,
        "y1": 222,
        "x2": 136,
        "y2": 252,
        "tone": "warn",
        "width": 3
      }
    ],
    "alt": "A plant growing in soil. It has a flower at the top, a long stem, one big leaf and roots under the ground."
  },
  "hints": [
    "Tap a label, then tap its number.",
    "The roots are under the soil.",
    "The flower is at the top."
  ],
  "explanation": "The flower is at the top, the leaf is on the side, the stem is in the middle and the roots are under the ground.",
  "labels": [
    "flower",
    "leaf",
    "stem",
    "roots"
  ],
  "spots": [
    {
      "x": 50,
      "y": 25.4
    },
    {
      "x": 71.3,
      "y": 43.8
    },
    {
      "x": 50,
      "y": 64.6
    },
    {
      "x": 50,
      "y": 89.2
    }
  ]
}

export const N_TABLE: ItemInput = {
  "id": "s2.fair-test.019",
  "skill": "s2.fair-test",
  "type": "table",
  "difficulty": 3,
  "prompt": "A plant in the light grows 2 cm every day. Complete the table.",
  "hints": [
    "Look at how the height changes from one day to the next.",
    "Add 2 each day.",
    "Day 3 is 6 cm. What is Day 4?"
  ],
  "explanation": "The plant grows 2 cm each day: 2, 4, 6, 8 cm.",
  "caption": "Plant in the light",
  "head": [
    "Day",
    "Height (cm)"
  ],
  "rows": [
    [
      "1",
      "2"
    ],
    [
      "2",
      ""
    ],
    [
      "3",
      "6"
    ],
    [
      "4",
      ""
    ]
  ],
  "blanks": [
    {
      "row": 1,
      "col": 1,
      "answers": [
        "4"
      ]
    },
    {
      "row": 3,
      "col": 1,
      "answers": [
        "8"
      ]
    }
  ]
}

export const N_GRID: ItemInput = {
  "id": "m2.oly-logic.017",
  "skill": "m2.oly-logic",
  "type": "grid",
  "difficulty": 2,
  "prompt": "Fill the grid with the numbers 1 to 4. Every row, every column and every 2 by 2 box must have each number once.",
  "hints": [
    "Find a row, a column or a box with only one empty box.",
    "Look at which numbers are already in that row. Which one is missing?",
    "Check the column and the 2 by 2 box too, to be sure."
  ],
  "explanation": "Every row, column and box has 1, 2, 3 and 4 once. For example, the first row is 1, 2, 3, 4.",
  "puzzle": "sudoku",
  "size": 4,
  "given": [
    [
      1,
      2,
      0,
      0
    ],
    [
      0,
      0,
      1,
      0
    ],
    [
      2,
      1,
      4,
      3
    ],
    [
      4,
      3,
      0,
      1
    ]
  ],
  "filled": [
    [
      1,
      2,
      3,
      4
    ],
    [
      3,
      4,
      1,
      2
    ],
    [
      2,
      1,
      4,
      3
    ],
    [
      4,
      3,
      2,
      1
    ]
  ]
}

export const N_PHOTO: ItemInput = {
  "id": "s1.plant-parts.015",
  "skill": "s1.plant-parts",
  "type": "photo",
  "difficulty": 2,
  "prompt": "Draw a plant on paper. Label the leaf, the stem and the root. Then take a photo.",
  "hints": [],
  "explanation": "A plant has a leaf, a stem and a root. Your tutor checks your drawing and labels.",
  "rubric": {
    "criteria": [
      {
        "label": "Draws a plant with stem, leaves and roots",
        "points": 2
      },
      {
        "label": "Labels leaf, stem and root",
        "points": 2
      },
      {
        "label": "Labels are next to the right parts",
        "points": 1
      }
    ]
  }
}

/** Satu soal untuk setiap jenis soal baru. */
export function newTypeItems(): RunnerItem[] {
  return asRunner([make(N_STORY), make(N_LISTEN), make(N_TILES), make(N_SPELL), make(N_CLOZE), make(N_HOTSPOT), make(N_LABEL), make(N_TABLE), make(N_GRID), make(N_PHOTO)])
}
