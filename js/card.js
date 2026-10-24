/** One playing card: rank, suit, and how it paints itself. */

const CARD_FILL = "#ffffff";
const CARD_EDGE = "#333333";
const CARD_INK_BLACK = "#111111";
const CARD_INK_RED = "#cc3333";
const CARD_CORNER = 0.12;
const CARD_EDGE_W = 4;
const CARD_RANK_FRAC = 0.42;
const CARD_SUIT_FRAC = 0.48;
const CARD_RANK_Y = 0.32;
const CARD_SUIT_Y = 0.72;

const CARD_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const CARD_SUITS = ["♠", "♥", "♦", "♣"];

function Card(rank, suit) {
  this.rank = rank;
  this.suit = suit;
}

Card.prototype.isRed = function () {
  return this.suit === "♥" || this.suit === "♦";
};

Card.prototype.draw = function (ctx, x, y, w, h) {
  const r = Math.max(4, Math.floor(Math.min(w, h) * CARD_CORNER));
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = CARD_FILL;
  ctx.fill();
  ctx.strokeStyle = CARD_EDGE;
  ctx.lineWidth = CARD_EDGE_W;
  ctx.stroke();

  const ink = this.isRed() ? CARD_INK_RED : CARD_INK_BLACK;
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 " + Math.floor(h * CARD_RANK_FRAC) + "px system-ui, sans-serif";
  ctx.fillText(this.rank, x + w / 2, y + h * CARD_RANK_Y);
  ctx.font = "700 " + Math.floor(h * CARD_SUIT_FRAC) + "px system-ui, sans-serif";
  ctx.fillText(this.suit, x + w / 2, y + h * CARD_SUIT_Y);
  ctx.restore();
};
