/** Deal a five-card hand on a fullscreen canvas; tap for a new hand. */

const BOARD_BG = "#0d3b2e";
const HAND_SIZE = 5;
const CARD_ASPECT = 2.5 / 3.5;
const CARD_GAP = 10;
const CARD_MAX_H = 280;
const HAND_SIDE_PAD = 2;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

let deck = [];
let hand = [];
let cardW = 0;
let cardH = 0;
let handX = 0;
let handY = 0;

function makeDeck() {
  const out = [];
  for (let s = 0; s < CARD_SUITS.length; s++) {
    for (let r = 0; r < CARD_RANKS.length; r++) {
      out.push(new Card(CARD_RANKS[r], CARD_SUITS[s]));
    }
  }
  return out;
}

function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = cards[i];
    cards[i] = cards[j];
    cards[j] = t;
  }
}

function dealHand() {
  if (deck.length < HAND_SIZE) {
    deck = makeDeck();
    shuffle(deck);
  }
  hand = [];
  for (let i = 0; i < HAND_SIZE; i++) hand.push(deck.pop());
}

function layout() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const usableW = canvas.width - HAND_SIDE_PAD * 2;
  cardH = Math.min(CARD_MAX_H, Math.floor(canvas.height * 0.55));
  cardW = Math.floor(cardH * CARD_ASPECT);
  const rowW = cardW * HAND_SIZE + CARD_GAP * (HAND_SIZE - 1);
  if (rowW > usableW) {
    cardW = Math.floor((usableW - CARD_GAP * (HAND_SIZE - 1)) / HAND_SIZE);
    cardH = Math.floor(cardW / CARD_ASPECT);
  }
  handX = Math.floor((canvas.width - (cardW * HAND_SIZE + CARD_GAP * (HAND_SIZE - 1))) / 2);
  handY = Math.floor((canvas.height - cardH) / 2);
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = BOARD_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < hand.length; i++) {
    hand[i].draw(ctx, handX + i * (cardW + CARD_GAP), handY, cardW, cardH);
  }
}

function onTap() {
  dealHand();
  draw();
}

function onViewport() {
  layout();
  draw();
}

dealHand();
layout();
draw();

window.addEventListener("resize", onViewport);
canvas.addEventListener("pointerdown", function (e) {
  e.preventDefault();
  onTap();
});
