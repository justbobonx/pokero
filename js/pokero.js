/** Title + CALL IT identify mode + PICK IT strongest-hand mode. */

const BOARD_BG = "#0d3b2e";
const HAND_SIZE = 5;
const CARD_ASPECT = 2.5 / 3.5;
const CARD_GAP = 10; // biggest space between cards (desktop)
const CARD_GAP_MIN = 4; // smallest space between cards (narrow phones)
const CARD_GAP_VW = 0.015; // space between cards as a share of screen width
const CARD_MAX_H = 280;
// How much each card in a row tucks under the next one, as a share of card width.
// 0 = no overlap, 0.05 = each card covers 5% of the one to its left.
const CARD_OVERLAP = 0.12;
const HAND_SIDE_PAD = 2;
const BUTTON_ZONE = 0.34;
const HUD_PAD = 56;
const FEEDBACK_MS = 1200;
const ROUND_MS_START = 7000;
const ROUND_MS_FLOOR = 1000;
const ROUND_MS_DECAY = 0.97;
const ROUND_MS_MISS = 1.1;
const MAX_HEARTS = 3;
const HI_KEY = "pokero_call_hi";
const HI_KEY_PICK = "pokero_pick_hi";

const PICK_REVEAL_MS = 1200; // how long each new hand is shown before the next appears
const PICK_ROUND_MS_START = 3000; // pick-phase countdown once all hands are shown
const PICK_PHASE_REVEAL = "reveal";
const PICK_PHASE_PICK = "pick";

const PICK_ROWS_START = 2;
const PICK_ROWS_MAX = 4;
const PICK_BUMP_EVERY = 5;
const PICK_SAME_TYPE_CHANCE = 0.15;
const PICK_DEAL_TRIES = 48;
const PICK_BAR_LINE = CARD_EDGE_W * 3; // thick stroke behind each row
const PICK_BAR_COLOR = CARD_EDGE;
const PICK_GHOST_COLOR = "#082a20"; // darker board green slab where a hand will land
const PICK_TIMER_H = 14;
const PICK_LABEL_GAP = 8; // space from timer down to hand name
const PICK_LABEL_H = 56; // room for winner name plus tap hint
const PICK_CHROME_PAD = 16; // breathing room under the hand name
const PICK_HL_RIGHT = "#2f9e55";
const PICK_HL_WRONG = "#b33a3a";
const PICK_HL_ANSWER = "#c9a227";
const PICK_HL_LINE = CARD_EDGE_W * 3; // outline around the chosen row

const MODE_TITLE = "title";
const MODE_CALL = "call";
const MODE_PICK = "pick";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const elChoices = document.getElementById("choices");
const elTitle = document.getElementById("title-screen");
const elHud = document.getElementById("hud");
const elScoreValue = document.getElementById("score-value");
const elHearts = document.getElementById("hearts");
const elHiValue = document.getElementById("hi-value");
const elBack = document.getElementById("btn-back");
const elCall = document.getElementById("btn-call");
const elPick = document.getElementById("btn-pick");
const elTimer = document.getElementById("timer");
const elTimerFill = document.getElementById("timer-fill");
const elPickLabel = document.getElementById("pick-label");

let mode = MODE_TITLE;
let deck = [];
let discard = [];
let hand = [];
let answer = null;
let locked = false;
let gameOver = false;
let score = 0;
let hearts = MAX_HEARTS;
let hiScore = 0;
let hiKey = HI_KEY;
let cardW = 0;

// Distance from one card's left edge to the next card's left edge (cards overlap).
function cardStep(w) {
  return w * (1 - CARD_OVERLAP);
}
// Full width of a row of HAND_SIZE overlapping cards.
function rowWidth(w) {
  return w + cardStep(w) * (HAND_SIZE - 1);
}
// Widest card that still lets a full overlapping row fit in the given width.
function cardWForRow(availW) {
  return Math.floor(availW / (1 + (1 - CARD_OVERLAP) * (HAND_SIZE - 1)));
}
let cardH = 0;
let handX = 0;
let handY = 0;
let feedbackTimer = 0;
let roundStarted = 0;
let timerRaf = 0;
let roundMs = ROUND_MS_START;

