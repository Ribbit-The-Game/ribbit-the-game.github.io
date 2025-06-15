
const firebaseConfig = {
  apiKey: "AIzaSyAsUpICyVMbxwEcNuB5LX-dNwHk68bOf_I",
  authDomain: "ribbit-the-game.firebaseapp.com",
  projectId: "ribbit-the-game",
  storageBucket: "ribbit-the-game.firebasestorage.app",
  messagingSenderId: "94544175859",
  appId: "1:94544175859:web:4cc06a20f019218b9c0d86"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();


const MAX_DECK_SIZE = 20;
const MAX_COPIES = 3;
const HAND_LIMIT = 5;
const FIELD_LIMIT = 5;
const INITIAL_LP = 8000;


let ALL_CARDS = [];
let unlockedCards = [];
let currentDeck = [];
let deck = [];
let playerHand = [];
let playerField = [];
let enemyField = [];

let playerLP = INITIAL_LP;
let enemyLP = INITIAL_LP;
let enemyLevel = 1;


const deckCountSpan = document.getElementById("deckCount");
const playerLPSpan = document.getElementById("playerLP");
const enemyLPSpan = document.getElementById("enemyLP");
const gameLog = document.getElementById("gameLog");
const playerHandDiv = document.getElementById("playerHand");
const playerFieldDiv = document.getElementById("playerField");
const enemyFieldDiv = document.getElementById("enemyField");
const unlockedCardsDiv = document.getElementById("unlockedCards");
const currentDeckDiv = document.getElementById("currentDeck");
const winScreen = document.getElementById("winScreen");
const loseScreen = document.getElementById("loseScreen");



async function loadAllCards() {
  try {
    const response = await fetch('cards.json');
    ALL_CARDS = await response.json();
    console.log(`Loaded ${ALL_CARDS.length} cards`);
  } catch (err) {
    console.error("Failed to load cards.json:", err);
  }
}


function mapCardData(savedCards) {
  if (!Array.isArray(savedCards)) return [];
  return savedCards.map(saved => ALL_CARDS.find(c => c.id === saved.id) || saved);
}



function log(message) {
  gameLog.textContent = message;
}



function showAuthMessage(msg) {
  document.getElementById("authMessage").textContent = msg;
}

function login() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) {
    showAuthMessage("Enter email and password");
    return;
  }
  auth.signInWithEmailAndPassword(email, password).catch(e => showAuthMessage(e.message));
}

function register() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) {
    showAuthMessage("Enter email and password");
    return;
  }
  auth.createUserWithEmailAndPassword(email, password).catch(e => showAuthMessage(e.message));
}

function logout() {
  auth.signOut();
}



auth.onAuthStateChanged(async user => {
  if (user) {
    document.getElementById("authContainer").style.display = "none";
    document.getElementById("gameContainer").style.display = "block";
    await loadUserData(user.uid);
  } else {
    document.getElementById("authContainer").style.display = "block";
    document.getElementById("gameContainer").style.display = "none";
    unlockedCards = [];
    currentDeck = [];
    deck = [];
    resetGame();
    hideWinLoseScreens();
  }
});



async function loadUserData(uid) {
  if (ALL_CARDS.length === 0) await loadAllCards();

  const doc = await db.collection("users").doc(uid).get();
  if (!doc.exists) {
    
    unlockedCards = ALL_CARDS.slice(0, 5);
    currentDeck = [];
    await saveUserData(uid);
  } else {
    unlockedCards = mapCardData(doc.data().unlocked);
    currentDeck = mapCardData(doc.data().deck);
  }

  deck = [...currentDeck];
  renderDeckCount();
  renderUnlockedCards();
  renderDeck();
  resetGame();
}

async function saveUserData(uid) {
  try {
    await db.collection("users").doc(uid).set({
      unlocked: unlockedCards,
      deck: currentDeck
    }, { merge: true });
    log("Data saved!");
  } catch (err) {
    log("Save error: " + err.message);
  }
}



function unlockCardById(cardId) {
  if (!auth.currentUser) {
    log("You must be logged in to unlock cards.");
    return;
  }
  const card = ALL_CARDS.find(c => c.id === cardId);
  if (!card) {
    log(`Card with ID '${cardId}' not found.`);
    return;
  }
  if (unlockedCards.some(c => c.id === cardId)) {
    log(`${card.name} is already unlocked.`);
    return;
  }
  unlockedCards.push(card);
  saveUserData(auth.currentUser.uid);
  renderUnlockedCards();
  log(`Unlocked card: ${card.name}`);
}



function createCardElement(card) {
  const cardDiv = document.createElement("div");
  cardDiv.className = "card";
  cardDiv.innerHTML = `
    <img class="card-img" src="${card.image}" alt="${card.name}" />
    <div class="card-info">
      <strong>${card.name}</strong><br/>
      ATK: ${card.atk} | DEF: ${card.def}
    </div>
  `;
  return cardDiv;
}

