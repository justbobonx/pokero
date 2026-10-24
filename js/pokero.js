/** Title + CALL IT identify mode. */

const BOARD_BG = "#0d3b2e";
const HAND_SIZE = 5;
const CARD_ASPECT = 2.5 / 3.5;
const CARD_GAP = 10;
const CARD_MAX_H = 280;
const HAND_SIDE_PAD = 2;
const BUTTON_ZONE = 0.34;
const HUD_PAD = 56;
const FEEDBACK_MS = 1000;
const ROUND_MS_START = 5000;
const ROUND_MS_FLOOR = 2000;
const ROUND_MS_DECAY = 0.97;

const MODE_TITLE = "title";
const MODE_CALL = "call";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const elChoices = document.getElementById("choices");
const elTitle = document.getElementById("title-screen");
const elHud = document.getElementById("hud");
const elScoreRight = document.getElementById("score-right");
const elScoreWrong = document.getElementById("score-wrong");
const elBack = document.getElementById("btn-back");
const elCall = document.getElementById("btn-call");
const elPick = document.getElementById("btn-pick");
const elTimer = document.getElementById("timer");
const elTimerFill = document.getElementById("timer-fill");

let mode = MODE_TITLE;
let deck = [];
let discard = [];
let hand = [];
let answer = null;
let locked = false;
let rightCount = 0;
let wrongCount = 0;
let cardW = 0;
let cardH = 0;
let handX = 0;
let handY = 0;
let feedbackTimer = 0;
let roundStarted = 0;
let timerRaf = 0;
let roundMs = ROUND_MS_START;

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

function paintScore() {
  elScoreRight.textContent = String(rightCount);
  elScoreWrong.textContent = String(wrongCount);
}

function clearFeedback() {
  const buttons = elChoices.querySelectorAll("button");
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove("right", "wrong", "answer");
    buttons[i].disabled = false;
  }
}


function stopTimer() {
  if (timerRaf) {
    cancelAnimationFrame(timerRaf);
    timerRaf = 0;
  }
}

function paintTimer(frac) {
  const f = frac < 0 ? 0 : frac > 1 ? 1 : frac;
  elTimerFill.style.transform = "scaleX(" + f + ")";
}

function tickTimer() {
  timerRaf = 0;
  if (mode !== MODE_CALL || locked) return;
  const left = 1 - (Date.now() - roundStarted) / roundMs;
  paintTimer(left);
  if (left <= 0) {
    onTimeout();
    return;
  }
  timerRaf = requestAnimationFrame(tickTimer);
}

function decayRoundMs() {
  roundMs = Math.max(ROUND_MS_FLOOR, roundMs * ROUND_MS_DECAY);
}

function startTimer() {
  stopTimer();
  roundStarted = Date.now();
  paintTimer(1);
  timerRaf = requestAnimationFrame(tickTimer);
}

function onTimeout() {
  if (mode !== MODE_CALL || locked || !answer) return;
  locked = true;
  stopTimer();
  wrongCount += 1;
  paintScore();
  const buttons = elChoices.querySelectorAll("button");
  for (let i = 0; i < buttons.length; i++) buttons[i].disabled = true;
  const correct = elChoices.querySelector('button[data-hand="' + answer + '"]');
  if (correct) correct.classList.add("answer");
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(function () {
    feedbackTimer = 0;
    if (mode !== MODE_CALL) return;
    decayRoundMs();
    dealRound();
    layout();
    draw();
  }, FEEDBACK_MS);
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
    hand = [];
    answer = HAND_PAIR;
    return;
  }
  hand = dealt;
  answer = type;
  startTimer();
}

function layout() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  if (mode !== MODE_CALL) return;
  const topZone = canvas.height * (1 - BUTTON_ZONE);
  const usableW = canvas.width - HAND_SIDE_PAD * 2;
  const usableH = topZone - HUD_PAD;
  cardH = Math.min(CARD_MAX_H, Math.floor(usableH * 0.85));
  cardW = Math.floor(cardH * CARD_ASPECT);
  const rowW = cardW * HAND_SIZE + CARD_GAP * (HAND_SIZE - 1);
  if (rowW > usableW) {
    cardW = Math.floor((usableW - CARD_GAP * (HAND_SIZE - 1)) / HAND_SIZE);
    cardH = Math.floor(cardW / CARD_ASPECT);
  }
  handX = Math.floor((canvas.width - (cardW * HAND_SIZE + CARD_GAP * (HAND_SIZE - 1))) / 2);
  handY = HUD_PAD + Math.floor((usableH - cardH) / 2);
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = BOARD_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (mode !== MODE_CALL) return;
  for (let i = 0; i < hand.length; i++) {
    hand[i].draw(ctx, handX + i * (cardW + CARD_GAP), handY, cardW, cardH);
  }
}

function showTitle() {
  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
    feedbackTimer = 0;
  }
  mode = MODE_TITLE;
  locked = false;
  hand = [];
  answer = null;
  stopTimer();
  elTitle.hidden = false;
  elHud.hidden = true;
  elChoices.hidden = true;
  elTimer.hidden = true;
  layout();
  draw();
}

function startCallIt() {
  mode = MODE_CALL;
  rightCount = 0;
  wrongCount = 0;
  roundMs = ROUND_MS_START;
  paintScore();
  resetShoe();
  elTitle.hidden = true;
  elHud.hidden = false;
  elChoices.hidden = false;
  elTimer.hidden = false;
  dealRound();
  layout();
  draw();
}

function onGuess(type, btn) {
  if (mode !== MODE_CALL || locked || !answer) return;
  locked = true;
  stopTimer();
  const buttons = elChoices.querySelectorAll("button");
  for (let i = 0; i < buttons.length; i++) buttons[i].disabled = true;
  if (type === answer) {
    rightCount += 1;
    btn.classList.add("right");
  } else {
    wrongCount += 1;
    btn.classList.add("wrong");
    const correct = elChoices.querySelector('button[data-hand="' + answer + '"]');
    if (correct) correct.classList.add("answer");
  }
  paintScore();
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(function () {
    feedbackTimer = 0;
    if (mode !== MODE_CALL) return;
    decayRoundMs();
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

buildButtons();
showTitle();

elBack.addEventListener("click", showTitle);
elCall.addEventListener("click", startCallIt);
elPick.addEventListener("click", function () {
  // PICK IT lands next.
});

window.addEventListener("resize", onViewport);