let pickHands = [];
let pickWinner = -1;
let pickRows = PICK_ROWS_START;
let pickChoice = -1;
let pickRowRects = [];
let pickPhase = PICK_PHASE_PICK;
let pickRevealIdx = -1;
let revealTimer = 0;
let pickWaitTap = false; // pick feedback waits for a tap instead of a timed advance
let pickWaitAdvance = false; // whether that tap should deal the next round
let cardGap = CARD_GAP; // current space between cards, set in layout()
let lastRowGap = 0; // space between hand rows; also used under the bottom hand for the timer

function loadHi() {
  const n = parseInt(localStorage.getItem(hiKey) || "0", 10);
  hiScore = n > 0 ? n : 0;
}

function saveHi() {
  if (score > hiScore) {
    hiScore = score;
    localStorage.setItem(hiKey, String(hiScore));
  }
}

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

function paintHud() {
  elHiValue.textContent = String(hiScore);
  elScoreValue.textContent = String(score);
  let h = "";
  for (let i = 0; i < hearts; i++) h += "♥";
  elHearts.textContent = h;
}

function clearFeedback() {
  const buttons = elChoices.querySelectorAll("button");
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].classList.remove("right", "wrong", "answer");
    buttons[i].disabled = false;
  }
  if (elPickLabel) elPickLabel.textContent = "";
  pickChoice = -1;
  pickWaitTap = false;
  pickWaitAdvance = false;
}

function stopTimer() {
  if (timerRaf) {
    cancelAnimationFrame(timerRaf);
    timerRaf = 0;
  }
}

function clearRevealTimer() {
  if (revealTimer) {
    clearTimeout(revealTimer);
    revealTimer = 0;
  }
}

function paintTimer(frac) {
  const f = frac < 0 ? 0 : frac > 1 ? 1 : frac;
  elTimerFill.style.transform = "scaleX(" + f + ")";
}

function tickTimer() {
  timerRaf = 0;
  if ((mode !== MODE_CALL && mode !== MODE_PICK) || locked || gameOver) return;
  // pick countdown only runs once picking is unlocked
  if (mode === MODE_PICK && pickPhase !== PICK_PHASE_PICK) return;
  const left = 1 - (Date.now() - roundStarted) / roundMs;
  paintTimer(left);
  if (left <= 0) {
    onTimeout();
    return;
  }
  timerRaf = requestAnimationFrame(tickTimer);
}

function startTimer() {
  stopTimer();
  roundStarted = Date.now();
  paintTimer(1);
  timerRaf = requestAnimationFrame(tickTimer);
}

function decayRoundMs() {
  roundMs = Math.max(ROUND_MS_FLOOR, roundMs * ROUND_MS_DECAY);
}

function bumpRoundMs() {
  roundMs = roundMs * ROUND_MS_MISS;
}

function endGame() {
  gameOver = true;
  locked = true;
  clearRevealTimer();
  stopTimer();
  saveHi();
  paintHud();
  if (mode === MODE_CALL) {
    const buttons = elChoices.querySelectorAll("button");
    for (let i = 0; i < buttons.length; i++) buttons[i].disabled = true;
  }
}

function runAfterRoundAdvance(advance) {
  if (mode !== MODE_CALL && mode !== MODE_PICK) return;
  if (gameOver || !advance) return;
  decayRoundMs();
  if (mode === MODE_PICK) dealPickRound();
  else dealRound();
  layout();
  draw();
}

function afterRound(advance) {
  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
    feedbackTimer = 0;
  }
  // pick mode: stay on the answer until the player taps; call mode keeps the timed pause
  if (mode === MODE_PICK) {
    pickWaitAdvance = advance;
    // arm after this pointer ends so the same tap that locked the row does not advance
    setTimeout(function () {
      if (mode !== MODE_PICK || !locked) return;
      pickWaitTap = true;
    }, 0);
    return;
  }
  feedbackTimer = setTimeout(function () {
    feedbackTimer = 0;
    runAfterRoundAdvance(advance);
  }, FEEDBACK_MS);
}

function onPickFeedbackTap() {
  if (!pickWaitTap) return;
  pickWaitTap = false;
  const advance = pickWaitAdvance;
  pickWaitAdvance = false;
  runAfterRoundAdvance(advance);
}

function registerMiss() {
  bumpRoundMs();
  hearts -= 1;
  if (hearts < 0) hearts = 0;
  paintHud();
  if (hearts <= 0) {
    endGame();
    return false;
  }
  return true;
}

