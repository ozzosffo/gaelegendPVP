const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const selectScreen = document.querySelector("#characterSelect");
const gameScreen = document.querySelector("#gameScreen");
const characterGrid = document.querySelector("#characterGrid");
const nameInput = document.querySelector("#nameInput");
const roomCodeInput = document.querySelector("#roomCodeInput");
const statusText = document.querySelector("#status");
const scoreboard = document.querySelector("#scoreboard");
const abilityBar = document.querySelector("#abilityBar");
const changeCharacterButton = document.querySelector("#changeCharacter");
const waitingRoom = document.querySelector("#waitingRoom");
const waitingStatus = document.querySelector("#waitingStatus");
const waitingPlayers = document.querySelector("#waitingPlayers");
const hostButton = document.querySelector("#hostButton");
const guestButton = document.querySelector("#guestButton");
const startGameButton = document.querySelector("#startGameButton");
const backToLobbyButton = document.querySelector("#backToLobby");
const roomCodeDisplay = document.querySelector("#roomCodeDisplay");
const copyRoomCodeButton = document.querySelector("#copyRoomCodeButton");
const lobbyFloatLayer = document.querySelector("#lobbyFloatLayer");

let myId = null;
let state = { players: [], platforms: [], world: { width: 3200, height: 900, floor: 808 } };
let latestEvent = "";
let eventUntil = 0;
let selectedCharacter = "blaze";
const clawAfterimages = [];
const lastClawTimers = new Map();
const camera = { x: 0, y: 0, initialized: false };
let peerConnection = null;
let dataChannel = null;
let peerChannels = new Set();
let networkRole = "menu";
let hostState = null;
let hostInputs = {};
let peerInputs = {};
let lastHostTick = performance.now();
let lastBroadcast = 0;
let gameStarted = false;
let nextGuestNumber = 1;

const characters = [
  { id: "blaze", name: "불꽃", color: "#ff4d6d", speed: 78, power: 72, jump: 68 },
  { id: "volt", name: "번개", color: "#38bdf8", speed: 92, power: 56, jump: 82 },
  { id: "brick", name: "철벽", color: "#22c55e", speed: 58, power: 94, jump: 52 },
  { id: "shade", name: "그림자", color: "#a78bfa", speed: 84, power: 64, jump: 88 },
  {
    id: "redbat",
    name: "흡혈귀",
    color: "#ef233c",
    speed: 74,
    power: 86,
    jump: 76,
    asset: "assets/red-bat.png",
    sprites: {
      idle: "assets/red-bat.png",
      clawEffect: "assets/vampire-claw-effect.png",
      grab: "assets/vampire-grab.png",
      dash: "assets/vampire-bat-form.png",
      ult: "assets/vampire-ult.png",
      ultBurst: "assets/vampire-ult-burst.png"
    }
  }
];

const characterImages = new Map();
for (const character of characters) {
  if (!character.asset) continue;
  const image = new Image();
  image.src = character.asset;
  characterImages.set(character.id, image);

  if (!character.sprites) continue;
  for (const [spriteName, spritePath] of Object.entries(character.sprites)) {
    const sprite = new Image();
    sprite.src = spritePath;
    characterImages.set(`${character.id}:${spriteName}`, sprite);
  }
}

const keys = {
  left: false,
  right: false,
  jump: false,
  j: false,
  k: false,
  l: false,
  h: false
};

const keyMap = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowUp: "jump",
  KeyW: "jump",
  Space: "jump",
  KeyJ: "j",
  KeyK: "k",
  KeyL: "l",
  KeyH: "h"
};

const VIEW_SCALE = 0.62;
const PLAYER_WIDTH = 34;
const PLAYER_HEIGHT = 54;
const WORLD = { width: 3200, height: 900, floor: 808, gravity: 0.78, friction: 0.82, moveForce: 1.45, jump: -23.5, maxSpeed: 8.8 };
const PLATFORMS = [
  { x: 180, y: 666, w: 330, h: 24 },
  { x: 650, y: 560, w: 380, h: 24 },
  { x: 1160, y: 686, w: 330, h: 24 },
  { x: 1490, y: 500, w: 430, h: 24 },
  { x: 2070, y: 650, w: 370, h: 24 },
  { x: 2560, y: 548, w: 430, h: 24 },
  { x: 3000, y: 686, w: 220, h: 24 }
];
const ACTION_KEYS = ["j", "k", "l", "h"];
const RED_BAT_GRAB_DURATION = 180;
const RED_BAT_GRAB_MIN_COOLDOWN = 90;
const RED_BAT_GRAB_MAX_COOLDOWN = 420;
const RED_BAT_GRAB_DAMAGE_REDUCTION = 0.65;
const RED_BAT_DASH_DURATION = 42;
const RED_BAT_DASH_SPEED = 38;
const RED_BAT_ULT_AURA_RADIUS = 230;
const RED_BAT_ULT_BURST_RADIUS = 285;
const ROOM_PREFIX = "gaelegend-";
const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LOBBY_FLOAT_SPOTS = [
  { left: 9, top: 19, scale: 0.84, duration: 6.6, delay: -0.4, drift: 18, rotate: -8 },
  { left: 88, top: 22, scale: 0.76, duration: 7.4, delay: -1.8, drift: 22, rotate: 7 },
  { left: 11, top: 74, scale: 0.72, duration: 8.1, delay: -2.6, drift: 17, rotate: 5 },
  { left: 87, top: 80, scale: 0.9, duration: 7.1, delay: -0.9, drift: 24, rotate: -5 },
  { left: 70, top: 39, scale: 0.88, duration: 6.9, delay: -3.1, drift: 19, rotate: 9 },
  { left: 29, top: 12, scale: 0.62, duration: 7.8, delay: -1.2, drift: 15, rotate: -4 },
  { left: 45, top: 82, scale: 0.66, duration: 8.4, delay: -2.2, drift: 20, rotate: 6 },
  { left: 58, top: 15, scale: 0.6, duration: 7.6, delay: -3.4, drift: 16, rotate: -7 }
];

function createRoomCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join("");
}

