/** Identify mode: deal a weighted poker hand and guess its type. */

const BOARD_BG = "#0d3b2e";
const HAND_SIZE = 5;
const CARD_ASPECT = 2.5 / 3.5;
const CARD_GAP = 10;
const CARD_MAX_H = 280;
const HAND_SIDE_PAD = 2;
const BUTTON_ZONE = 0.34;
const FEEDBACK_MS = 1000;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const elChoices = document.getElementById("choices");

let deck = [];
let discard = [];
let hand = [];
let answer = null;
let locked = false;
let cardW = 0;
let cardH = 0;
let handX = 0;
let handY = 0;
let feedbackTimer = 0;

function makeDeck() {
  const out = [];
  for (let s = 0; s < CARD_SUITS.length; s++) {
    for (let r = 0; r < CARD_RANKS.length; r++) {
      out.push(new Card(CARD_RANKS[r], CARD_SUITS[s]));
    }
  }
  return out;
}

function resetShoe() {
  deck = makeDeck();
  discard = [];
  shuffleDeck(deck);
}

function dealRound() {
  locked = false;
  clearFeedback();
  const type = randomHand();
  let dealt = dealTypedHand(deck, discard, type);
  if (!dealt) {
    resetShoe();
    dealt = dealTypedHand(deck, discard, type);
  }
  if (!dealt) {
    // Last resort: still show something.
    hand = [];
    answer = HAND_PAIR;
    return;
  }
  hand = dealt;
  answer = type;
}

function layout() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const topZone = canvas.height * (1 - BUTTON_ZONE);
  const usableW = canvas.width - HAND_SIDE_PAD * 2;
  cardH = Math.min(CARD_MAX_H, Math.floor(topZone * 0.7));
  cardW = Math.floor(cardH * CARD_ASPECT);
  const rowW = cardW * HAND_SIZE + CARD_GAP * (HAND_SIZE - 1);
  if (rowW > usableW) {
    cardW = Math.floor((usableW - CARD_GAP * (HAND_SIZE - 1)) / HAND_SIZE);
    cardH = Math.floor(cardW / CARD_ASPECT);
  }
  handX = Math.floor((canvas.width - (cardW * HAND_SIZE + CARD_GAP * (HAND_SIZE - 1))) / 2);
  handY = Math.floor((topZone - cardH) / 2);
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = BOARD_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < hand.length; i++) {
    hand[i].draw(ctx, handX + i * (cardW + CARD_GAP), handY, cardW, cardH);
  }
}

function clearFeedback() {
  const buttons = elChoices.querySelectorAll("button");
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove("right", "wrong", "answer");
    buttons[i].disabled = false;
  }
}

function onGuess(type, btn) {
  if (locked || !answer) return;
  locked = true;
  const buttons = elChoices.querySelectorAll("button");
  for (let i = 0; i < buttons.length; i++) buttons[i].disabled = true;
  if (type === answer) {
    btn.classList.add("right");
  } else {
    btn.classList.add("wrong");
    const correct = elChoices.querySelector('button[data-hand="' + answer + '"]');
    if (correct) correct.classList.add("answer");
  }
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(function () {
    feedbackTimer = 0;
    dealRound();
    layout();
    draw();
  }, FEEDBACK_MS);
}

function buildButtons() {
  elChoices.innerHTML = "";
  for (let i = 0; i < HAND_TYPES.length; i++) {
    const type = HAND_TYPES[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.hand = type;
    btn.textContent = HAND_LABELS[type];
    btn.addEventListener("click", function () {
      onGuess(type, btn);
    });
    elChoices.appendChild(btn);
  }
}

function onViewport() {
  layout();
  draw();
}

resetShoe();
buildButtons();
dealRound();
layout();
draw();

window.addEventListener("resize", onViewport);
