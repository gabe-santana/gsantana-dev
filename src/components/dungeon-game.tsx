"use client";

import { Press_Start_2P } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { Bilingual } from "@/components/bilingual";
import { Chiptune } from "@/lib/chiptune";
import { format } from "@/lib/dictionaries";
import {
  CHESTS,
  COLS,
  generateRoom,
  H,
  pick,
  ROWS,
  SCALE,
  SHEET,
  SHEET_COLS,
  SPR,
  T,
  W,
  type Chest,
} from "@/lib/dungeon-map";
import { mediaUrl } from "@/lib/media";

// Pixel font for in-game text only (free Google Font, OFL license).
const pixelFont = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

// A tiny top-down, Zelda-like dungeon for the 404 page. Every play generates
// a new random room: walls, obstacles, enemies and chests. Wrong chests hold
// junk; one holds the URL the visitor asked for. One chest is a mimic.
// Art: "Tiny Dungeon" by Kenney (CC0), hosted on the media CDN.

const PLAYER_SPEED = 72; // logical px/s
const MAX_HP = 3;

const MIN_OPENED_BEFORE_WIN = 3; // the right chest is never among the first few
const SWING_TIME = 0.22;
const SWING_COOLDOWN = 0.32;
const HURT_TIME = 1;
const MAX_ENEMIES = 6;
const SPAWN_EVERY = 9;
const DIALOG_MIN_MS = 350; // ignore a key press that arrives right after a box opens
const MUTE_KEY = "gsantana:404-muted";

type Phase = "idle" | "playing" | "dialog" | "won" | "dead";
type Kind = "slime" | "bat" | "spider" | "mimic";
type Action = "up" | "down" | "left" | "right" | "shield";

interface Enemy {
  kind: Kind;
  x: number;
  y: number;
  hp: number;
  kx: number; // knockback velocity
  ky: number;
  t: number; // personal clock for movement patterns
}

interface Dialog {
  kind: "chest" | "mimic";
  index: number;
}

const STATS: Record<Kind, { speed: number; hp: number }> = {
  slime: { speed: 30, hp: 1 },
  bat: { speed: 50, hp: 1 },
  spider: { speed: 42, hp: 2 },
  mimic: { speed: 40, hp: 2 },
};

// A sheet sprite as a DOM element, for the message boxes.
function Sprite({ index, size = 36 }: { index: number; size?: number }) {
  const k = size / T;
  return (
    <span
      aria-hidden
      className="inline-block shrink-0 [image-rendering:pixelated]"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${mediaUrl(SHEET)})`,
        backgroundSize: `${SHEET_COLS * T * k}px auto`,
        backgroundPosition: `-${(index % SHEET_COLS) * T * k}px -${Math.floor(index / SHEET_COLS) * T * k}px`,
      }}
    />
  );
}

// RPG-style message box: gold pixel frame, pixel font, no white text.
function GameBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${pixelFont.className} game-dialog flex w-full max-w-md flex-col items-center gap-2.5 px-4 py-4 text-center text-[9px] leading-relaxed text-[#fde68a] sm:gap-3 sm:px-6 sm:py-5 sm:text-[11px]`}
    >
      {children}
    </div>
  );
}

function readMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function DungeonGame({
  chestMessageCount,
}: {
  chestMessageCount: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [path, setPath] = useState("/");
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<Chiptune | null>(null);
  const controls = useRef<{
    start: () => void;
    attack: () => void;
    cont: () => void;
    press: (action: Action, down: boolean) => void;
  } | null>(null);

  useEffect(() => {
    setPath(decodeURIComponent(window.location.pathname));
    setMuted(readMuted());
  }, []);

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    audioRef.current?.setMuted(next);
    try {
      localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked: the choice lasts until the page is closed.
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    canvas.width = W * SCALE;
    canvas.height = H * SCALE;

    const sheet = new Image();
    sheet.src = mediaUrl(SHEET);
    let sheetReady = false;
    sheet.onload = () => {
      sheetReady = true;
      renderMapLayer();
      draw();
    };

    const mapLayer = document.createElement("canvas");
    mapLayer.width = W * SCALE;
    mapLayer.height = H * SCALE;

    let phaseNow: Phase = "idle";
    let room = generateRoom();
    const held = new Set<Action>();
    let frame = 0;
    let last = 0;
    let dialogOpenedAt = 0;
    const audio = new Chiptune(readMuted());
    audioRef.current = audio;
    const effects: { x: number; y: number; t: number }[] = [];

    const player = {
      x: 0,
      y: 0,
      fx: 0,
      fy: 1,
      hp: MAX_HP,
      hurt: 0,
      swing: -1,
      cooldown: 0,
      kx: 0,
      ky: 0,
    };
    let enemies: Enemy[] = [];
    let opened = 0;
    let usedMessages: number[] = [];
    let spawnTimer = SPAWN_EVERY;

    function tile(
      ctx2: CanvasRenderingContext2D,
      index: number,
      x: number,
      y: number,
      flip = false,
    ) {
      const sx = (index % SHEET_COLS) * T;
      const sy = Math.floor(index / SHEET_COLS) * T;
      if (!flip) {
        ctx2.drawImage(sheet, sx, sy, T, T, x, y, T, T);
      } else {
        ctx2.save();
        ctx2.translate(x + T, y);
        ctx2.scale(-1, 1);
        ctx2.drawImage(sheet, sx, sy, T, T, 0, 0, T, T);
        ctx2.restore();
      }
    }

    // Floor, walls and obstacles never change during a round: draw them
    // once into an offscreen canvas and blit it every frame.
    function renderMapLayer() {
      const m = mapLayer.getContext("2d");
      if (!m) return;
      m.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      m.imageSmoothingEnabled = false;
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          if (sheetReady) {
            tile(m, room.ground[r]![c]!, c * T, r * T);
            if (room.sprite[r]![c]) tile(m, room.sprite[r]![c]!, c * T, r * T);
          } else {
            m.fillStyle = room.solid[r]![c] ? "#1e2433" : "#0d1119";
            m.fillRect(c * T, r * T, T, T);
          }
        }
      }
    }

    function isSolid(x: number, y: number) {
      const c = Math.floor(x / T);
      const r = Math.floor(y / T);
      if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
      if (room.solid[r]![c]) return true;
      return room.chests.some(
        (ch) => ch.c === c && ch.r === r && !(ch.mimic && ch.open),
      );
    }

    // Axis-separated movement against the tile grid; hitbox is 10x10.
    function move(e: { x: number; y: number }, dx: number, dy: number) {
      const h = 5;
      const blocked = (x: number, y: number) =>
        isSolid(x - h, y - h) ||
        isSolid(x + h - 0.01, y - h) ||
        isSolid(x - h, y + h - 0.01) ||
        isSolid(x + h - 0.01, y + h - 0.01);
      if (!blocked(e.x + dx, e.y)) e.x += dx;
      if (!blocked(e.x, e.y + dy)) e.y += dy;
    }

    function freeSpotAwayFromPlayer(minDistance: number) {
      const spots = room.reachable
        .map((key) => ({
          x: (key % COLS) * T + T / 2,
          y: Math.floor(key / COLS) * T + T / 2,
        }))
        .filter(
          (p) => Math.hypot(p.x - player.x, p.y - player.y) >= minDistance,
        );
      return spots.length ? pick(spots) : null;
    }

    function spawnEnemy() {
      const spot = freeSpotAwayFromPlayer(90);
      if (!spot) return;
      const kind = pick<Kind>(["slime", "slime", "bat", "spider"]);
      enemies.push({
        kind,
        ...spot,
        hp: STATS[kind].hp,
        kx: 0,
        ky: 0,
        t: Math.random() * 10,
      });
      effects.push({ ...spot, t: 0 });
    }

    function reset() {
      room = generateRoom();
      renderMapLayer();
      Object.assign(player, {
        x: room.start.c * T + T / 2,
        y: room.start.r * T + T / 2,
        fx: 1,
        fy: 0,
        hp: MAX_HP,
        hurt: 0,
        swing: -1,
        cooldown: 0,
        kx: 0,
        ky: 0,
      });
      enemies = [];
      effects.length = 0;
      opened = 0;
      usedMessages = [];
      spawnTimer = SPAWN_EVERY;
      for (let i = 0; i < 4; i++) spawnEnemy();
      held.clear();
    }

    // Chests pause the game and show a message box until the player
    // continues, with a jingle, like the item fanfare in classic RPGs.
    function openDialog(kind: Dialog["kind"], index = 0) {
      phaseNow = "dialog";
      dialogOpenedAt = performance.now();
      held.clear();
      cancelAnimationFrame(frame);
      frame = 0;
      draw();
      audio.stopMusic();
      if (kind === "mimic") audio.mimic();
      else audio.chest();
      setDialog({ kind, index });
      setPhase("dialog");
    }

    function continueGame() {
      if (
        phaseNow !== "dialog" ||
        performance.now() - dialogOpenedAt < DIALOG_MIN_MS
      )
        return;
      phaseNow = "playing";
      setDialog(null);
      setPhase("playing");
      audio.startMusic();
      last = 0;
      frame = requestAnimationFrame(loop);
    }

    function openChest(chest: Chest) {
      chest.open = true;
      effects.push({ x: chest.c * T + T / 2, y: chest.r * T + T / 2, t: 0 });

      if (chest.mimic) {
        enemies.push({
          kind: "mimic",
          x: chest.c * T + T / 2,
          y: chest.r * T + T / 2,
          hp: STATS.mimic.hp,
          kx: 0,
          ky: 0,
          t: 0,
        });
        openDialog("mimic");
        return;
      }

      const remaining = CHESTS - opened;
      opened++;
      // The right chest is random, but never among the first few opened.
      const found =
        remaining === 1 ||
        (opened > MIN_OPENED_BEFORE_WIN && Math.random() < 1 / remaining);
      if (found) {
        phaseNow = "won";
        held.clear();
        audio.stopMusic();
        audio.win();
        setPhase("won");
        return;
      }
      const unused = [...Array(chestMessageCount).keys()].filter(
        (i) => !usedMessages.includes(i),
      );
      const index = pick(
        unused.length ? unused : [...Array(chestMessageCount).keys()],
      );
      usedMessages.push(index);
      openDialog("chest", index);
    }

    function attack() {
      if (phaseNow !== "playing" || player.cooldown > 0) return;
      player.swing = 0;
      player.cooldown = SWING_COOLDOWN;
      audio.swing();

      // Opening: the tile right in front of the player.
      const c = Math.floor((player.x + player.fx * 12) / T);
      const r = Math.floor((player.y + player.fy * 12) / T);
      const chest = room.chests.find(
        (ch) => ch.c === c && ch.r === r && !ch.open,
      );
      if (chest) openChest(chest);

      // Hitting: a 16x16 box in front of the player.
      const hx = player.x + player.fx * 12;
      const hy = player.y + player.fy * 12;
      let hitSomething = false;
      for (const e of enemies) {
        if (Math.abs(e.x - hx) < 12 && Math.abs(e.y - hy) < 12) {
          hitSomething = true;
          e.hp--;
          e.kx = player.fx * 160;
          e.ky = player.fy * 160;
        }
      }
      if (hitSomething) audio.hit();
      const dead = enemies.filter((e) => e.hp <= 0);
      for (const e of dead) effects.push({ x: e.x, y: e.y, t: 0 });
      enemies = enemies.filter((e) => e.hp > 0);
    }

    function update(dt: number) {
      player.cooldown = Math.max(0, player.cooldown - dt);
      player.hurt = Math.max(0, player.hurt - dt);
      if (player.swing >= 0) {
        player.swing += dt;
        if (player.swing > SWING_TIME) player.swing = -1;
      }

      const shielding = held.has("shield");
      let dx = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
      let dy = (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0);
      if (dx || dy) {
        // Face the most recent axis of movement (4 directions, like Zelda).
        if (dx && !dy) [player.fx, player.fy] = [dx, 0];
        if (dy && !dx) [player.fx, player.fy] = [0, dy];
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
      }
      const speed = PLAYER_SPEED * (shielding ? 0.45 : 1);
      move(
        player,
        (dx * speed + player.kx) * dt,
        (dy * speed + player.ky) * dt,
      );
      player.kx *= Math.pow(0.001, dt);
      player.ky *= Math.pow(0.001, dt);

      for (const e of enemies) {
        e.t += dt;
        const vx = player.x - e.x;
        const vy = player.y - e.y;
        const dist = Math.hypot(vx, vy) || 1;
        let sp = STATS[e.kind].speed;
        let wobbleX = 0;
        let wobbleY = 0;
        if (e.kind === "slime" && e.t % 1 > 0.6) sp = 0; // hop, pause, hop
        if (e.kind === "bat") {
          wobbleX = Math.cos(e.t * 7) * 30;
          wobbleY = Math.sin(e.t * 9) * 30;
        }
        move(
          e,
          ((vx / dist) * sp + wobbleX + e.kx) * dt,
          ((vy / dist) * sp + wobbleY + e.ky) * dt,
        );
        e.kx *= Math.pow(0.001, dt);
        e.ky *= Math.pow(0.001, dt);

        if (dist < 11) {
          // A raised shield blocks anything coming from the side it faces.
          const facing = (vx * -player.fx + vy * -player.fy) / dist;
          if (shielding && facing > 0.3) {
            e.kx = (-vx / dist) * 220;
            e.ky = (-vy / dist) * 220;
          } else if (player.hurt === 0) {
            player.hp--;
            player.hurt = HURT_TIME;
            audio.hurt();
            player.kx = (-vx / dist) * 200;
            player.ky = (-vy / dist) * 200;
            e.kx = (vx / dist) * 120;
            e.ky = (vy / dist) * 120;
            if (player.hp <= 0) {
              phaseNow = "dead";
              held.clear();
              audio.stopMusic();
              audio.lose();
              setPhase("dead");
            }
          }
        }
      }

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        spawnTimer = SPAWN_EVERY;
        if (enemies.length < MAX_ENEMIES) spawnEnemy();
      }
      for (const fx of effects) fx.t += dt;
      while (effects.length && effects[0]!.t > 0.35) effects.shift();
    }

    function drawHeart(x: number, y: number, full: boolean) {
      const rows = [
        ".xx.xx.",
        "xxxxxxx",
        "xxxxxxx",
        ".xxxxx.",
        "..xxx..",
        "...x...",
      ];
      ctx!.fillStyle = full ? "#f87171" : "#4b5563";
      rows.forEach((row, ry) =>
        [...row].forEach((ch, rx) => {
          if (ch === "x") ctx!.fillRect(x + rx, y + ry, 1, 1);
        }),
      );
    }

    function draw() {
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.imageSmoothingEnabled = false;
      ctx!.drawImage(mapLayer, 0, 0);
      ctx!.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx!.imageSmoothingEnabled = false;
      if (!sheetReady) return;

      for (const ch of room.chests) {
        if (ch.mimic && ch.open) continue; // it walked off as an enemy
        tile(ctx!, ch.open ? SPR.chestOpen : SPR.chest, ch.c * T, ch.r * T);
      }

      for (const e of enemies) {
        const sprite = SPR[e.kind];
        const bob = e.kind === "bat" ? Math.sin(e.t * 12) * 1.5 : 0;
        tile(
          ctx!,
          sprite,
          Math.round(e.x - T / 2),
          Math.round(e.y - T / 2 + bob),
          player.x < e.x,
        );
      }

      // Player (blinks while invulnerable after a hit).
      const visible =
        player.hurt === 0 || Math.floor(player.hurt * 12) % 2 === 0;
      if (visible) {
        const px = Math.round(player.x - T / 2);
        const py = Math.round(player.y - T / 2);
        tile(ctx!, SPR.player, px, py, player.fx < 0);
        if (held.has("shield")) {
          tile(
            ctx!,
            SPR.shield,
            px + player.fx * 9,
            py + player.fy * 9 + (player.fy === 0 ? 2 : 0),
          );
        }
      }

      // Sword swing: rotates through a 90° arc in front of the player.
      if (player.swing >= 0) {
        const base = Math.atan2(player.fy, player.fx) + Math.PI / 2;
        const arc = (player.swing / SWING_TIME - 0.5) * (Math.PI / 2);
        ctx!.save();
        ctx!.translate(player.x, player.y);
        ctx!.rotate(base + arc);
        tile(ctx!, SPR.sword, -T / 2, -T - 4);
        ctx!.restore();
      }

      for (const fx of effects) {
        ctx!.strokeStyle = `rgba(243, 245, 248, ${1 - fx.t / 0.35})`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.arc(fx.x, fx.y, 3 + fx.t * 30, 0, Math.PI * 2);
        ctx!.stroke();
      }

      // HUD: hearts and chests found, on a dark panel so it stays readable
      // over the light brick wall (amber text, never white).
      ctx!.fillStyle = "rgba(5, 7, 13, 0.82)";
      ctx!.beginPath();
      if (typeof ctx!.roundRect === "function") ctx!.roundRect(2, 2, 66, 13, 3);
      else ctx!.rect(2, 2, 66, 13);
      ctx!.fill();
      for (let i = 0; i < MAX_HP; i++) drawHeart(5 + i * 9, 5, i < player.hp);
      ctx!.drawImage(
        sheet,
        (SPR.chest % SHEET_COLS) * T,
        Math.floor(SPR.chest / SHEET_COLS) * T,
        T,
        T,
        33,
        2.5,
        12,
        12,
      );
      ctx!.font = "8px monospace";
      ctx!.fillStyle = "#fde68a";
      ctx!.textBaseline = "middle";
      ctx!.fillText(`${opened}/${CHESTS}`, 47, 9);
    }

    function loop(now: number) {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 0;
      last = now;
      if (phaseNow === "playing") update(dt);
      draw();
      if (phaseNow === "playing") frame = requestAnimationFrame(loop);
    }

    function start() {
      reset();
      phaseNow = "playing";
      setPhase("playing");
      setDialog(null);
      audio.startMusic();
      last = 0;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(loop);
      canvas!.focus({ preventScroll: true });
    }

    const KEYS: Record<string, Action | "attack"> = {
      ArrowUp: "up",
      KeyW: "up",
      ArrowDown: "down",
      KeyS: "down",
      ArrowLeft: "left",
      KeyA: "left",
      ArrowRight: "right",
      KeyD: "right",
      KeyK: "shield",
      ShiftLeft: "shield",
      ShiftRight: "shield",
      KeyJ: "attack",
      Space: "attack",
      KeyE: "attack",
    };

    function onKeyDown(event: KeyboardEvent) {
      if (
        (event.target as HTMLElement | null)?.closest?.(
          "input, textarea, a, button",
        )
      )
        return;
      if (phaseNow === "dialog") {
        if (["Space", "Enter", "KeyJ", "KeyE"].includes(event.code)) {
          event.preventDefault();
          if (!event.repeat) continueGame();
        }
        return;
      }
      if (phaseNow !== "playing") {
        if (event.code === "Enter" && canvasInView()) {
          event.preventDefault();
          start();
        }
        return;
      }
      const action = KEYS[event.code];
      if (!action) return;
      event.preventDefault(); // arrows/space would scroll the page
      if (action === "attack") {
        if (!event.repeat) attack();
      } else {
        held.add(action);
      }
    }

    function onKeyUp(event: KeyboardEvent) {
      const action = KEYS[event.code];
      if (action && action !== "attack") held.delete(action);
    }

    function canvasInView() {
      const rect = canvas!.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    }

    function onVisibility() {
      if (document.hidden) audio.suspend();
      else audio.resume();
      if (phaseNow !== "playing") return;
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
        held.clear();
      } else if (!frame) {
        last = 0;
        frame = requestAnimationFrame(loop);
      }
    }

    controls.current = {
      start,
      attack,
      cont: continueGame,
      press: (action, down) => {
        if (down) held.add(action);
        else held.delete(action);
      },
    };

    renderMapLayer();
    draw();
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    const onBlur = () => held.clear();
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      audio.dispose();
      audioRef.current = null;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [chestMessageCount]);

  const hold = (action: Action) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      controls.current?.press(action, true);
    },
    onPointerUp: () => controls.current?.press(action, false),
    onPointerLeave: () => controls.current?.press(action, false),
    onPointerCancel: () => controls.current?.press(action, false),
  });

  const padButton =
    "flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface text-lg text-[#fde68a] active:bg-accent active:text-background";

  return (
    <div className="w-full select-none">
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface">
        <canvas
          ref={canvasRef}
          tabIndex={-1}
          aria-hidden
          className="block aspect-[5/3] w-full outline-none [image-rendering:pixelated]"
        />

        {phase === "dialog" && dialog ? (
          <div
            role="dialog"
            aria-live="assertive"
            onPointerDown={() => controls.current?.cont()}
            className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/35 p-3 sm:p-6"
          >
            <GameBox>
              <Sprite
                index={dialog.kind === "mimic" ? SPR.mimic : SPR.chestOpen}
              />
              <p className="text-[#fcd34d]">
                <Bilingual
                  pick={(d) =>
                    dialog.kind === "mimic"
                      ? d.notFound.game.mimicTitle
                      : d.notFound.game.chestTitle
                  }
                />
              </p>
              <p>
                <Bilingual
                  pick={(d) =>
                    dialog.kind === "mimic"
                      ? d.notFound.game.mimic
                      : (d.notFound.game.chests[dialog.index] ?? "")
                  }
                />
              </p>
              <p className="pixel-blink text-accent">
                ▼ <Bilingual pick={(d) => d.notFound.game.continue} />
              </p>
            </GameBox>
          </div>
        ) : null}

        {phase === "idle" || phase === "won" || phase === "dead" ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/45 p-3 sm:p-6">
            <GameBox>
              <Sprite
                index={
                  phase === "dead"
                    ? 64
                    : phase === "won"
                      ? SPR.chestOpen
                      : SPR.player
                }
              />
              {phase === "won" ? (
                <>
                  <p className="break-all text-[#fcd34d]">
                    <Bilingual
                      pick={(d) => format(d.notFound.game.winTitle, { path })}
                    />
                  </p>
                  <p>
                    <Bilingual pick={(d) => d.notFound.game.winBody} />
                  </p>
                </>
              ) : phase === "dead" ? (
                <p className="text-[#fca5a5]">
                  <Bilingual pick={(d) => d.notFound.game.gameOver} />
                </p>
              ) : (
                <p>
                  <Bilingual pick={(d) => d.notFound.game.hint} />
                </p>
              )}
              <button
                type="button"
                onClick={() => controls.current?.start()}
                className="mt-1 bg-[#e2b95b] px-4 py-2 text-[#10131f] shadow-[0_3px_0_#8a6a2a] transition-transform hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
              >
                {phase === "idle" ? (
                  <Bilingual pick={(d) => d.notFound.game.start} />
                ) : (
                  <Bilingual pick={(d) => d.notFound.game.playAgain} />
                )}
              </button>
            </GameBox>
          </div>
        ) : null}

        <button
          type="button"
          onClick={toggleMute}
          // Keep focus off the button, or Space (attack) would toggle it.
          onPointerDown={(e) => e.preventDefault()}
          aria-pressed={muted}
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md bg-[#05070d]/80 text-[#fde68a] transition-colors hover:text-accent"
        >
          <span className="sr-only">
            <Bilingual
              pick={(d) =>
                muted ? d.notFound.game.unmute : d.notFound.game.mute
              }
            />
          </span>
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2.5 6h2.5l3.5-3v10L5 10H2.5z" fill="currentColor" />
            {muted ? (
              <path d="m11 6 3.5 4m0-4L11 10" />
            ) : (
              <path d="M11 5.5a3.5 3.5 0 0 1 0 5M12.8 3.8a6 6 0 0 1 0 8.4" />
            )}
          </svg>
        </button>
      </div>

      {/* Touch controls: only on devices whose main pointer is a finger. */}
      <div className="mt-4 hidden items-center justify-between [@media(pointer:coarse)]:flex">
        <div className="grid grid-cols-3 gap-1.5" aria-hidden>
          <span />
          <button type="button" className={padButton} {...hold("up")}>
            ▲
          </button>
          <span />
          <button type="button" className={padButton} {...hold("left")}>
            ◀
          </button>
          <span />
          <button type="button" className={padButton} {...hold("right")}>
            ▶
          </button>
          <span />
          <button type="button" className={padButton} {...hold("down")}>
            ▼
          </button>
          <span />
        </div>
        <div className="flex items-end gap-3">
          <button
            type="button"
            className={`${padButton} h-14 w-14 text-sm`}
            {...hold("shield")}
          >
            <Bilingual pick={(d) => d.notFound.game.shield} />
          </button>
          <button
            type="button"
            className={`${padButton} h-16 w-16 text-xs`}
            onPointerDown={(e) => {
              e.preventDefault();
              controls.current?.attack();
            }}
          >
            <Bilingual pick={(d) => d.notFound.game.attack} />
          </button>
        </div>
      </div>

      <p className="mt-3 hidden text-xs text-muted [@media(pointer:fine)]:block">
        <Bilingual pick={(d) => d.notFound.game.controls} />
      </p>
      <p className="mt-1 text-[10px] text-muted/60">
        <Bilingual pick={(d) => d.notFound.game.credit} />
      </p>
    </div>
  );
}