function normalizeRoomCode(value) {
  return String(value).trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

function peerIdForRoom(code) {
  return `${ROOM_PREFIX}${code}`;
}

function setRoomCodeDisplay(code) {
  const value = code || "------";
  roomCodeDisplay.textContent = value;
  copyRoomCodeButton.disabled = !code;
}

async function copyRoomCode() {
  const code = normalizeRoomCode(roomCodeDisplay.textContent);
  if (!code || code === "------") return;

  try {
    await navigator.clipboard.writeText(code);
  } catch {
    const input = document.createElement("input");
    input.value = code;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }

  waitingStatus.textContent = `방 코드 ${code} 복사 완료`;
  copyRoomCodeButton.textContent = "완료";
  window.setTimeout(() => {
    copyRoomCodeButton.textContent = "복사";
  }, 900);
}

function resetNetwork() {
  for (const channel of peerChannels) channel.close();
  if (dataChannel && !peerChannels.has(dataChannel)) dataChannel.close();
  if (peerConnection) {
    if (typeof peerConnection.destroy === "function") peerConnection.destroy();
    else if (typeof peerConnection.close === "function") peerConnection.close();
  }
  dataChannel = null;
  peerChannels = new Set();
  peerConnection = null;
  hostState = null;
  hostInputs = {};
  peerInputs = {};
  gameStarted = false;
  nextGuestNumber = 1;
  setRoomCodeDisplay("");
}

function createPeer(peerId) {
  if (!window.Peer) throw new Error("PeerJS를 불러오지 못했습니다.");
  const peer = new window.Peer(peerId);
  peer.on("error", (error) => {
    const text = error.message || error.type || String(error);
    waitingStatus.textContent = `연결 오류: ${text}`;
    statusText.textContent = `연결 오류: ${text}`;
  });
  peer.on("disconnected", () => {
    waitingStatus.textContent = "연결이 끊겼습니다. 방을 다시 만들어 주세요.";
  });
  return peer;
}

function wireChannel(channel) {
  dataChannel = channel;
  peerChannels.add(channel);
  channel.on("open", () => {
    waitingStatus.textContent = "P2P 연결 완료. 방장이 게임 시작을 누르면 시작합니다.";
    if (networkRole === "guest") {
      myId = "guest";
      channel.send({ type: "join", name: nameInput.value || "플레이어", character: selectedCharacter });
    }
  });
  channel.on("data", (message) => handlePeerMessage(message, channel));
  channel.on("close", () => {
    peerChannels.delete(channel);
    if (networkRole === "host" && channel.playerId && hostState) {
      const removedPlayer = hostState.players.find((player) => player.id === channel.playerId);
      hostState.players = hostState.players.filter((player) => player.id !== channel.playerId);
      delete peerInputs[channel.playerId];
      if (removedPlayer) {
        if (!channel.wasKicked) waitingStatus.textContent = `${removedPlayer.name}님이 대기방을 나갔습니다.`;
        sendLobbyUpdate();
      }
      return;
    }
    waitingStatus.textContent = "P2P 연결이 끊겼습니다.";
  });
  channel.on("error", (error) => {
    waitingStatus.textContent = `연결 오류: ${error.message || error}`;
  });
}

async function createHostOffer() {
  resetNetwork();
  networkRole = "host";
  const code = createRoomCode();
  roomCodeInput.value = code;
  setRoomCodeDisplay(code);
  beginHostLobby();
  setRoomCodeDisplay(code);
  peerConnection = createPeer(peerIdForRoom(code));
  peerConnection.on("open", () => {
    waitingStatus.textContent = "방 코드가 만들어졌습니다. 친구에게 코드를 알려주세요.";
  });
  peerConnection.on("connection", (connection) => {
    wireChannel(connection);
  });
}

async function createGuestAnswer() {
  resetNetwork();
  networkRole = "guest";
  gameStarted = false;
  const code = normalizeRoomCode(roomCodeInput.value);
  if (!code) throw new Error("방 코드를 입력해 주세요.");
  roomCodeInput.value = code;
  setRoomCodeDisplay(code);
  state = { type: "state", world: WORLD, platforms: PLATFORMS, players: [] };
  showWaitingRoom();
  setRoomCodeDisplay(code);
  waitingStatus.textContent = "방에 접속하는 중입니다.";
  peerConnection = createPeer();
  peerConnection.on("open", () => {
    wireChannel(peerConnection.connect(peerIdForRoom(code), { reliable: true }));
  });
}

function normalizePeerMessage(message) {
  if (typeof message !== "string") return message || {};
  try {
    return JSON.parse(message);
  } catch {
    return {};
  }
}

function handlePeerMessage(rawMessage, channel = dataChannel) {
  const message = normalizePeerMessage(rawMessage);
  if (!message.type) return;

  if (message.type === "join" && networkRole === "host") {
    const playerId = channel.playerId || `guest${nextGuestNumber++}`;
    channel.playerId = playerId;
    addPlayer(playerId, message.name || "친구", message.character || "blaze");
    peerInputs[playerId] = {};
    announce(`${message.name || "친구"}님이 들어왔습니다`);
    sendToChannel(channel, { type: "joined", id: playerId });
    sendLobbyUpdate();
    return;
  }
  if (message.type === "joined") {
    myId = message.id;
    waitingStatus.textContent = "대기방에 입장했습니다. 방장이 시작할 때까지 기다리세요.";
    sendInput();
    return;
  }
  if (message.type === "lobby" && networkRole === "guest") {
    state = message.state;
    renderWaitingRoom();
    return;
  }
  if (message.type === "kick" && networkRole === "guest") {
    const reason = message.reason || "방장이 대기방에서 내보냈습니다.";
    resetNetwork();
    myId = null;
    state = { players: [], platforms: [], world: WORLD };
    roomCodeInput.value = "";
    showLobby();
    statusText.textContent = reason;
    return;
  }
  if (message.type === "character" && networkRole === "host") {
    const player = hostState?.players.find((candidate) => candidate.id === (message.id || "guest"));
    const character = getCharacter(message.character);
    if (player && character) {
      player.character = character.id;
      player.color = character.color;
      sendLobbyUpdate();
    }
    return;
  }
  if (message.type === "start" && networkRole === "guest") {
    gameStarted = true;
    state = message.state;
    showGameScreen();
    renderScoreboard();
    renderAbilityBar();
    sendInput();
    return;
  }
  if (message.type === "input" && networkRole === "host") {
    const playerId = channel?.playerId || message.id;
    if (playerId) {
      peerInputs[playerId] = message.input || {};
      const player = hostState?.players.find((candidate) => candidate.id === playerId);
      acceptPeerPrediction(player, message.position);
    }
    return;
  }
  if (message.type === "state" && networkRole === "guest") {
    state = message.state;
    renderScoreboard();
    renderAbilityBar();
    return;
  }
  if (message.type === "event") {
    latestEvent = message.text;
    eventUntil = performance.now() + 1800;
  }
}

function sendToChannel(channel, message) {
  if (!channel || typeof channel.send !== "function" || channel.open === false) return false;
  try {
    channel.send(message);
    return true;
  } catch {
    return false;
  }
}

function sendToPeer(message) {
  if (networkRole === "host") {
    for (const channel of peerChannels) sendToChannel(channel, message);
    return;
  }
  sendToChannel(dataChannel, message);
}

function showLobby() {
  selectScreen.classList.remove("isHidden");
  waitingRoom.classList.add("isHidden");
  gameScreen.classList.add("isHidden");
}

function showWaitingRoom() {
  selectScreen.classList.add("isHidden");
  waitingRoom.classList.remove("isHidden");
  gameScreen.classList.add("isHidden");
  renderWaitingRoom();
}

function showGameScreen() {
  selectScreen.classList.add("isHidden");
  waitingRoom.classList.add("isHidden");
  gameScreen.classList.remove("isHidden");
  camera.initialized = false;
}

function renderWaitingRoom() {
  const players = state.players || [];
  const isHost = networkRole === "host";
  waitingPlayers.innerHTML = players.length
    ? players.map((player) => {
      const character = getCharacter(player.character);
      const role = player.id === "host" ? "방장" : "참가자";
      const kickButton = isHost && player.id !== "host" && !gameStarted
        ? `<button class="kickPlayerButton" type="button" data-kick-player="${escapeHtml(player.id)}" aria-label="${escapeHtml(player.name)} 강퇴">강퇴</button>`
        : "";
      return `<div class="waitingPlayer"><div class="waitingPlayerInfo"><strong>${escapeHtml(player.name)}</strong><span>${role} · ${character?.name || "캐릭터"}</span></div>${kickButton}</div>`;
    }).join("")
    : `<div class="waitingPlayer"><strong>대기 중</strong><span>연결을 기다리는 중</span></div>`;

  startGameButton.hidden = !isHost;
  startGameButton.disabled = !isHost || players.length < 2 || gameStarted;
}

function kickWaitingPlayer(playerId) {
  if (networkRole !== "host" || !hostState || playerId === "host") return;
  const player = hostState.players.find((candidate) => candidate.id === playerId);
  if (!player) return;

  const channel = [...peerChannels].find((candidate) => candidate.playerId === playerId);
  if (channel) {
    channel.wasKicked = true;
    sendToChannel(channel, { type: "kick", reason: "방장이 대기방에서 내보냈습니다." });
    peerChannels.delete(channel);
    window.setTimeout(() => {
      if (typeof channel.close === "function") channel.close();
    }, 120);
  }

  hostState.players = hostState.players.filter((candidate) => candidate.id !== playerId);
  delete peerInputs[playerId];
  waitingStatus.textContent = `${player.name}님을 대기방에서 내보냈습니다.`;
  sendLobbyUpdate();
}

function sendLobbyUpdate() {
  if (networkRole !== "host" || !hostState) return;
  state = createStateSnapshot();
  renderWaitingRoom();
  sendToPeer({ type: "lobby", state });
}

function updateMyWaitingCharacter(characterId) {
  selectedCharacter = characterId;
  if (networkRole === "host" && hostState) {
    const me = hostState.players.find((player) => player.id === "host");
    if (me) {
      const character = getCharacter(characterId);
      me.character = character.id;
      me.color = character.color;
      sendLobbyUpdate();
    }
  } else if (networkRole === "guest") {
    sendToPeer({ type: "character", id: myId || "guest", character: characterId });
  }
}

function beginHostLobby() {
  myId = "host";
  networkRole = "host";
  gameStarted = false;
  hostState = { type: "state", world: WORLD, platforms: PLATFORMS, players: [] };
  addPlayer("host", nameInput.value || "플레이어", selectedCharacter);
  hostInputs = { host: keys };
  peerInputs = {};
  lastHostTick = performance.now();
  state = createStateSnapshot();
  waitingStatus.textContent = "방 코드를 친구에게 알려주고 대기하세요.";
  showWaitingRoom();
}

function startGameFromWaiting() {
  if (networkRole !== "host" || !hostState) return;
  if (hostState.players.length < 2) {
    waitingStatus.textContent = "친구가 들어오면 게임을 시작할 수 있습니다.";
    return;
  }
  gameStarted = true;
  camera.initialized = false;
  lastHostTick = performance.now();
  state = createStateSnapshot();
  showGameScreen();
  renderScoreboard();
  renderAbilityBar();
  sendToPeer({ type: "start", state });
}

function getSpawnPoint(index) {
  const offsets = [0, 240, -240, 480, -480, 720, -720, 960, -960];
  const offset = offsets[index % offsets.length] + Math.floor(index / offsets.length) * 120;
  return {
    x: clamp(WORLD.width / 2 + offset, 80, WORLD.width - PLAYER_WIDTH - 80),
    y: WORLD.floor - PLAYER_HEIGHT
  };
}

function addPlayer(id, name, characterId) {
  if (!hostState || hostState.players.some((player) => player.id === id)) return;
  const character = getCharacter(characterId) || characters[0];
  const index = hostState.players.length;
  const spawn = getSpawnPoint(index);
  hostState.players.push({
    id,
    name: String(name).trim().slice(0, 16) || `플레이어 ${index + 1}`,
    character: character.id,
    color: character.color,
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    w: PLAYER_WIDTH,
    h: PLAYER_HEIGHT,
    facing: 1,
    grounded: false,
    hp: 100,
    lives: 3,
    score: 0,
    attackCooldown: 0,
    attackTimer: 0,
    actionTotalTimer: 0,
    action: "",
    skillKCooldown: 0,
    skillLCooldown: 0,
    ultCooldown: 0,
    ultActiveTimer: 0,
    ultRecastReady: false,
    ultAuraTick: 0,
    rootTimer: 0,
    dotTimer: 0,
    dotTick: 0,
    dotOwner: null,
    damageReductionTimer: 0,
    grabTargetId: null,
    grabChannelTimer: 0,
    dashTimer: 0,
    dashHitIds: new Set(),
    previousButtons: {},
    respawnTimer: 0,
    lastHitBy: null
  });
}

function createStateSnapshot() {
  return {
    type: "state",
    world: WORLD,
    platforms: PLATFORMS,
    players: hostState.players.map((player) => ({
      id: player.id,
      name: player.name,
      character: player.character,
      color: player.color,
      x: player.x,
      y: player.y,
      w: player.w,
      h: player.h,
      vx: player.vx,
      vy: player.vy,
      facing: player.facing,
      grounded: player.grounded,
      hp: player.hp,
      lives: player.lives,
      attacking: player.attackTimer > 0,
      action: player.attackTimer > 0 ? player.action : "",
      actionTimer: player.attackTimer,
      actionTotal: player.actionTotalTimer,
      rooted: player.rootTimer > 0,
      grabbedBy: player.dotTimer > 0 ? player.dotOwner : null,
      guarding: player.damageReductionTimer > 0,
      damageReduction: player.damageReductionTimer > 0 ? RED_BAT_GRAB_DAMAGE_REDUCTION : 0,
      ultActive: player.ultActiveTimer > 0,
      ultRecastReady: player.ultRecastReady,
      ultRadius: player.character === "redbat" && player.ultActiveTimer > 0 ? RED_BAT_ULT_AURA_RADIUS : 0,
      cooldowns: {
        j: player.attackCooldown,
        k: player.skillKCooldown,
        l: player.skillLCooldown,
        h: player.ultActiveTimer <= 0 ? player.ultCooldown : 0
      },
      respawning: player.respawnTimer > 0,
      score: player.score
    }))
  };
}

function announce(text) {
  latestEvent = text;
  eventUntil = performance.now() + 1800;
  sendToPeer({ type: "event", text });
}

function collidePlatform(player, previousY) {
  player.grounded = false;
  if (player.y + player.h >= WORLD.floor) {
    player.y = WORLD.floor - player.h;
    player.vy = 0;
    player.grounded = true;
  }
  for (const platform of PLATFORMS) {
    const insideX = player.x + player.w > platform.x && player.x < platform.x + platform.w;
    const crossedTop = previousY + player.h <= platform.y && player.y + player.h >= platform.y;
    if (insideX && crossedTop && player.vy >= 0) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.grounded = true;
    }
  }
}

