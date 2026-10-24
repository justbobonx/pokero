/** Hand types, weighted pick, classify, and deal-from-deck builders. */

const HAND_STRAIGHT_FLUSH = "straight_flush";
const HAND_QUADS = "quads";
const HAND_FULL_HOUSE = "full_house";
const HAND_FLUSH = "flush";
const HAND_STRAIGHT = "straight";
const HAND_TRIPS = "trips";
const HAND_TWO_PAIR = "two_pair";
const HAND_PAIR = "pair";

const HAND_TYPES = [
  HAND_STRAIGHT_FLUSH,
  HAND_QUADS,
  HAND_FULL_HOUSE,
  HAND_FLUSH,
  HAND_STRAIGHT,
  HAND_TRIPS,
  HAND_TWO_PAIR,
  HAND_PAIR,
];

const HAND_WEIGHTS = [1, 2, 3, 4, 5, 6, 7, 8];

const HAND_LABELS = {
  straight_flush: "Straight Flush",
  quads: "4 of a kind",
  full_house: "Full House",
  flush: "Flush",
  straight: "Straight",
  trips: "3 of a kind",
  two_pair: "Two pair",
  pair: "Pair",
};

const HAND_BUILD_TRIES = 40;

function rankValue(rank) {
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  return rank | 0;
}

function randomHand() {
  let total = 0;
  for (let i = 0; i < HAND_WEIGHTS.length; i++) total += HAND_WEIGHTS[i];
  let pick = Math.random() * total;
  for (let i = 0; i < HAND_TYPES.length; i++) {
    pick -= HAND_WEIGHTS[i];
    if (pick < 0) return HAND_TYPES[i];
  }
  return HAND_PAIR;
}

function classifyHand(cards) {
  if (!cards || cards.length !== 5) return null;
  const values = [];
  const suits = [];
  for (let i = 0; i < 5; i++) {
    values.push(rankValue(cards[i].rank));
    suits.push(cards[i].suit);
  }
  values.sort(function (a, b) {
    return a - b;
  });

  const counts = {};
  for (let i = 0; i < 5; i++) {
    const r = cards[i].rank;
    counts[r] = (counts[r] || 0) + 1;
  }
  const groups = [];
  for (const r in counts) groups.push({ rank: r, n: counts[r], v: rankValue(r) });
  groups.sort(function (a, b) {
    if (b.n !== a.n) return b.n - a.n;
    return b.v - a.v;
  });

  let flush = true;
  for (let i = 1; i < 5; i++) if (suits[i] !== suits[0]) flush = false;

  const uniq = [];
  for (let i = 0; i < 5; i++) if (uniq.indexOf(values[i]) < 0) uniq.push(values[i]);
  let straight = false;
  if (uniq.length === 5) {
    if (uniq[4] - uniq[0] === 4) straight = true;
    else if (uniq[0] === 2 && uniq[1] === 3 && uniq[2] === 4 && uniq[3] === 5 && uniq[4] === 14) straight = true;
  }

  if (straight && flush) return HAND_STRAIGHT_FLUSH;
  if (groups[0].n === 4) return HAND_QUADS;
  if (groups[0].n === 3 && groups[1] && groups[1].n === 2) return HAND_FULL_HOUSE;
  if (flush) return HAND_FLUSH;
  if (straight) return HAND_STRAIGHT;
  if (groups[0].n === 3) return HAND_TRIPS;
  if (groups[0].n === 2 && groups[1] && groups[1].n === 2) return HAND_TWO_PAIR;
  if (groups[0].n === 2) return HAND_PAIR;
  return null;
}

function takeAt(deck, i) {
  return deck.splice(i, 1)[0];
}

function findInDeck(deck, pred, from) {
  for (let i = from || 0; i < deck.length; i++) if (pred(deck[i])) return i;
  return -1;
}

function cardsOfRank(deck, rank) {
  const out = [];
  for (let i = 0; i < deck.length; i++) if (deck[i].rank === rank) out.push(i);
  return out;
}

function cardsOfSuit(deck, suit) {
  const out = [];
  for (let i = 0; i < deck.length; i++) if (deck[i].suit === suit) out.push(i);
  return out;
}

function takeIndices(deck, indices) {
  indices = indices.slice().sort(function (a, b) {
    return b - a;
  });
  const out = [];
  for (let i = 0; i < indices.length; i++) out.push(takeAt(deck, indices[i]));
  out.reverse();
  return out;
}

function sameSuit(cards) {
  for (let i = 1; i < cards.length; i++) if (cards[i].suit !== cards[0].suit) return false;
  return true;
}