function onTimeout() {
  if (locked || gameOver) return;
  if (mode === MODE_CALL) {
    if (!answer) return;
    locked = true;
    stopTimer();
    const buttons = elChoices.querySelectorAll("button");
    for (let i = 0; i < buttons.length; i++) buttons[i].disabled = true;
    const correct = elChoices.querySelector('button[data-hand="' + answer + '"]');
    if (correct) correct.classList.add("answer");
    const alive = registerMiss();
    afterRound(alive);
    return;
  }
  if (mode === MODE_PICK) {
    if (pickPhase !== PICK_PHASE_PICK) return;
    if (pickWinner < 0) return;
    locked = true;
    clearRevealTimer();
    stopTimer();
    elTimer.hidden = true;
    pickChoice = -1;
    showPickWinnerLabel();
    draw();
    const alive = registerMiss();
    afterRound(alive);
  }
}

function dealRound() {
  if (gameOver) return;
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
  // best hand type of the dealt cards is what the player must call
  answer = classifyHand(hand);
  startTimer();
}

function pickTypeList(n, forceSame) {
  const types = [];
  for (let i = 0; i < n; i++) types.push(randomHand());
  if (forceSame && n >= 2) {
    const shared = randomHand();
    types[0] = shared;
    types[1] = shared;
  }
  return types;
}

function findStrictWinner(hands) {
  let best = 0;
  for (let i = 1; i < hands.length; i++) {
    if (compareHands(hands[i], hands[best]) > 0) best = i;
  }
  for (let i = 0; i < hands.length; i++) {
    if (i === best) continue;
    if (compareHands(hands[i], hands[best]) === 0) return -1;
  }
  return best;
}

// after the last hand's beat: show the blue timer and start the countdown
// (skipped if the player already tapped a row during that beat)
function beginPickCountdown() {
  if (mode !== MODE_PICK || gameOver || locked) return;
  clearRevealTimer();
  elTimer.hidden = false;
  paintTimer(1);
  startTimer();
}

function revealNextHand() {
  if (mode !== MODE_PICK || gameOver) return;
  pickRevealIdx += 1;
  // last hand on screen: picking is live right away; timer still waits one beat
  if (pickRevealIdx >= pickHands.length - 1) {
    pickPhase = PICK_PHASE_PICK;
    pickRevealIdx = pickHands.length - 1;
    draw();
    revealTimer = setTimeout(function () {
      revealTimer = 0;
      beginPickCountdown();
    }, PICK_REVEAL_MS);
    return;
  }
  draw();
  revealTimer = setTimeout(function () {
    revealTimer = 0;
    revealNextHand();
  }, PICK_REVEAL_MS);
}

function startPickReveal() {
  clearRevealTimer();
  stopTimer();
  elTimer.hidden = true;
  paintTimer(1);
  pickPhase = PICK_PHASE_REVEAL;
  pickRevealIdx = -1;
  if (!pickHands.length) {
    pickPhase = PICK_PHASE_PICK;
    return;
  }
  revealNextHand();
}

function dealPickRound() {
  if (gameOver) return;
  locked = false;
  clearRevealTimer();
  clearFeedback();
  pickHands = [];
  pickWinner = -1;
  pickChoice = -1;
  pickPhase = PICK_PHASE_REVEAL;
  pickRevealIdx = -1;

  const n = pickRows;
  for (let attempt = 0; attempt < PICK_DEAL_TRIES; attempt++) {
    const forceSame = Math.random() < PICK_SAME_TYPE_CHANCE;
    const types = pickTypeList(n, forceSame);
    const hands = [];
    let ok = true;
    for (let i = 0; i < n; i++) {
      let dealt = dealTypedHand(deck, discard, types[i]);
      if (!dealt) {
        resetShoe();
        dealt = dealTypedHand(deck, discard, types[i]);
      }
      if (!dealt) {
        ok = false;
        break;
      }
      hands.push(dealt);
    }
    if (!ok) {
      resetShoe();
      continue;
    }
    if (forceSame) {
      let sameCount = 0;
      const first = classifyHand(hands[0]);
      for (let i = 0; i < hands.length; i++) {
        if (classifyHand(hands[i]) === first) sameCount += 1;
      }
      // forced path needs at least two of one type so kickers matter
      if (sameCount < 2) {
        resetShoe();
        continue;
      }
    }
    const win = findStrictWinner(hands);
    if (win < 0) {
      resetShoe();
      continue;
    }
    pickHands = hands;
    pickWinner = win;
    startPickReveal();
    return;
  }
  pickHands = [];
  pickWinner = -1;
  pickPhase = PICK_PHASE_PICK;
  pickRevealIdx = -1;
}

