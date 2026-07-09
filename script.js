const plant = document.getElementById("plant");
const plantArea = document.getElementById("plantArea");
const sparkles = document.getElementById("sparkles");
const message = document.getElementById("message");
const growthText = document.getElementById("growthText");
const moodText = document.getElementById("moodText");
const visitText = document.getElementById("visitText");
const cat = document.getElementById("cat");

const waterBtn = document.getElementById("waterBtn");
const sunBtn = document.getElementById("sunBtn");
const catBtn = document.getElementById("catBtn");
const resetBtn = document.getElementById("resetBtn");

const stages = [
  { score: 0, emoji: "🌱", name: "새싹" },
  { score: 4, emoji: "🌿", name: "잎사귀" },
  { score: 9, emoji: "🌷", name: "꽃봉오리" },
  { score: 15, emoji: "🌸", name: "활짝 핀 꽃" },
  { score: 24, emoji: "🌳", name: "작은 나무" },
  { score: 36, emoji: "🌻", name: "햇살 정원" }
];

const messages = [
  "잠깐 쉬어가도 괜찮아.",
  "오늘의 너도 충분히 귀여운 존재야.",
  "작은 물방울 하나가 정원을 바꿔.",
  "천천히 자라도 괜찮아. 자라고 있는 중이니까.",
  "구름도 쉬어가고, 너도 쉬어가자.",
  "마음이 말랑해지는 중...",
  "오늘은 조금 덜 완벽해도 괜찮아.",
  "정원이 너를 기다리고 있었어."
];

const moods = ["말랑", "포근", "반짝", "몽글", "햇살", "평온", "두근"];

const today = new Date().toDateString();
const saved = JSON.parse(localStorage.getItem("tinyGarden") || "null");
let state = saved || {
  score: 0,
  moodIndex: 0,
  firstVisit: today,
  visits: 1,
  lastVisit: today
};

if (state.lastVisit !== today) {
  state.visits += 1;
  state.lastVisit = today;
  state.score += 1;
  save();
}

function save() {
  localStorage.setItem("tinyGarden", JSON.stringify(state));
}

function getStage() {
  return stages.reduce((current, stage) => {
    return state.score >= stage.score ? stage : current;
  }, stages[0]);
}

function render() {
  const stage = getStage();
  plant.textContent = stage.emoji;
  growthText.textContent = stage.name;
  moodText.textContent = moods[state.moodIndex % moods.length];
  visitText.textContent = `${state.visits}일째`;
}

function randomMessage(prefix = "") {
  const text = messages[Math.floor(Math.random() * messages.length)];
  message.textContent = prefix ? `${prefix} ${text}` : text;
}

function addSparkle(emoji = "✨") {
  const item = document.createElement("span");
  item.className = "sparkle";
  item.textContent = emoji;
  item.style.left = `${35 + Math.random() * 30}%`;
  item.style.top = `${25 + Math.random() * 32}%`;
  sparkles.appendChild(item);
  setTimeout(() => item.remove(), 1000);
}

function happyPlant() {
  plant.classList.add("happy");
  setTimeout(() => plant.classList.remove("happy"), 450);
}

function grow(amount, emoji, prefix) {
  state.score += amount;
  state.moodIndex += 1;
  save();
  render();
  happyPlant();
  addSparkle(emoji);
  randomMessage(prefix);
}

waterBtn.addEventListener("click", () => {
  grow(1, "💧", "촉촉해졌어.");
});

sunBtn.addEventListener("click", () => {
  grow(1, "☀️", "따뜻해졌어.");
});

catBtn.addEventListener("click", () => {
  cat.classList.add("show", "jump");
  addSparkle("💗");
  randomMessage("고양이가 놀러왔어.");
  state.moodIndex += 1;
  save();
  render();
  setTimeout(() => cat.classList.remove("jump"), 500);
  setTimeout(() => cat.classList.remove("show"), 3600);
});

plantArea.addEventListener("click", () => {
  addSparkle(Math.random() > 0.5 ? "✨" : "🌼");
  happyPlant();
});

resetBtn.addEventListener("click", () => {
  const ok = confirm("정원을 처음부터 다시 키울까?");
  if (!ok) return;
  state = {
    score: 0,
    moodIndex: 0,
    firstVisit: today,
    visits: 1,
    lastVisit: today
  };
  save();
  render();
  message.textContent = "새 정원이 시작됐어.";
});

render();
randomMessage();
setInterval(() => addSparkle(Math.random() > 0.55 ? "✨" : "🍃"), 4200);