function healPlayer(player, amount) {
  if (amount <= 0 || player.respawnTimer > 0) return;
  player.hp = Math.min(100, player.hp + Math.round(amount));
}

function distanceBetween(a, b) {
  const ax = getPlayerCenterX(a);
  const ay = getPlayerCenterY(a);
  const bx = getPlayerCenterX(b);
  const by = getPlayerCenterY(b);
  return Math.hypot(ax - bx, ay - by);
}

function getPlayerCenterX(player) {
  return player.x + (player.w || PLAYER_WIDTH) / 2;
}

function getPlayerCenterY(player) {
  return player.y + (player.h || PLAYER_HEIGHT) / 2;
}

function applyDamage(attacker, target, damage, healRatio = 0, knockX = 0, knockY = 0) {
  if (attacker.id === target.id || target.respawnTimer > 0 || target.lives <= 0) return false;
  let actualDamage = damage;
  if (target.damageReductionTimer > 0) {
    actualDamage = Math.max(1, Math.round(damage * (1 - RED_BAT_GRAB_DAMAGE_REDUCTION)));
    knockX *= 0.2;
    knockY *= 0.2;
  }
  target.hp = Math.max(0, target.hp - actualDamage);
  target.vx += knockX;
  target.vy += knockY;
  target.lastHitBy = attacker.id;
  healPlayer(attacker, actualDamage * healRatio);
  if (target.hp <= 0) {
    const grabOwner = hostState.players.find((player) => player.grabTargetId === target.id);
    if (grabOwner) releaseGrabSkill(grabOwner);
    releaseGrabSkill(target);
    target.lives -= 1;
    target.respawnTimer = 90;
    target.rootTimer = 0;
    target.dotTimer = 0;
    target.dotOwner = null;
    target.damageReductionTimer = 0;
    attacker.score += 1;
    announce(`${attacker.name}님이 ${target.name}님을 격파했습니다`);
    return true;
  }
  return false;
}