function renderUnlockedCards() {
  unlockedCardsDiv.innerHTML = "";
  unlockedCards.forEach(card => {
    const cardEl = createCardElement(card);
    cardEl.title = "Click to add to deck";
    cardEl.onclick = () => addCardToDeck(card);
    unlockedCardsDiv.appendChild(cardEl);
  });
}

function renderDeck() {
  currentDeckDiv.innerHTML = "";
  currentDeck.forEach((card, i) => {
    const cardEl = createCardElement(card);
    cardEl.title = "Click to remove from deck";
    cardEl.onclick = () => removeCardFromDeck(i);
    currentDeckDiv.appendChild(cardEl);
  });
  renderDeckCount();
}

function renderDeckCount() {
  deckCountSpan.textContent = currentDeck.length;
}

function renderLP() {
  playerLPSpan.textContent = playerLP;
  enemyLPSpan.textContent = enemyLP;
}

function clearBoard() {
  playerHandDiv.innerHTML = "";
  playerFieldDiv.innerHTML = "";
  enemyFieldDiv.innerHTML = "";
}

function renderHand() {
  playerHandDiv.innerHTML = "";
  playerHand.forEach((card, idx) => {
    const cardEl = createCardElement(card);
    cardEl.title = "Click to summon to field";
    cardEl.onclick = () => summonCard(idx);
    playerHandDiv.appendChild(cardEl);
  });
}

function renderField() {
  playerFieldDiv.innerHTML = "";
  playerField.forEach((card, idx) => {
    const cardEl = createCardElement(card);
    cardEl.title = "Click to attack enemy directly";
    cardEl.onclick = () => attackEnemy(idx);
    playerFieldDiv.appendChild(cardEl);
  });
  renderEnemyField();
}

function renderEnemyField() {
  enemyFieldDiv.innerHTML = "";
  enemyField.forEach(card => {
    const cardEl = createCardElement(card);
    cardEl.style.cursor = "default";
    enemyFieldDiv.appendChild(cardEl);
  });
}



function addCardToDeck(card) {
  if (currentDeck.length >= MAX_DECK_SIZE) {
    log("Deck full! Max 20 cards.");
    return;
  }
  const count = currentDeck.filter(c => c.name === card.name).length;
  if (count >= MAX_COPIES) {
    log(`Only 3 copies of ${card.name} allowed.`);
    return;
  }
  currentDeck.push(card);
  renderDeck();
}

function removeCardFromDeck(index) {
  currentDeck.splice(index, 1);
  renderDeck();
}

function saveDeck() {
  if (!auth.currentUser) {
    log("You must be logged in to save your deck.");
    return;
  }
  saveUserData(auth.currentUser.uid);
  log("Deck saved!");
}

function generateRandomDeck(count) {
  if (unlockedCards.length === 0) {
    log("No unlocked cards available.");
    return;
  }

  let newDeck = [];
  while (newDeck.length < count) {
    const randomCard = unlockedCards[Math.floor(Math.random() * unlockedCards.length)];
    const copies = newDeck.filter(c => c.name === randomCard.name).length;
    if (copies < MAX_COPIES) newDeck.push(randomCard);
  }

  currentDeck = newDeck;
  renderDeck();
  saveDeck();
  log(`Random deck generated with ${count} cards.`);
}



function resetGame() {
  playerLP = INITIAL_LP;
  enemyLP = INITIAL_LP;
  playerHand = [];
  playerField = [];
  enemyField = [];
  deck = [...currentDeck];
  renderLP();
  clearBoard();
  hideWinLoseScreens();
  log("Game reset. Draw cards to start.");
}

function drawCard() {
  if (deck.length === 0) {
    log("Deck empty!");
    return;
  }
  if (playerHand.length >= HAND_LIMIT) {
    log("Hand full! Max 5 cards.");
    return;
  }
  const card = deck.shift();
  playerHand.push(card);
  renderHand();
  renderDeckCount();
  log(`Drew ${card.name}`);
}

function summonCard(handIndex) {
  if (playerField.length >= FIELD_LIMIT) {
    log("Field full! Max 5 monsters.");
    return;
  }
  const card = playerHand[handIndex];
  playerField.push(card);
  playerHand.splice(handIndex, 1);
  renderHand();
  renderField();
  log(`Summoned ${card.name}`);
}

