/* ===== OpenPlayground · prototype logic ===== */
(function () {
  "use strict";

  /* --- Game data (real playable games in ./games/) --- */
  var GAMES = [
    { title: "스네이크", file: "games/snake.html", emoji: "🐍", genre: "캐주얼", cat: ["casual", "arcade"], desc: "최고 점수에 도전하는 클래식 뱀 게임. 키보드 화살표로 길을 잡으세요." },
    { title: "다이노 러너", file: "games/dino-runner.html", emoji: "🦖", genre: "아케이드", cat: ["arcade", "action"], desc: "장애물을 피하며 달리는 무한 점프 러너. 스페이스바로 점프!" },
    { title: "쿠키 점프", file: "games/cookiejump.html", emoji: "🍪", genre: "캐주얼", cat: ["casual", "arcade"], desc: "단받이 쿠키가 되어 구름 위로 높이 점프하는 귀여운 아케이드." },
    { title: "Super Jump", file: "games/superjump.html", emoji: "🦘", genre: "액션", cat: ["action", "arcade"], desc: "리듬감 있게 점프하며 코인을 모으는 스피디한 액션." },
    { title: "Super Tennis", file: "games/supertenis.html", emoji: "🎾", genre: "스포츠", cat: ["sports", "action"], desc: "브라우저에서 즐기는 가벼운 테니스 대전." },
    { title: "Vampire Survival", file: "games/vampire.html", emoji: "🧛", genre: "서바이벌", cat: ["survival", "action"], desc: "몰려오는 적을 피해 최대한 오래 버티는 생존 슈터." },
    { title: "로그라이크", file: "games/roguelike.html", emoji: "🗡️", genre: "로그라이크", cat: ["roguelike", "action"], desc: "매번 바뀌는 던전을 탐험하는 메트로바니아 플랫포머." }
  ];

  /* --- Render game cards --- */
  var grid = document.getElementById("games-grid");
  function render(filter) {
    grid.innerHTML = "";
    GAMES.forEach(function (g) {
      if (filter && filter !== "all" && g.cat.indexOf(filter) === -1) return;
      var card = document.createElement("article");
      card.className = "game-card reveal in";
      card.innerHTML =
        '<div class="game-thumb">' +
          '<span class="game-genre">' + g.genre + '</span>' +
          '<span class="game-emoji">' + g.emoji + '</span>' +
        '</div>' +
        '<div class="game-details">' +
          '<h3 class="game-title">' + g.title + '</h3>' +
          '<p class="game-desc">' + g.desc + '</p>' +
          '<button class="game-play" data-file="' + g.file + '" data-title="' + g.title + '">▶ 바로 플레이</button>' +
        '</div>';
      grid.appendChild(card);
    });
    bindPlay();
  }

  /* --- Play modal --- */
  var modal = document.getElementById("play-modal");
  var frame = document.getElementById("modal-frame");
  var modalTitle = document.getElementById("modal-title");
  function openModal(file, title) {
    modalTitle.textContent = title;
    frame.src = file;
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    frame.src = "about:blank";
    document.body.style.overflow = "";
  }
  function bindPlay() {
    var btns = grid.querySelectorAll(".game-play");
    btns.forEach(function (b) {
      b.addEventListener("click", function () {
        openModal(b.getAttribute("data-file"), b.getAttribute("data-title"));
      });
    });
  }
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("modal-backdrop").addEventListener("click", closeModal);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  /* --- Filters --- */
  var chips = document.querySelectorAll("#filter-bar .chip");
  chips.forEach(function (c) {
    c.addEventListener("click", function () {
      chips.forEach(function (x) { x.classList.remove("active"); });
      c.classList.add("active");
      render(c.getAttribute("data-filter"));
    });
  });

  /* --- Mobile menu --- */
  var toggle = document.getElementById("menu-toggle");
  var menu = document.getElementById("nav-menu");
  toggle.addEventListener("click", function () { menu.classList.toggle("open"); });
  menu.querySelectorAll("a").forEach(function (a) {
    a.addEventListener("click", function () { menu.classList.remove("open"); });
  });

  /* --- Reveal on scroll --- */
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });
  } else {
    document.querySelectorAll(".reveal").forEach(function (el) { el.classList.add("in"); });
  }

  /* --- Hero canvas: floating open-source particles --- */
  var canvas = document.getElementById("hero-canvas");
  var ctx = canvas.getContext("2d");
  var parts = [];
  function resize() {
    canvas.width = canvas.offsetWidth * devicePixelRatio;
    canvas.height = canvas.offsetHeight * devicePixelRatio;
  }
  function init() {
    resize();
    parts = [];
    var n = Math.min(60, Math.floor(canvas.width / 26));
    for (var i = 0; i < n; i++) {
      parts.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: (Math.random() * 2.4 + 1.2) * devicePixelRatio,
        vx: (Math.random() - 0.5) * 0.4 * devicePixelRatio,
        vy: (Math.random() - 0.5) * 0.4 * devicePixelRatio,
        c: Math.random() > 0.5 ? "#3ee0c0" : "#ff7a59"
      });
    }
  }
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c;
      ctx.globalAlpha = 0.7;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(tick);
  }
  window.addEventListener("resize", init);
  init();
  tick();

  /* --- init --- */
  render("all");
  document.getElementById("stat-games").textContent = GAMES.length;
})();