function targetsInFront(attacker, reach, height) {
  const ax = getPlayerCenterX(attacker);
  const ay = getPlayerCenterY(attacker);
  return hostState.players.filter((target) => {
    if (target.id === attacker.id || target.respawnTimer > 0) return false;
    const tx = getPlayerCenterX(target);
    const ty = getPlayerCenterY(target);
    return (tx - ax) * attacker.facing > 0 && Math.abs(tx - ax) <= reach && Math.abs(ty - ay) <= height;
  });
}

function targetsInRadius(attacker, radius) {
  return hostState.players.filter((target) => (
    target.id !== attacker.id && target.respawnTimer <= 0 && distanceBetween(attacker, target) <= radius
  ));
}

function setAction(player, action, frames) {
  player.action = action;
  player.attackTimer = frames;
  player.actionTotalTimer = frames;
}

function clawAttack(attacker) {
  setAction(attacker, "claw", 16);
  attacker.attackCooldown = 22;
  for (const target of targetsInFront(attacker, 155, 78)) {
    applyDamage(attacker, target, 14, 0.35, attacker.facing * 7, -4);
  }
}

function getGrabCooldownFromUse(framesUsed) {
  const ratio = clamp(framesUsed / RED_BAT_GRAB_DURATION, 0, 1);
  return Math.round(RED_BAT_GRAB_MIN_COOLDOWN + (RED_BAT_GRAB_MAX_COOLDOWN - RED_BAT_GRAB_MIN_COOLDOWN) * ratio);
}

function releaseGrabSkill(attacker) {
  if (!attacker.grabTargetId) return;
  const framesUsed = RED_BAT_GRAB_DURATION - attacker.grabChannelTimer;
  const target = hostState.players.find((candidate) => candidate.id === attacker.grabTargetId);
  if (target?.dotOwner === attacker.id) {
    target.rootTimer = 0;
    target.dotTimer = 0;
    target.dotTick = 0;
    target.dotOwner = null;
  }
  attacker.rootTimer = 0;
  attacker.damageReductionTimer = 0;
  if (framesUsed > 0) attacker.skillKCooldown = Math.max(attacker.skillKCooldown, getGrabCooldownFromUse(framesUsed));
  attacker.grabTargetId = null;
  attacker.grabChannelTimer = 0;
  if (attacker.action === "grab") {
    attacker.action = "";
    attacker.attackTimer = 0;
    attacker.actionTotalTimer = 0;
  }
}

function grabSkill(attacker) {
  const targets = targetsInFront(attacker, 145, 95);
  if (!targets.length) {
    setAction(attacker, "grab", 8);
    attacker.skillKCooldown = RED_BAT_GRAB_MIN_COOLDOWN;
    return;
  }
  const target = targets.reduce((closest, candidate) => (
    distanceBetween(attacker, candidate) < distanceBetween(attacker, closest) ? candidate : closest
  ), targets[0]);
  setAction(attacker, "grab", RED_BAT_GRAB_DURATION);
  attacker.skillKCooldown = 0;
  attacker.rootTimer = RED_BAT_GRAB_DURATION;
  attacker.damageReductionTimer = RED_BAT_GRAB_DURATION;
  attacker.grabTargetId = target.id;
  attacker.grabChannelTimer = RED_BAT_GRAB_DURATION;
  attacker.vx = 0;
  target.rootTimer = RED_BAT_GRAB_DURATION;
  target.dotTimer = RED_BAT_GRAB_DURATION;
  target.dotTick = 1;
  target.dotOwner = attacker.id;
  target.x = clamp(attacker.x + attacker.facing * 58, 18, WORLD.width - target.w - 18);
  target.y = Math.min(target.y, attacker.y + 4);
  target.vx = 0;
  announce(`${attacker.name}님이 ${target.name}님을 붙잡았습니다`);
}

function dashSkill(player) {
  player.skillLCooldown = 300;
  player.dashTimer = RED_BAT_DASH_DURATION;
  player.dashHitIds.clear();
  setAction(player, "dash", RED_BAT_DASH_DURATION);
  player.vx = player.facing * RED_BAT_DASH_SPEED;
  player.vy = Math.min(player.vy, -2);
}

function activateUltimate(player) {
  player.ultCooldown = 900;
  player.ultActiveTimer = 480;
  player.ultRecastReady = true;
  player.ultAuraTick = 1;
  setAction(player, "ult", 22);
  announce(`${player.name}님의 피의 군림이 시작됐습니다`);
}

function recastUltimate(player) {
  player.ultRecastReady = false;
  setAction(player, "ultBurst", 18);
  let killed = false;
  for (const target of targetsInRadius(player, RED_BAT_ULT_BURST_RADIUS)) {
    killed = applyDamage(player, target, 34, 0.5, (target.x >= player.x ? 1 : -1) * 12, -7) || killed;
  }
  if (killed) {
    player.ultRecastReady = true;
    player.ultActiveTimer = Math.max(player.ultActiveTimer, 210);
    announce(`${player.name}님이 궁극기 재사용 기회를 얻었습니다`);
  }
}

function handleRedbatAction(player, button) {
  if (button === "j" && player.attackCooldown <= 0) clawAttack(player);
  else if (button === "k" && player.skillKCooldown <= 0) grabSkill(player);
  else if (button === "l" && player.skillLCooldown <= 0) dashSkill(player);
  else if (button === "h") {
    if (player.ultActiveTimer > 0 && player.ultRecastReady) recastUltimate(player);
    else if (player.ultActiveTimer <= 0 && player.ultCooldown <= 0) activateUltimate(player);
  }
}