function showPickWinnerLabel() {
  if (!elPickLabel || pickWinner < 0 || !pickHands[pickWinner]) return;
  elPickLabel.textContent = "";
  const name = document.createElement("div");
  name.textContent = formatWinnerLabel(pickHands[pickWinner], pickHands);
  const hint = document.createElement("div");
  hint.className = "pick-next";
  hint.textContent = "tap for next";
  elPickLabel.appendChild(name);
  elPickLabel.appendChild(hint);
}

function maybeBumpPickRows() {
  if (pickRows >= PICK_ROWS_MAX) return;
  if (score > 0 && score % PICK_BUMP_EVERY === 0) {
    pickRows += 1;
    bumpRoundMs();
  }
}

function onPickRow(row) {
  if (mode !== MODE_PICK || pickPhase !== PICK_PHASE_PICK || locked || gameOver || pickWinner < 0) return;
  if (row < 0 || row >= pickHands.length) return;
  locked = true;
  clearRevealTimer();
  stopTimer();
  elTimer.hidden = true;
  pickChoice = row;
  showPickWinnerLabel();
  if (row === pickWinner) {
    score += 1;
    saveHi();
    paintHud();
    maybeBumpPickRows();
    draw();
    afterRound(true);
    return;
  }
  draw();
  const alive = registerMiss();
  afterRound(alive);
}