function isStraightValues(values) {
  const uniq = values.slice().sort(function (a, b) {
    return a - b;
  });
  const u = [];
  for (let i = 0; i < uniq.length; i++) if (u.indexOf(uniq[i]) < 0) u.push(uniq[i]);
  if (u.length !== 5) return false;
  if (u[4] - u[0] === 4) return true;
  return u[0] === 2 && u[1] === 3 && u[2] === 4 && u[3] === 5 && u[4] === 14;
}

function straightRankSets() {
  return [
    ["A", "2", "3", "4", "5"],
    ["2", "3", "4", "5", "6"],
    ["3", "4", "5", "6", "7"],
    ["4", "5", "6", "7", "8"],
    ["5", "6", "7", "8", "9"],
    ["6", "7", "8", "9", "10"],
    ["7", "8", "9", "10", "J"],
    ["8", "9", "10", "J", "Q"],
    ["9", "10", "J", "Q", "K"],
    ["10", "J", "Q", "K", "A"],
  ];
}

function buildStraightFlush(deck) {
  const sets = straightRankSets();
  for (let s = 0; s < CARD_SUITS.length; s++) {
    const suit = CARD_SUITS[s];
    for (let i = 0; i < sets.length; i++) {
      const need = sets[i];
      const idxs = [];
      let ok = true;
      for (let r = 0; r < 5; r++) {
        const ix = findInDeck(
          deck,
          function (c) {
            return c.rank === need[r] && c.suit === suit;
          },
          0
        );
        // Avoid reusing the same index if somehow duplicated — each rank once per suit.
        if (ix < 0 || idxs.indexOf(ix) >= 0) {
          ok = false;
          break;
        }
        idxs.push(ix);
      }
      if (ok) return takeIndices(deck, idxs);
    }
  }
  return null;
}

function buildQuads(deck) {
  for (let r = 0; r < CARD_RANKS.length; r++) {
    const rank = CARD_RANKS[r];
    const idxs = cardsOfRank(deck, rank);
    if (idxs.length < 4) continue;
    const four = idxs.slice(0, 4);
    const kicker = findInDeck(
      deck,
      function (c) {
        return c.rank !== rank;
      },
      0
    );
    if (kicker < 0) continue;
    return takeIndices(deck, four.concat([kicker]));
  }
  return null;
}

function buildFullHouse(deck) {
  for (let r = 0; r < CARD_RANKS.length; r++) {
    const tripRank = CARD_RANKS[r];
    const trips = cardsOfRank(deck, tripRank);
    if (trips.length < 3) continue;
    for (let p = 0; p < CARD_RANKS.length; p++) {
      const pairRank = CARD_RANKS[p];
      if (pairRank === tripRank) continue;
      const pairs = cardsOfRank(deck, pairRank);
      if (pairs.length < 2) continue;
      return takeIndices(deck, trips.slice(0, 3).concat(pairs.slice(0, 2)));
    }
  }
  return null;
}

function buildFlush(deck) {
  for (let s = 0; s < CARD_SUITS.length; s++) {
    const suit = CARD_SUITS[s];
    const idxs = cardsOfSuit(deck, suit);
    if (idxs.length < 5) continue;
    // Try combinations of 5 in deck order (first 5+ search) that are not a straight.
    for (let a = 0; a < idxs.length - 4; a++) {
      for (let b = a + 1; b < idxs.length - 3; b++) {
        for (let c = b + 1; c < idxs.length - 2; c++) {
          for (let d = c + 1; d < idxs.length - 1; d++) {
            for (let e = d + 1; e < idxs.length; e++) {
              const pick = [idxs[a], idxs[b], idxs[c], idxs[d], idxs[e]];
              const vals = [];
              for (let i = 0; i < 5; i++) vals.push(rankValue(deck[pick[i]].rank));
              if (isStraightValues(vals)) continue;
              return takeIndices(deck, pick);
            }
          }
        }
      }
    }
  }
  return null;
}

function buildStraight(deck) {
  const sets = straightRankSets();
  for (let i = 0; i < sets.length; i++) {
    const need = sets[i];
    const idxs = [];
    const used = {};
    let ok = true;
    for (let r = 0; r < 5; r++) {
      let found = -1;
      for (let d = 0; d < deck.length; d++) {
        if (used[d]) continue;
        if (deck[d].rank !== need[r]) continue;
        found = d;
        break;
      }
      if (found < 0) {
        ok = false;
        break;
      }
      used[found] = true;
      idxs.push(found);
    }
    if (!ok) continue;
    const trial = [];
    for (let j = 0; j < 5; j++) trial.push(deck[idxs[j]]);
    if (sameSuit(trial)) {
      let fixed = false;
      for (let j = 0; j < 5 && !fixed; j++) {
        const rank = need[j];
        const oldSuit = trial[j].suit;
        for (let d = 0; d < deck.length; d++) {
          if (used[d]) continue;
          if (deck[d].rank !== rank) continue;
          if (deck[d].suit === oldSuit) continue;
          delete used[idxs[j]];
          used[d] = true;
          idxs[j] = d;
          fixed = true;
          break;
        }
      }
      if (!fixed) continue;
      trial.length = 0;
      for (let j = 0; j < 5; j++) trial.push(deck[idxs[j]]);
      if (sameSuit(trial)) continue;
    }
    return takeIndices(deck, idxs);
  }
  return null;
}