function attackEnemy(fieldIndex) {
  const attacker = playerField[fieldIndex];
  if (enemyField.length === 0) {
    enemyLP -= attacker.atk;
    renderLP();
    log(`${attacker.name} attacked enemy directly for ${attacker.atk} damage!`);
    if (enemyLP <= 0) handleWin();
  } else {
    const targetIndex = Math.floor(Math.random() * enemyField.length);
    const target = enemyField[targetIndex];

    if (attacker.atk > target.def) {
      enemyField.splice(targetIndex, 1);
      log(`${attacker.name} destroyed enemy's ${target.name}!`);
    } else if (attacker.atk < target.def) {
      playerField.splice(fieldIndex, 1);
      log(`${attacker.name} was destroyed attacking ${target.name}!`);
    } else {
      log(`${attacker.name} and ${target.name} both survived the clash.`);
    }

    renderField();
    renderLP();
  }
}

function enemyTurn() {
  
  if (enemyField.length < FIELD_LIMIT && unlockedCards.length > 0) {
    const baseCard = unlockedCards[Math.floor(Math.random() * unlockedCards.length)];
    const strongerCard = {
      ...baseCard,
      atk: baseCard.atk + enemyLevel * 50,
      def: baseCard.def + enemyLevel * 50
    };
    enemyField.push(strongerCard);
    log(`Enemy summoned ${strongerCard.name} (${strongerCard.atk}/${strongerCard.def})`);
  }

  
  const totalAtk = enemyField.reduce((sum, c) => sum + c.atk, 0);
  playerLP -= totalAtk;
  renderLP();
  log(`Enemy attacks player directly for ${totalAtk} damage!`);

  if (playerLP <= 0) {
    showLoseScreen();
    log("You lost the duel!");
  } else if (enemyLP <= 0) {
    handleWin();
  }
}



function handleWin() {
  winScreen.style.display = "flex";
  log("You won the duel!");
}

function showLoseScreen() {
  loseScreen.style.display = "flex";
}

function hideWinLoseScreens() {
  winScreen.style.display = "none";
  loseScreen.style.display = "none";
}

function claimWinRewards() {
  const newCards = [];
  for (let i = 0; i < 5; i++) {
    const card = ALL_CARDS[Math.floor(Math.random() * ALL_CARDS.length)];
    newCards.push(card);
    if (!unlockedCards.some(c => c.id === card.id)) {
      unlockedCards.push(card);
    }
  }
  renderUnlockedCards();
  saveUserData(auth.currentUser.uid);
  alert("You unlocked:\n" + newCards.map(c => c.name).join(", "));
  winScreen.style.display = "none";
  enemyLevel++; 
  resetGame();
}



document.getElementById("randomDeckBtn").onclick = () => {
  if (!auth.currentUser) {
    log("You must be logged in to generate a deck.");
    return;
  }
  generateRandomDeck(10);
};

document.getElementById("unlockRandomDeckBtn").onclick = () => {
  if (!auth.currentUser) {
    log("You must be logged in to unlock cards.");
    return;
  }
  if (ALL_CARDS.length < 10) {
    log("Not enough cards to unlock 10.");
    return;
  }
  const lockedCards = ALL_CARDS.filter(c => !unlockedCards.some(u => u.id === c.id));
  if (lockedCards.length === 0) {
    log("All cards already unlocked!");
    return;
  }
  const countToUnlock = Math.min(10, lockedCards.length);
  const shuffled = lockedCards.sort(() => 0.5 - Math.random());
  const cardsToUnlock = shuffled.slice(0, countToUnlock);

  cardsToUnlock.forEach(card => unlockedCards.push(card));
  saveUserData(auth.currentUser.uid);
  renderUnlockedCards();
  log(`Unlocked ${countToUnlock} new cards!`);
};

document.getElementById("winRetryBtn").onclick = () => {
  winScreen.style.display = "none";
  resetGame();
};

document.getElementById("loseRetryBtn").onclick = () => {
  loseScreen.style.display = "none";
  resetGame();
};



setInterval(() => {
  if (auth.currentUser) enemyTurn();
}, 6000);
function toggleCollectionMenu() {
    const menu = document.getElementById("collectionMenu");
    if (!menu) return;
    if (menu.style.display === "none" || menu.style.display === "") {
        renderCardCollection();
        menu.style.display = "block";
    } else {
        menu.style.display = "none";
    }
}

function renderCardCollection() {
    const container = document.getElementById("cardCollection");
    if (!container) return;

    container.innerHTML = "";

    
    const cardCounts = {};
    unlockedCards.forEach(card => {
        const key = card.name;
        if (!cardCounts[key]) {
            cardCounts[key] = { ...card, count: 1 };
        } else {
            cardCounts[key].count++;
        }
    });

    
    Object.values(cardCounts).forEach(card => {
        const cardDiv = document.createElement("div");
        cardDiv.className = "card-collection-entry";
        cardDiv.innerHTML = `
            <img src="${card.image}" alt="${card.name}" class="card-img-small" />
            <div><strong>${card.name}</strong></div>
            <div>Copies: ${card.count}</div>
        `;
        container.appendChild(cardDiv);
    });
}