function handleStandardAction(player, button) {
  if (button !== "j" || player.attackCooldown > 0) return;
  setAction(player, "basic", 11);
  player.attackCooldown = 28;
  for (const target of hostState.players) {
    const hitX = getPlayerCenterX(player) + player.facing * 46;
    const hitY = getPlayerCenterY(player);
    const insideX = target.x - 18 < hitX && hitX < target.x + target.w + 18;
    const insideY = target.y - 22 < hitY && hitY < target.y + target.h + 22;
    if (insideX && insideY) applyDamage(player, target, 18, 0, player.facing * 15, -9);
  }
}

function updateStatusEffects(player) {
  if (player.respawnTimer > 0 || player.lives <= 0) return;
  player.rootTimer = Math.max(0, player.rootTimer - 1);
  player.damageReductionTimer = Math.max(0, player.damageReductionTimer - 1);
  if (player.dotTimer > 0) {
    player.dotTimer -= 1;
    player.dotTick -= 1;
    if (player.dotTick <= 0) {
      player.dotTick = 15;
      const owner = hostState.players.find((candidate) => candidate.id === player.dotOwner);
      if (owner && owner.respawnTimer <= 0) applyDamage(owner, player, 4, 1.0);
    }
  }
  if (player.ultActiveTimer > 0) {
    player.ultActiveTimer -= 1;
    player.ultAuraTick -= 1;
    if (player.ultAuraTick <= 0) {
      player.ultAuraTick = 30;
      for (const target of targetsInRadius(player, RED_BAT_ULT_AURA_RADIUS)) applyDamage(player, target, 5, 0.7);
    }
    if (player.ultActiveTimer <= 0) player.ultRecastReady = false;
  }
  if (player.dashTimer > 0) {
    player.dashTimer -= 1;
    player.action = "dash";
    for (const target of targetsInRadius(player, 60)) {
      if (player.dashHitIds.has(target.id)) continue;
      player.dashHitIds.add(target.id);
      applyDamage(player, target, 26, 0.25, player.facing * 16, -6);
    }
  }
}

function updateHeldGrab(player, input) {
  if (!player.grabTargetId) return;
  const target = hostState.players.find((candidate) => candidate.id === player.grabTargetId);
  if (!input.k || player.grabChannelTimer <= 0 || player.respawnTimer > 0 || player.lives <= 0) {
    releaseGrabSkill(player);
    return;
  }
  if (!target || target.respawnTimer > 0 || target.lives <= 0 || target.dotOwner !== player.id) {
    releaseGrabSkill(player);
    return;
  }

  player.grabChannelTimer -= 1;
  if (player.grabChannelTimer <= 0) {
    releaseGrabSkill(player);
    return;
  }

  const remaining = player.grabChannelTimer;
  player.rootTimer = Math.max(player.rootTimer, remaining);
  player.damageReductionTimer = Math.max(player.damageReductionTimer, remaining);
  player.vx = 0;
  target.rootTimer = Math.max(target.rootTimer, remaining);
  target.dotTimer = Math.max(target.dotTimer, remaining);
  target.x = clamp(player.x + player.facing * 58, 18, WORLD.width - target.w - 18);
  target.y = Math.min(target.y, player.y + 4);
  target.vx = 0;
}

function acceptPeerPrediction(player, position) {
  if (!player || !position || player.rootTimer > 0 || player.respawnTimer > 0 || player.lives <= 0) return;
  const nextX = Number(position.x);
  const nextY = Number(position.y);
  if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) return;
  if (Math.abs(nextX - player.x) > 180 || Math.abs(nextY - player.y) > 180) return;

  player.x = clamp(nextX, 18, WORLD.width - player.w - 18);
  player.y = clamp(nextY, 0, WORLD.height + 80);
  player.vx = clamp(Number(position.vx) || 0, -RED_BAT_DASH_SPEED, RED_BAT_DASH_SPEED);
  player.vy = clamp(Number(position.vy) || 0, WORLD.jump * 1.2, 38);
  player.facing = position.facing === -1 ? -1 : 1;
  player.grounded = Boolean(position.grounded);
}

function updateGuestPrediction() {
  if (networkRole !== "guest" || !gameStarted || !myId) return;
  const player = state.players.find((candidate) => candidate.id === myId);
  if (!player || player.respawning || player.lives <= 0) return;

  player.w ||= PLAYER_WIDTH;
  player.h ||= PLAYER_HEIGHT;
  player.vx ||= 0;
  player.vy ||= 0;

  const rooted = player.rooted || player.grabbedBy;
  if (keys.left && !rooted) {
    player.vx -= WORLD.moveForce;
    player.facing = -1;
  }
  if (keys.right && !rooted) {
    player.vx += WORLD.moveForce;
    player.facing = 1;
  }
  if (keys.jump && player.grounded && !rooted) {
    player.vy = WORLD.jump;
    player.grounded = false;
  }

  player.vx = clamp(player.vx, -WORLD.maxSpeed, WORLD.maxSpeed);
  player.vy += WORLD.gravity;
  player.vx *= rooted ? 0.55 : WORLD.friction;
  const previousY = player.y;
  player.x += player.vx;
  player.y += player.vy;
  player.x = clamp(player.x, 18, WORLD.width - player.w - 18);
  collidePlatform(player, previousY);
}

function updateHostGame(now) {
  if (!hostState || networkRole !== "host" || !gameStarted) return;
  const dt = Math.min(2, (now - lastHostTick) / (1000 / 60));
  lastHostTick = now;
  hostInputs.host = keys;

  for (const player of hostState.players) {
    const input = player.id === "host" ? hostInputs.host : peerInputs[player.id] || {};
    if (player.grabTargetId && !input.k) releaseGrabSkill(player);
  }

  for (const player of hostState.players) {
    const input = player.id === "host" ? hostInputs.host : peerInputs[player.id] || {};
    updateStatusEffects(player);
    updateHeldGrab(player, input);
    if (player.respawnTimer > 0) {
      releaseGrabSkill(player);
      player.respawnTimer -= 1;
      if (player.respawnTimer <= 0 && player.lives > 0) {
        const index = hostState.players.findIndex((candidate) => candidate.id === player.id);
        const spawn = getSpawnPoint(index);
        player.x = spawn.x;
        player.y = spawn.y;
        player.vx = 0;
        player.vy = 0;
        player.hp = 100;
      }
      continue;
    }

    const rooted = player.rootTimer > 0;
    if (input.left && !rooted) {
      player.vx -= WORLD.moveForce;
      player.facing = -1;
    }
    if (input.right && !rooted) {
      player.vx += WORLD.moveForce;
      player.facing = 1;
    }
    if (input.jump && player.grounded && !rooted) {
      player.vy = WORLD.jump;
      player.grounded = false;
    }

    for (const button of ACTION_KEYS) {
      const pressed = Boolean(input[button]);
      const justPressed = pressed && !player.previousButtons[button];
      if (justPressed) {
        if (player.character === "redbat") handleRedbatAction(player, button);
        else handleStandardAction(player, button);
      }
      player.previousButtons[button] = pressed;
    }

    const dashing = player.dashTimer > 0;
    player.vx = clamp(player.vx, -WORLD.maxSpeed, WORLD.maxSpeed);
    if (dashing) player.vx = player.facing * RED_BAT_DASH_SPEED;
    player.vy += WORLD.gravity;
    if (!dashing) player.vx *= rooted ? 0.55 : WORLD.friction;
    const previousY = player.y;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.x = clamp(player.x, 18, WORLD.width - player.w - 18);
    collidePlatform(player, previousY);
    if (player.y > WORLD.height + 160) {
      player.hp = 0;
      player.lives -= 1;
      player.respawnTimer = 90;
      player.rootTimer = 0;
      player.dotTimer = 0;
      player.dotOwner = null;
      player.damageReductionTimer = 0;
      const scorer = hostState.players.find((candidate) => candidate.id === player.lastHitBy);
      if (scorer) scorer.score += 1;
    }

    player.attackCooldown = Math.max(0, player.attackCooldown - 1);
    player.skillKCooldown = Math.max(0, player.skillKCooldown - 1);
    player.skillLCooldown = Math.max(0, player.skillLCooldown - 1);
    player.ultCooldown = Math.max(0, player.ultCooldown - 1);
    player.attackTimer = Math.max(0, player.attackTimer - 1);
    if (player.attackTimer <= 0 && player.dashTimer <= 0) {
      player.action = "";
      player.actionTotalTimer = 0;
    }
  }

  state = createStateSnapshot();
  renderScoreboard();
  renderAbilityBar();
  if (now - lastBroadcast > 33) {
    sendToPeer({ type: "state", state });
    lastBroadcast = now;
  }
}