function buildTrips(deck) {
  for (let r = 0; r < CARD_RANKS.length; r++) {
    const rank = CARD_RANKS[r];
    const trips = cardsOfRank(deck, rank);
    if (trips.length < 3) continue;
    const kickIdx = [];
    const kickRanks = {};
    for (let d = 0; d < deck.length && kickIdx.length < 2; d++) {
      if (deck[d].rank === rank) continue;
      if (kickRanks[deck[d].rank]) continue;
      // Would this kicker set make a flush with the three? Check at the end.
      kickRanks[deck[d].rank] = true;
      kickIdx.push(d);
    }
    if (kickIdx.length < 2) continue;
    const pick = trips.slice(0, 3).concat(kickIdx);
    const trial = [];
    for (let i = 0; i < pick.length; i++) trial.push(deck[pick[i]]);
    if (sameSuit(trial)) continue;
    if (classifyHand(trial) !== HAND_TRIPS) continue;
    return takeIndices(deck, pick);
  }
  return null;
}

function buildTwoPair(deck) {
  for (let r = 0; r < CARD_RANKS.length; r++) {
    const r1 = CARD_RANKS[r];
    const p1 = cardsOfRank(deck, r1);
    if (p1.length < 2) continue;
    for (let q = r + 1; q < CARD_RANKS.length; q++) {
      const r2 = CARD_RANKS[q];
      const p2 = cardsOfRank(deck, r2);
      if (p2.length < 2) continue;
      const kicker = findInDeck(
        deck,
        function (c) {
          return c.rank !== r1 && c.rank !== r2;
        },
        0
      );
      if (kicker < 0) continue;
      const pick = p1.slice(0, 2).concat(p2.slice(0, 2), [kicker]);
      const trial = [];
      for (let i = 0; i < pick.length; i++) trial.push(deck[pick[i]]);
      if (sameSuit(trial)) continue;
      if (classifyHand(trial) !== HAND_TWO_PAIR) continue;
      return takeIndices(deck, pick);
    }
  }
  return null;
}

function buildPair(deck) {
  for (let r = 0; r < CARD_RANKS.length; r++) {
    const rank = CARD_RANKS[r];
    const pairs = cardsOfRank(deck, rank);
    if (pairs.length < 2) continue;
    const kickIdx = [];
    const kickRanks = {};
    for (let d = 0; d < deck.length && kickIdx.length < 3; d++) {
      if (deck[d].rank === rank) continue;
      if (kickRanks[deck[d].rank]) continue;
      kickRanks[deck[d].rank] = true;
      kickIdx.push(d);
    }
    if (kickIdx.length < 3) continue;
    const pick = pairs.slice(0, 2).concat(kickIdx);
    const trial = [];
    for (let i = 0; i < pick.length; i++) trial.push(deck[pick[i]]);
    if (sameSuit(trial)) continue;
    if (classifyHand(trial) !== HAND_PAIR) continue;
    return takeIndices(deck, pick);
  }
  return null;
}

function buildHandOfType(deck, type) {
  if (type === HAND_STRAIGHT_FLUSH) return buildStraightFlush(deck);
  if (type === HAND_QUADS) return buildQuads(deck);
  if (type === HAND_FULL_HOUSE) return buildFullHouse(deck);
  if (type === HAND_FLUSH) return buildFlush(deck);
  if (type === HAND_STRAIGHT) return buildStraight(deck);
  if (type === HAND_TRIPS) return buildTrips(deck);
  if (type === HAND_TWO_PAIR) return buildTwoPair(deck);
  if (type === HAND_PAIR) return buildPair(deck);
  return null;
}

function refillDeck(deck, discard) {
  while (discard.length) deck.push(discard.pop());
  shuffleDeck(deck);
}

function shuffleDeck(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = cards[i];
    cards[i] = cards[j];
    cards[j] = t;
  }
}

function dealTypedHand(deck, discard, type) {
  for (let attempt = 0; attempt < HAND_BUILD_TRIES; attempt++) {
    if (deck.length < 5) refillDeck(deck, discard);
    const snapshot = deck.slice();
    const hand = buildHandOfType(deck, type);
    if (hand && classifyHand(hand) === type) {
      for (let i = 0; i < hand.length; i++) discard.push(hand[i]);
      return hand;
    }
    // Restore and reshuffle for another try.
    deck.length = 0;
    for (let i = 0; i < snapshot.length; i++) deck.push(snapshot[i]);
    refillDeck(deck, discard);
  }
  return null;
}