function hitPickRow(x, y) {
  for (let i = 0; i < pickRowRects.length; i++) {
    const r = pickRowRects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function layout() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  cardGap = Math.round(Math.max(CARD_GAP_MIN, Math.min(CARD_GAP, canvas.width * CARD_GAP_VW)));
  pickRowRects = [];

  if (mode === MODE_CALL) {
    const topZone = canvas.height * (1 - BUTTON_ZONE);
    const usableW = canvas.width - HAND_SIDE_PAD * 2;
    const usableH = topZone - HUD_PAD;
    cardH = Math.min(CARD_MAX_H, Math.floor(usableH * 0.85));
    cardW = Math.floor(cardH * CARD_ASPECT);
    const rowW = rowWidth(cardW);
    if (rowW > usableW) {
      cardW = cardWForRow(usableW);
      cardH = Math.floor(cardW / CARD_ASPECT);
    }
    handX = Math.floor((canvas.width - (rowWidth(cardW))) / 2);
    handY = HUD_PAD + Math.floor((usableH - cardH) / 2);
    return;
  }

  if (mode === MODE_PICK) {
    // highlight outline sits just outside the cards, small margin so it hugs them
    const hlPad = Math.max(3, Math.round(cardGap * 0.4));
    // space between rows: room for both rows' outlines plus clear air between them
    const rowGap = cardGap * 3 + hlPad * 2;
    lastRowGap = rowGap;
    // room under the stack for timer + hand name (timer gap matches row gap)
    const bottomZone =
      rowGap + PICK_TIMER_H + PICK_LABEL_GAP + PICK_LABEL_H + PICK_CHROME_PAD;
    const sidePad = hlPad;
    const vertPad = hlPad;
    const usableW = canvas.width - HAND_SIDE_PAD * 2 - sidePad * 2;
    const usableH = canvas.height - HUD_PAD - bottomZone;
    const n = Math.max(pickHands.length, pickRows);
    const gaps = rowGap * Math.max(0, n - 1);
    cardH = Math.min(CARD_MAX_H, Math.floor((usableH - gaps) / Math.max(1, n)));
    cardW = Math.floor(cardH * CARD_ASPECT);
    let rowW = rowWidth(cardW);
    if (rowW > usableW) {
      cardW = cardWForRow(usableW);
      cardH = Math.floor(cardW / CARD_ASPECT);
      rowW = rowWidth(cardW);
    }
    // shrink again if stacked height still overshoots
    const stackH = cardH * n + gaps;
    if (stackH > usableH && n > 0) {
      cardH = Math.floor((usableH - gaps) / n);
      cardW = Math.floor(cardH * CARD_ASPECT);
      rowW = rowWidth(cardW);
      if (rowW > usableW) {
        cardW = cardWForRow(usableW);
        cardH = Math.floor(cardW / CARD_ASPECT);
        rowW = rowWidth(cardW);
      }
    }
    handX = Math.floor((canvas.width - rowW) / 2);
    const totalH = cardH * n + rowGap * Math.max(0, n - 1);
    const startY = HUD_PAD + Math.floor((usableH - totalH) / 2);
    for (let i = 0; i < n; i++) {
      const y = startY + i * (cardH + rowGap);
      pickRowRects.push({
        x: handX - sidePad,
        y: y - vertPad,
        w: rowW + sidePad * 2,
        h: cardH + vertPad * 2,
        cardY: y,
      });
    }
    positionPickChrome();
    return;
  }

  clearPickChrome();
}

function drawRoundRectPath(x, y, w, h, r) {
  const rr = Math.max(2, Math.min(r, Math.floor(Math.min(w, h) / 2)));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function pickRowHighlight(i) {
  if (!locked || pickWinner < 0) return null;
  if (pickChoice === pickWinner && i === pickWinner) return "right";
  if (pickChoice >= 0 && pickChoice !== pickWinner) {
    if (i === pickChoice) return "wrong";
    if (i === pickWinner) return "answer";
  }
  if (pickChoice < 0 && i === pickWinner) return "answer";
  return null;
}

function clearPickChrome() {
  elTimer.style.top = "";
  elTimer.style.bottom = "";
  if (elPickLabel) {
    elPickLabel.style.top = "";
    elPickLabel.style.bottom = "";
  }
}

// stack under the cards: timer, then the winning hand name
function positionPickChrome() {
  if (!pickRowRects.length) {
    clearPickChrome();
    return;
  }
  const last = pickRowRects[pickRowRects.length - 1];
  const cardsBottom = last.cardY + cardH;
  const underGap = lastRowGap > 0 ? lastRowGap : cardGap * 3;
  const timerTop = cardsBottom + underGap;
  elTimer.style.top = timerTop + "px";
  elTimer.style.bottom = "auto";
  if (elPickLabel) {
    elPickLabel.style.top = timerTop + PICK_TIMER_H + PICK_LABEL_GAP + "px";
    elPickLabel.style.bottom = "auto";
  }
}

function drawPickRowBar(rect, highlight) {
  // grey stroke across the back of the cards, full row width including side pads
  const midY = rect.cardY + cardH / 2;
  ctx.strokeStyle = PICK_BAR_COLOR;
  ctx.lineWidth = PICK_BAR_LINE;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.moveTo(rect.x, midY);
  ctx.lineTo(rect.x + rect.w, midY);
  ctx.stroke();

  // highlight outlines the whole row (cards + pad), does not fill the bar
  if (!highlight) return;
  let color = PICK_HL_ANSWER;
  if (highlight === "right") color = PICK_HL_RIGHT;
  else if (highlight === "wrong") color = PICK_HL_WRONG;
  const rad = Math.max(6, Math.floor(cardH * CARD_CORNER));
  drawRoundRectPath(rect.x, rect.y, rect.w, rect.h, rad);
  ctx.strokeStyle = color;
  ctx.lineWidth = PICK_HL_LINE;
  ctx.stroke();
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = BOARD_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (mode === MODE_CALL) {
    for (let i = 0; i < hand.length; i++) {
      hand[i].draw(ctx, handX + i * cardStep(cardW), handY, cardW, cardH);
    }
    return;
  }

  if (mode === MODE_PICK) {
    for (let i = 0; i < pickHands.length; i++) {
      const rect = pickRowRects[i];
      if (!rect) continue;
      // empty slots keep the grey mid-line and faint card shadows until that hand lands
      if (i > pickRevealIdx) {
        drawPickRowBar(rect, null);
        drawGhostRow(rect);
        continue;
      }
      drawPickRowBar(rect, pickRowHighlight(i));
      const row = pickHands[i];
      for (let c = 0; c < row.length; c++) {
        row[c].draw(ctx, handX + c * cardStep(cardW), rect.cardY, cardW, cardH);
      }
    }
  }
}

function drawGhostRow(rect) {
  // one long rounded slab covering where the five cards will sit
  const rad = Math.max(4, Math.floor(Math.min(cardW, cardH) * CARD_CORNER));
  const rowW = (HAND_SIZE - 1) * cardStep(cardW) + cardW;
  ctx.fillStyle = PICK_GHOST_COLOR;
  drawRoundRectPath(handX, rect.cardY, rowW, cardH, rad);
  ctx.fill();
}

function showTitle() {
  if (feedbackTimer) {
    clearTimeout(feedbackTimer);
    feedbackTimer = 0;
  }
  clearRevealTimer();
  pickWaitTap = false;
  pickWaitAdvance = false;
  mode = MODE_TITLE;
  locked = false;
  gameOver = false;
  hand = [];
  answer = null;
  pickHands = [];
  pickWinner = -1;
  pickChoice = -1;
  pickPhase = PICK_PHASE_PICK;
  pickRevealIdx = -1;
  stopTimer();
  elTitle.hidden = false;
  elHud.hidden = true;
  elChoices.hidden = true;
  elTimer.hidden = true;
  if (elPickLabel) {
    elPickLabel.hidden = true;
    elPickLabel.textContent = "";
  }
  document.body.classList.remove("mode-pick");
  clearPickChrome();
  layout();
  draw();
}

function startCallIt() {
  clearRevealTimer();
  mode = MODE_CALL;
  hiKey = HI_KEY;
  score = 0;
  hearts = MAX_HEARTS;
  gameOver = false;
  roundMs = ROUND_MS_START;
  pickHands = [];
  pickWinner = -1;
  pickPhase = PICK_PHASE_PICK;
  pickRevealIdx = -1;
  loadHi();
  paintHud();
  resetShoe();
  elTitle.hidden = true;
  elHud.hidden = false;
  elChoices.hidden = false;
  elTimer.hidden = false;
  if (elPickLabel) {
    elPickLabel.hidden = true;
    elPickLabel.textContent = "";
  }
  document.body.classList.remove("mode-pick");
  clearPickChrome();
  dealRound();
  layout();
  draw();
}

function startPickIt() {
  clearRevealTimer();
  mode = MODE_PICK;
  hiKey = HI_KEY_PICK;
  score = 0;
  hearts = MAX_HEARTS;
  gameOver = false;
  roundMs = PICK_ROUND_MS_START;
  pickRows = PICK_ROWS_START;
  pickPhase = PICK_PHASE_REVEAL;
  pickRevealIdx = -1;
  hand = [];
  answer = null;
  loadHi();
  paintHud();
  resetShoe();
  elTitle.hidden = true;
  elHud.hidden = false;
  elChoices.hidden = true;
  elTimer.hidden = true;
  if (elPickLabel) {
    elPickLabel.hidden = false;
    elPickLabel.textContent = "";
  }
  document.body.classList.add("mode-pick");
  dealPickRound();
  layout();
  draw();
}

function onGuess(type, btn) {
  if (mode !== MODE_CALL || locked || !answer || gameOver) return;
  locked = true;
  stopTimer();
  const buttons = elChoices.querySelectorAll("button");
  for (let i = 0; i < buttons.length; i++) buttons[i].disabled = true;
  if (type === answer) {
    score += 1;
    saveHi();
    paintHud();
    btn.classList.add("right");
    afterRound(true);
    return;
  }
  btn.classList.add("wrong");
  const correct = elChoices.querySelector('button[data-hand="' + answer + '"]');
  if (correct) correct.classList.add("answer");
  const alive = registerMiss();
  afterRound(alive);
}

function buildButtons() {
  elChoices.innerHTML = "";
  for (let i = 0; i < HAND_TYPES.length; i++) {
    const type = HAND_TYPES[i];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.hand = type;
    btn.textContent = HAND_LABELS[type];
    if (type === "straight" || type === "straight_flush") btn.classList.add("hand-straight");
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

function onBoardPointer(e) {
  if (mode === MODE_PICK && pickWaitTap) {
    onPickFeedbackTap();
    return;
  }
  if (mode !== MODE_PICK || pickPhase !== PICK_PHASE_PICK || locked || gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;
  const row = hitPickRow(x, y);
  if (row >= 0) onPickRow(row);
}

loadHi();
buildButtons();
showTitle();

elBack.addEventListener("click", showTitle);
elCall.addEventListener("click", startCallIt);
elPick.addEventListener("click", startPickIt);
canvas.addEventListener("pointerdown", onBoardPointer);
document.body.addEventListener("pointerdown", function (e) {
  if (!pickWaitTap || mode !== MODE_PICK) return;
  if (e.target && e.target.closest && e.target.closest("#btn-back, #title-screen")) return;
  // the board surface already handles those taps
  if (e.target === canvas) return;
  onPickFeedbackTap();
});

window.addEventListener("resize", onViewport);