function formatCooldown(frames) {
  if (!frames || frames <= 0) return "준비";
  return `${Math.ceil(frames / 60)}초`;
}

function renderAbilityBar() {
  const me = state.players.find((player) => player.id === myId);
  if (!me) {
    abilityBar.innerHTML = "";
    return;
  }

  const cooldowns = me.cooldowns || {};
  const abilities = [
    { key: "J", name: "발톱", state: formatCooldown(cooldowns.j) },
    { key: "K", name: "흡혈 속박", state: me.guarding ? "피해 감소" : formatCooldown(cooldowns.k), active: Boolean(me.guarding) },
    { key: "L", name: "박쥐 돌진", state: formatCooldown(cooldowns.l) },
    {
      key: "H",
      name: "피의 군림",
      state: me.ultActive ? (me.ultRecastReady ? "재사용 가능" : "궁극기 중") : formatCooldown(cooldowns.h),
      active: Boolean(me.ultActive)
    }
  ];

  abilityBar.innerHTML = abilities
    .map((ability) => `
      <div class="abilityItem ${ability.state === "준비" ? "isReady" : ""} ${ability.active ? "isActive" : ""}">
        <strong>${ability.key} ${ability.name}</strong>
        <span>${ability.state}</span>
      </div>
    `)
    .join("");
}

function renderCharacterSelect() {
  characterGrid.innerHTML = characters
    .map((character) => `
      <button
        class="characterCard"
        type="button"
        data-character="${character.id}"
        aria-pressed="${character.id === selectedCharacter}"
        style="--fighter-color: ${character.color}"
      >
        <span class="fighterPreview">
          ${character.asset ? `<img class="fighterImage" src="${character.asset}" alt="" />` : `<span class="fighterBody"></span>`}
        </span>
        <span>
          <strong class="characterName">${character.name}</strong>
          <span class="characterStats">
            <span class="statBar" style="--stat: ${character.speed}%"><span>속도</span><span></span></span>
            <span class="statBar" style="--stat: ${character.power}%"><span>힘</span><span></span></span>
            <span class="statBar" style="--stat: ${character.jump}%"><span>점프</span><span></span></span>
          </span>
        </span>
      </button>
    `)
    .join("");
}

function renderLobbyFloaters() {
  if (!lobbyFloatLayer) return;
  lobbyFloatLayer.innerHTML = characters
    .map((character, index) => {
      const spot = LOBBY_FLOAT_SPOTS[index % LOBBY_FLOAT_SPOTS.length];
      const layer = Math.floor(index / LOBBY_FLOAT_SPOTS.length);
      const style = [
        `--fighter-color: ${character.color}`,
        `--float-left: ${spot.left + layer * 3}`,
        `--float-top: ${spot.top + (layer % 2) * 5}`,
        `--float-scale: ${Math.max(0.48, spot.scale - layer * 0.08)}`,
        `--float-duration: ${spot.duration + layer * 0.7}s`,
        `--float-delay: ${spot.delay - layer * 0.35}s`,
        `--float-drift: ${spot.drift}`,
        `--float-rotate: ${spot.rotate}deg`
      ].join("; ");
      const visual = character.asset
        ? `<img class="lobbyFloaterImage" src="${escapeHtml(character.asset)}" alt="" />`
        : `<span class="lobbyMiniFighter"><span class="lobbyMiniHead"></span><span class="lobbyMiniBody"></span></span>`;

      return `<span class="lobbyFloater" style="${style}" data-character="${escapeHtml(character.id)}">${visual}</span>`;
    })
    .join("");
}

function getCharacter(characterId) {
  return characters.find((character) => character.id === characterId);
}

function getCharacterSprite(character, player) {
  if (!character?.sprites) return character ? characterImages.get(character.id) : null;
  const spriteName = player.action === "claw" ? "idle" : player.action || (player.ultActive ? "ult" : "idle");
  return characterImages.get(`${character.id}:${spriteName}`) || characterImages.get(character.id);
}

