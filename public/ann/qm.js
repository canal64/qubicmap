/* qubicmap.org layer on top of dkat's bpp9k viewer (https://github.com/krypdkat/bpp9kviewer).
 * dkat's file is kept untouched in vendor/bpp9kviewer; this script only drives it from outside:
 * picks a featured network, opens its best leaf and starts "Visualize ANN" automatically,
 * shows plain-language progress, follows the replay live, and adds touch pan/zoom for phones.
 * It relies on globals of the viewer: run, treeData, ratingCmp, pathTo, selectKey, visualizeAnn,
 * annState, annRun, annGo, annCache, rootKey, annNet, view, applyView, annView, annApplyView,
 * showAnnView, EPOCH_TASK, ANN_LATEST. If one is missing (upstream changed), the page falls back
 * to the plain viewer and the daily sync test fails before such a version goes live. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var G = function (name) { try { return (0, eval)(name); } catch (e) { return undefined; } };
  var NEED = ["run", "buildTree", "ratingCmp", "pathTo", "selectKey", "visualizeAnn", "annGo", "annNet", "applyView", "annApplyView", "showAnnView", "EPOCH_TASK", "ANN_LATEST"];
  var missing = NEED.filter(function (n) { return G(n) === undefined; });
  document.documentElement.classList.add("qm");
  if (missing.length) { console.warn("qubicmap layer: viewer changed, missing", missing); document.documentElement.classList.add("qm-off"); return; }

  /* ---------- top bar ---------- */
  var bar = document.createElement("div");
  bar.id = "qmBar";
  bar.innerHTML =
    '<div class="qm-row">' +
      '<a class="qm-home" href="/" title="Qubic Ecosystem Map">← Map</a>' +
      '<h1>Qubic <span>ANN Explorer</span></h1>' +
      '<button type="button" id="qmAbout" aria-expanded="false">What am I looking at?</button>' +
      '<button type="button" id="qmAdv" aria-pressed="false" title="Show the full viewer controls (any identity, epoch, JSON)">Advanced</button>' +
    '</div>' +
    '<div class="qm-row qm-pick" id="qmPick"><b>Top miners</b><span id="qmPickEp" class="qm-dim">loading…</span></div>' +
    '<div id="qmExplain" hidden>' +
      '<p>Qubic miners don’t burn energy on useless hashes: they search for small artificial neural networks (64 neurons) for <b>Aigarth</b>. Every solution a miner publishes on-chain is one improvement step on its own network.</p>' +
      '<p>This page reads a top miner’s solutions straight from the Qubic chain, rebuilds the best network step by step in your browser, and checks every score against the chain. Nothing is simulated.</p>' +
      '<p class="qm-dim">Circles are neurons, lines are their links. Colour shows activity: <span class="qm-grad"></span> cold → hot. White ring = changed at this step. Tap a neuron for its links and table. Use ◀ ▶ or the slider to travel through the steps.</p>' +
    '</div>';
  document.body.insertBefore(bar, document.body.firstChild);

  var credit = document.createElement("div");
  credit.id = "qmCredit";
  credit.innerHTML = 'Viewer by <a href="https://github.com/krypdkat/bpp9kviewer" target="_blank" rel="noopener">dkat</a>, adapted for qubicmap.org with his permission · <a href="https://krypdkat.github.io/bpp9kviewer/" target="_blank" rel="noopener">original ↗</a>';
  document.body.appendChild(credit);

  $("qmAbout").onclick = function () { var e = $("qmExplain"); e.hidden = !e.hidden; this.setAttribute("aria-expanded", String(!e.hidden)); };
  $("qmAdv").onclick = function () { var on = document.documentElement.classList.toggle("qm-adv"); this.setAttribute("aria-pressed", String(on)); };

  /* ---------- progress pill ---------- */
  var pill = document.createElement("div");
  pill.id = "qmPill"; pill.hidden = true;
  pill.innerHTML = '<div id="qmPillT"></div><div class="qm-bar"><i id="qmPillB"></i></div>';
  $("left").appendChild(pill);
  var hideT = null;
  function say(text, frac, done) {
    clearTimeout(hideT);
    pill.hidden = false; pill.classList.toggle("ok", !!done);
    $("qmPillT").textContent = text;
    $("qmPillB").style.width = (frac == null ? 0 : Math.max(3, Math.min(100, frac * 100))) + "%";
    pill.querySelector(".qm-bar").hidden = frac == null;
    if (done) hideT = setTimeout(function () { pill.hidden = true; }, 7000);
  }

  /* ---------- state machine: scan -> pick best leaf -> replay (followed live) ---------- */
  var phase = "idle", follow = true, rate = null;
  function scanning() { return $("load").disabled; }

  function bestLeaf() {
    var t = G("treeData"); if (!t) return null;
    var cmp = G("ratingCmp"), pathTo = G("pathTo"), best = null;
    t.nodes.forEach(function (n) {
      if (!n.accepted || n.orphan) return;
      if (best && cmp(n, best) >= 0) return;
      var p = pathTo(n);
      if (!p.length || p.some(function (x) { return !x.accepted; })) return;
      best = n;
    });
    return best;
  }
  function startReplay() {
    var n = bestLeaf();
    if (!n) { phase = "idle"; say("No replayable network found for this miner in this epoch. Try another one.", null, true); return; }
    var ep = G("curEpoch");
    if (ep && !G("EPOCH_TASK")[ep.epoch]) {
      phase = "idle";
      say("A new epoch started and its mining task changed: the replay for epoch " + ep.epoch + " will be available once the viewer is updated (usually within a few days). The tree above is live.", null, false);
      return;
    }
    follow = true; phase = "replay";
    G("selectKey")(n.key, true);
    G("visualizeAnn")(n);
  }

  setInterval(function () {
    var st = ($("status").textContent || "");
    if (phase === "scan" || (phase === "idle" && scanning())) {
      phase = "scan";
      var m = st.match(/scanned (\d+)\/(\d+) tick windows, (\d+) solutions/);
      if (/^Error/.test(st)) { phase = "idle"; say("Couldn’t reach the Qubic node right now. Please try again in a minute.", null, false); return; }
      if (m) say("Reading this miner’s solutions from the Qubic chain (usually 1 to 5 min)… " + (+m[3]).toLocaleString("en") + " found", (+m[1] / Math.max(1, +m[2])) * 0.95);
      else if (scanning()) say("Connecting to the Qubic chain…", 0.02);
      if (!scanning()) { if (G("treeData")) startReplay(); else phase = "idle"; }
      return;
    }
    if (phase === "replay") {
      var s = G("annState"); if (!s) return;
      var total = s.path.length, done = s.done;
      var cached = G("annCache"), rk = G("rootKey");
      if (follow && done > 0 && s.step !== done && cached.has(rk())) G("annGo")(done);
      var a = $("annStatus"), at = a ? a.textContent : "";
      if (/MISMATCH/.test(at)) { say("Replay differs from the chain at one step: the viewer may need an update for this epoch.", done / total, false); return; }
      if (/^Replay error|^Error/.test(at)) { phase = "idle"; say("The replay stopped: " + at.replace(/^(Replay )?error:\s*/i, ""), null, false); return; }
      if (!G("annRun") && done >= total) {
        phase = "idle";
        if (follow) G("annGo")(total);
        say("✓ Network rebuilt from on-chain data: " + total + " steps, every score matches the chain.", 1, true);
        return;
      }
      if (done === 0) say(/Sampling/.test(at) ? at.replace("...", "…") : "Fetching the epoch seed from the chain…", 0.02);
      else {
        if (!rate || rate.total !== total || done < rate.d0) rate = { total: total, d0: done, t0: Date.now() };
        var per = done > rate.d0 ? (Date.now() - rate.t0) / (done - rate.d0) : 0, left = per ? Math.ceil(per * (total - done) / 60000) : 0;
        say("Rebuilding the network live: step " + done + " of " + total + (left ? " · about " + left + " min left" : "") + ". Watch it evolve, or explore it as it grows.", done / total);
      }
    }
  }, 400);

  // the user takes the controls: stop following the replay
  ["annPrev", "annNext", "annSlider"].forEach(function (id) {
    var e = $(id); if (e) ["pointerdown", "keydown"].forEach(function (ev) { e.addEventListener(ev, function () { follow = false; }); });
  });
  window.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft" || e.key === "ArrowRight") follow = false; });

  /* ---------- open a network ---------- */
  function openNet(id, epoch) {
    if (scanning()) return false;
    G("showAnnView")(false); // also cancels a running replay
    $("ident").value = id; $("epochIn").value = epoch || "";
    phase = "scan"; say("Connecting to the Qubic chain…", 0.02);
    G("run")(false);
    return true;
  }
  // a hash at load time is already being handled by the viewer's own auto-run
  var autoStarted = scanning();
  if (autoStarted) phase = "scan";

  /* ---------- featured networks ---------- */
  var pick = $("qmPick");
  function chips(j) {
    var L = (j && j.items) || [];
    if (!L.length) { $("qmPickEp").textContent = "none listed yet: use Advanced to enter an identity"; return; }
    $("qmPickEp").textContent = "best verified solutions · epoch " + j.epoch;
    L.slice(0, 5).forEach(function (n, i) {
      var b = document.createElement("button");
      b.type = "button"; b.title = n.id; b.setAttribute("aria-pressed", "false");
      b.innerHTML = "#" + (i + 1) + " <span>" + n.id.slice(0, 5) + "…</span>";
      b.onclick = function () {
        if (!openNet(n.id, n.epoch)) return;
        [].forEach.call(pick.querySelectorAll("button"), function (x) { x.setAttribute("aria-pressed", "false"); });
        b.setAttribute("aria-pressed", "true");
      };
      pick.appendChild(b);
      if (i === 0 && !autoStarted) b.click();
      if (autoStarted && location.hash.indexOf(n.id) === 1) b.setAttribute("aria-pressed", "true");
    });
  }
  function featured(ep) { return fetch("/api/ann/featured" + (ep ? "?epoch=" + ep : "")).then(function (r) { return r.json(); }); }
  featured().then(function (j) {
    // the viewer only replays epochs it carries the task for: fall back to its latest one
    if (j && j.epoch && !G("EPOCH_TASK")[j.epoch]) return featured(G("ANN_LATEST"));
    return j;
  }).then(chips).catch(function () { $("qmPickEp").textContent = "unavailable: use Advanced to enter an identity"; });

  /* ---------- touch: one finger pans, two fingers zoom (the viewer handles mouse only) ---------- */
  function touchPanZoom(svg, getV, apply, onStart) {
    if (!svg) return;
    var t0 = null;
    function pts(e) { var r = svg.getBoundingClientRect(); return [].map.call(e.touches, function (t) { return { x: t.clientX - r.left, y: t.clientY - r.top }; }); }
    svg.addEventListener("touchstart", function (e) {
      var v = getV(), p = pts(e); onStart();
      t0 = { p: p, x: v.x, y: v.y, k: v.k, moved: false };
    }, { passive: true });
    svg.addEventListener("touchmove", function (e) {
      if (!t0) return;
      var v = getV(), p = pts(e);
      if (p.length !== t0.p.length) { t0 = { p: p, x: v.x, y: v.y, k: v.k, moved: true }; return; }
      e.preventDefault(); t0.moved = true;
      if (p.length === 1) { v.x = t0.x + p[0].x - t0.p[0].x; v.y = t0.y + p[0].y - t0.p[0].y; }
      else if (p.length >= 2) {
        var d0 = Math.hypot(t0.p[0].x - t0.p[1].x, t0.p[0].y - t0.p[1].y) || 1, d1 = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        var c0 = { x: (t0.p[0].x + t0.p[1].x) / 2, y: (t0.p[0].y + t0.p[1].y) / 2 }, c1 = { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 };
        var f = d1 / d0; v.k = t0.k * f;
        v.x = c1.x - (c0.x - t0.x) * f; v.y = c1.y - (c0.y - t0.y) * f;
      }
      apply();
    }, { passive: false });
    svg.addEventListener("touchend", function (e) { if (!e.touches.length) t0 = null; });
  }
  touchPanZoom($("svg"), function () { return G("view"); }, function () { G("applyView")(); }, function () { try { (0, eval)("autoFit = false"); } catch (e) {} });
  touchPanZoom($("annSvg"), function () { return G("annView"); }, function () { G("annApplyView")(); }, function () { var v = G("annView"); if (v) v.auto = false; });

  /* ---------- phones: details panel as a collapsible sheet ---------- */
  var sheet = document.createElement("button");
  sheet.type = "button"; sheet.id = "qmSheet"; sheet.textContent = "Details ▴";
  sheet.onclick = function () { var on = document.documentElement.classList.toggle("qm-sheet"); sheet.textContent = on ? "Details ▾" : "Details ▴"; };
  $("right").parentNode.insertBefore(sheet, $("right"));
  // after layout changes, let the viewer refit
  var refit = function () { var v = G("annView"); if (v && v.auto && G("annFit")) G("annFit")(); };
  window.addEventListener("resize", refit);
  sheet.addEventListener("click", function () { setTimeout(refit, 60); });
})();