function getSpriteImage(character, spriteName) {
  if (!character?.sprites) return null;
  return characterImages.get(`${character.id}:${spriteName}`);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

function getActionProgress(player) {
  if (!player.action || !player.actionTotal) return 0;
  return clamp(1 - (player.actionTimer || 0) / player.actionTotal, 0, 1);
}

function getClawMotion(progress, facing) {
  const slash = easeOutCubic(Math.min(progress / 0.74, 1));
  const settle = progress > 0.74 ? (progress - 0.74) / 0.26 : 0;
  return {
    x: facing * (-10 + 34 * slash - 9 * settle),
    y: -62 + 112 * slash - 18 * settle,
    scale: 1,
    angle: facing * (-0.08 + 0.18 * slash)
  };
}

function getSpriteMotion(player) {
  if (player.action !== "claw") return { x: 0, y: 0, scale: 1, angle: 0 };
  return getClawMotion(getActionProgress(player), player.facing);
}

function drawImageAtCenter(image, width, height) {
  ctx.drawImage(image, -width / 2, -height / 2 - 4, width, height);
}

function getPlayerSpriteHeight(character, player) {
  if (player.action === "ultBurst") return 160;
  if (player.action === "dash") return 78;
  if (player.action === "grab") return 150;
  if (character?.id === "redbat" && (player.action === "claw" || (!player.action && !player.ultActive))) return 58;
  if (player.action || player.ultActive) return 142;
  return 104;
}

function drawClawEffectSprite(character, progress, facing, opacity) {
  const image = getSpriteImage(character, "clawEffect");
  const motion = getClawMotion(progress, facing);
  const alpha = progress < 0.12 ? progress / 0.12 : progress > 0.78 ? (1 - progress) / 0.22 : 1;
  const flash = Math.sin(progress * Math.PI);
  const width = 78 + flash * 14;
  const height = 98 + flash * 18;

  ctx.save();
  ctx.translate(facing * 54 + motion.x * 0.72, motion.y - 12);
  ctx.rotate(motion.angle);
  if (facing > 0) ctx.scale(-1, 1);
  ctx.globalAlpha *= clamp(alpha, 0, 1) * opacity;

  if (image && image.complete && image.naturalWidth > 0) {
    for (let i = 3; i >= 1; i -= 1) {
      ctx.save();
      ctx.globalAlpha *= 0.12 * (4 - i);
      ctx.translate(0, -i * 8);
      ctx.rotate(-0.015 * i);
      drawImageAtCenter(image, width, height);
      ctx.restore();
    }
    drawImageAtCenter(image, width, height);
  } else {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(2, -2, 46, -0.9, 0.85);
    ctx.stroke();
    ctx.strokeStyle = "rgba(239,35,60,0.78)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(6, 2, 36, -0.9, 0.85);
    ctx.stroke();
  }
  ctx.restore();
}

function syncClawAfterimages() {
  const alivePlayerIds = new Set();
  for (const player of state.players) {
    alivePlayerIds.add(player.id);
    const currentTimer = player.action === "claw" ? player.actionTimer || 0 : 0;
    const previousTimer = lastClawTimers.get(player.id) || 0;
    if (currentTimer > 0 && (previousTimer <= 0 || currentTimer > previousTimer)) {
      clawAfterimages.push({
        characterId: player.character,
        x: getPlayerCenterX(player),
        y: getPlayerCenterY(player),
        facing: player.facing,
        createdAt: performance.now(),
        duration: 420
      });
    }
    lastClawTimers.set(player.id, currentTimer);
  }

  for (const playerId of lastClawTimers.keys()) {
    if (!alivePlayerIds.has(playerId)) lastClawTimers.delete(playerId);
  }
}

function drawClawAfterimages() {
  const now = performance.now();
  for (let i = clawAfterimages.length - 1; i >= 0; i -= 1) {
    const afterimage = clawAfterimages[i];
    const age = now - afterimage.createdAt;
    if (age > afterimage.duration) {
      clawAfterimages.splice(i, 1);
      continue;
    }

    const character = getCharacter(afterimage.characterId);
    const progress = clamp(age / 160, 0, 1);
    const fadeStart = 145;
    const opacity = age < fadeStart ? 1 : clamp(1 - (age - fadeStart) / (afterimage.duration - fadeStart), 0, 1);

    ctx.save();
    ctx.translate(afterimage.x, afterimage.y);
    drawClawEffectSprite(character, progress, afterimage.facing, opacity);
    ctx.restore();
  }
}

function drawGrabLinks() {
  for (const target of state.players) {
    if (!target.grabbedBy) continue;
    const owner = state.players.find((player) => player.id === target.grabbedBy);
    if (!owner) continue;

    const startX = getPlayerCenterX(owner) + owner.facing * 28;
    const startY = getPlayerCenterY(owner) + 6;
    const endX = getPlayerCenterX(target);
    const endY = getPlayerCenterY(target);
    const dx = endX - startX;
    const dy = endY - startY;
    const angle = Math.atan2(dy, dx);
    const length = Math.hypot(dx, dy);

    ctx.save();
    ctx.strokeStyle = "rgba(239, 35, 60, 0.86)";
    ctx.lineWidth = 6;
    ctx.setLineDash([12, 9]);
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    ctx.setLineDash([]);

    for (let offset = 18; offset < length; offset += 30) {
      ctx.save();
      ctx.translate(startX + Math.cos(angle) * offset, startY + Math.sin(angle) * offset);
      ctx.rotate(angle);
      ctx.strokeStyle = "rgba(255, 235, 235, 0.9)";
      ctx.lineWidth = 3;
      ctx.strokeRect(-7, -4, 14, 8);
      ctx.restore();
    }
    ctx.restore();
  }
}

function updateCamera() {
  const world = state.world || WORLD;
  const viewportWidth = canvas.width / VIEW_SCALE;
  const viewportHeight = canvas.height / VIEW_SCALE;
  const alivePlayers = state.players.filter((player) => !player.respawning && player.lives > 0);
  const focus = alivePlayers.find((player) => player.id === myId) || alivePlayers[0];
  const maxX = Math.max(0, world.width - viewportWidth);
  const maxY = Math.max(0, world.height - viewportHeight);

  let targetX = 0;
  let targetY = Math.max(0, world.floor - viewportHeight + 82);
  if (focus) {
    targetX = getPlayerCenterX(focus) - viewportWidth / 2;
    const airCameraY = getPlayerCenterY(focus) - viewportHeight * 0.48;
    targetY = Math.min(targetY, airCameraY);
  }

  targetX = clamp(targetX, 0, maxX);
  targetY = clamp(targetY, 0, maxY);

  if (!camera.initialized) {
    camera.x = targetX;
    camera.y = targetY;
    camera.initialized = true;
    return;
  }

  camera.x += (targetX - camera.x) * 0.28;
  camera.y += (targetY - camera.y) * 0.2;
}

function sendInput() {
  if (networkRole === "guest") {
    const me = myId ? state.players.find((player) => player.id === myId) : null;
    sendToPeer({
      type: "input",
      id: myId,
      input: { ...keys },
      position: me ? {
        x: me.x,
        y: me.y,
        vx: me.vx || 0,
        vy: me.vy || 0,
        facing: me.facing || 1,
        grounded: Boolean(me.grounded)
      } : null
    });
  }
}

function renderScoreboard() {
  scoreboard.innerHTML = state.players
    .map((player) => `
      <div class="scoreItem">
        <span class="dot" style="background:${player.color}"></span>
        <strong>${escapeHtml(player.name)} ${player.id === myId ? "(나)" : ""}</strong>
        <span>목숨 ${player.lives} 격파 ${player.score}</span>
      </div>
    `)
    .join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function drawArena() {
  const { width, height, floor } = state.world;
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#232937");
  sky.addColorStop(0.62, "#171b25");
  sky.addColorStop(1, "#101317");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.045)";
  for (let i = 0; i < Math.ceil(width / 36); i += 1) {
    const x = (i * 113 + 40) % width;
    const y = (i * 47 + 28) % 310;
    ctx.fillRect(x, y, 3, 3);
  }

  ctx.fillStyle = "#27303e";
  ctx.fillRect(0, floor, width, height - floor);
  ctx.fillStyle = "#4b5563";
  ctx.fillRect(0, floor, width, 7);
  ctx.fillStyle = "rgba(248,250,252,0.08)";
  for (let x = 0; x <= width; x += 160) ctx.fillRect(x, floor, 2, height - floor);

  for (const platform of state.platforms) {
    ctx.fillStyle = "#394253";
    ctx.fillRect(platform.x, platform.y, platform.w, platform.h);
    ctx.fillStyle = "#9ca3af";
    ctx.fillRect(platform.x, platform.y, platform.w, 5);
  }
}

function drawPlayer(player) {
  if (player.respawning || player.lives <= 0) {
    ctx.globalAlpha = 0.35;
  }

  const character = getCharacter(player.character);
  const characterImage = getCharacterSprite(character, player);

  ctx.save();
  const centerX = getPlayerCenterX(player);
  const centerY = getPlayerCenterY(player);
  ctx.translate(centerX, centerY);

  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(0, (player.h || PLAYER_HEIGHT) / 2 + 6, 23, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (player.ultActive) {
    const pulse = 1 + Math.sin(performance.now() / 140) * 0.08;
    const radius = player.ultRadius || 230;
    ctx.strokeStyle = "rgba(239, 35, 60, 0.48)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 245, 245, 0.24)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.72 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (characterImage && characterImage.complete && characterImage.naturalWidth > 0) {
    ctx.save();
    const motion = player.action === "claw" ? { x: 0, y: 0, scale: 1, angle: 0 } : getSpriteMotion(player);
    const shouldFlipSprite = player.facing > 0;
    ctx.translate(motion.x, motion.y);
    ctx.rotate(motion.angle);
    if (shouldFlipSprite) ctx.scale(-1, 1);
    ctx.shadowColor = "rgba(248, 250, 252, 0.62)";
    ctx.shadowBlur = 4;
    const spriteHeight = getPlayerSpriteHeight(character, player);
    const animatedHeight = spriteHeight * motion.scale;
    const spriteWidth = animatedHeight * characterImage.naturalWidth / characterImage.naturalHeight;

    if (player.action === "dash") {
      for (let i = 3; i >= 1; i -= 1) {
        ctx.save();
        ctx.globalAlpha *= 0.13 * (4 - i);
        ctx.translate(i * 28, i * 3);
        drawImageAtCenter(characterImage, spriteWidth, animatedHeight);
        ctx.restore();
      }
    }

    drawImageAtCenter(characterImage, spriteWidth, animatedHeight);
    ctx.restore();
  } else {
    ctx.fillStyle = player.color;
    ctx.fillRect(-15, -17, 30, 38);

    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(-11, -34, 22, 19);

    ctx.fillStyle = "#111827";
    ctx.fillRect(player.facing > 0 ? 4 : -8, -28, 4, 4);

    ctx.fillStyle = player.color;
    ctx.fillRect(-19, 18, 12, 19);
    ctx.fillRect(7, 18, 12, 19);
  }

  if (player.attacking) {
    if (player.action === "dash") {
      ctx.fillStyle = "rgba(239,35,60,0.42)";
      ctx.fillRect(player.facing > 0 ? -116 : -16, -19, 112, 32);
    } else if (player.action === "ultBurst") {
      ctx.strokeStyle = "rgba(248,250,252,0.8)";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, (player.ultRadius || 230) + 55, 0, Math.PI * 2);
      ctx.stroke();
    } else if (player.action === "grab") {
      ctx.strokeStyle = "rgba(239,35,60,0.88)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(player.facing > 0 ? 54 : -54, 4, 52, -0.4, Math.PI * 1.65);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,245,245,0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.facing > 0 ? 54 : -54, 4, 34, -0.4, Math.PI * 1.65);
      ctx.stroke();
    } else if (player.action !== "claw") {
      ctx.strokeStyle = "rgba(248,250,252,0.9)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(player.facing > 0 ? 55 : -55, -6, 31, -0.8, 0.9);
      ctx.stroke();
      ctx.strokeStyle = "rgba(239,35,60,0.75)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(player.facing > 0 ? 62 : -62, 3, 24, -0.8, 0.9);
      ctx.stroke();
    }
  }

  if (player.grabbedBy) {
    ctx.strokeStyle = "rgba(239,35,60,0.88)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 6, 48, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,245,245,0.78)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 6, 30, 0.2, Math.PI * 1.82);
    ctx.stroke();
  } else if (player.guarding) {
    const pulse = 1 + Math.sin(performance.now() / 110) * 0.08;
    ctx.strokeStyle = "rgba(255,245,245,0.88)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 4, 56 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = "rgba(239,35,60,0.7)";
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(0, 4, 42 * pulse, Math.PI * 0.15, Math.PI * 1.86);
    ctx.stroke();
  } else if (player.rooted) {
    ctx.strokeStyle = "rgba(168,85,247,0.82)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 4, 42, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(0,0,0,0.58)";
  ctx.fillRect(centerX - 24, player.y - 20, 48, 6);
  ctx.fillStyle = player.hp > 35 ? "#22c55e" : "#ef4444";
  ctx.fillRect(centerX - 24, player.y - 20, 48 * (player.hp / 100), 6);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "12px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(player.name, centerX, player.y - 27);
}

function drawEvent() {
  if (!latestEvent || performance.now() > eventUntil) return;
  ctx.fillStyle = "rgba(0,0,0,0.46)";
  ctx.fillRect(430, 34, 420, 42);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 20px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(latestEvent, 640, 62);
}

function loop() {
  updateGuestPrediction();
  syncClawAfterimages();
  updateCamera();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(VIEW_SCALE, VIEW_SCALE);
  ctx.translate(-camera.x, -camera.y);
  drawArena();
  drawGrabLinks();
  for (const player of state.players) drawPlayer(player);
  drawClawAfterimages();
  ctx.restore();
  drawEvent();
  requestAnimationFrame(loop);
}

hostButton.addEventListener("click", () => {
  createHostOffer().catch((error) => {
    showLobby();
    statusText.textContent = `방 만들기 실패: ${error.message}`;
  });
});

guestButton.addEventListener("click", () => {
  createGuestAnswer().catch((error) => {
    showLobby();
    statusText.textContent = `방 들어가기 실패: ${error.message}`;
  });
});

startGameButton.addEventListener("click", () => {
  startGameFromWaiting();
});

copyRoomCodeButton.addEventListener("click", () => {
  copyRoomCode();
});

waitingPlayers.addEventListener("click", (event) => {
  const button = event.target.closest("[data-kick-player]");
  if (!button) return;
  kickWaitingPlayer(button.dataset.kickPlayer);
});

backToLobbyButton.addEventListener("click", () => {
  resetNetwork();
  myId = null;
  state = { players: [], platforms: [], world: WORLD };
  roomCodeInput.value = "";
  showLobby();
});

characterGrid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-character]");
  if (!card) return;
  updateMyWaitingCharacter(card.dataset.character);
  renderCharacterSelect();
});

changeCharacterButton.addEventListener("click", () => {
  resetNetwork();
  myId = null;
  state = { players: [], platforms: [], world: WORLD };
  scoreboard.innerHTML = "";
  abilityBar.innerHTML = "";
  roomCodeInput.value = "";
  showLobby();
});

window.addEventListener("keydown", (event) => {
  const input = keyMap[event.code];
  if (!input) return;
  event.preventDefault();
  keys[input] = true;
  sendInput();
});

window.addEventListener("keyup", (event) => {
  const input = keyMap[event.code];
  if (!input) return;
  event.preventDefault();
  keys[input] = false;
  sendInput();
});

setInterval(() => updateHostGame(performance.now()), 1000 / 60);
setInterval(sendInput, 1000 / 30);
renderLobbyFloaters();
renderCharacterSelect();
loop();
