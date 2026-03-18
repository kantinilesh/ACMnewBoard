import { useEffect, useRef, useState, useCallback } from "react";


// ─── useLoaderAudio ───────────────────────────────────────────────────────────
//
// DESIGN:
//   • AudioContext is created ONLY inside startAudio(), which is called from a
//     guaranteed user-gesture handler (the "PRESS START" splash click/tap).
//     This satisfies autoplay policy on ALL browsers including iOS Safari.
//   • A lookahead scheduler (setInterval every 80 ms, schedules 300 ms ahead)
//     drives a truly infinite arpeggio loop — it never runs out of notes.
//   • stop() is NEVER called by the page itself; music runs forever.
//     Only the mute toggle (setMute) silences/restores volume.
//   • stop() exists for emergency cleanup (unmount).

type Note = [number, number, number, number, OscillatorType];

// One-shot fanfare: chromatic run → chord stab → high sting
const FANFARE: Note[] = [
  [185, 0.00, 0.07, 0.18, "square"],
  [220, 0.07, 0.07, 0.18, "square"],
  [277, 0.14, 0.07, 0.18, "square"],
  [370, 0.21, 0.14, 0.20, "square"],
  [440, 0.21, 0.14, 0.18, "square"],
  [554, 0.21, 0.14, 0.16, "square"],
  [370, 0.38, 0.28, 0.20, "square"],
  [494, 0.38, 0.28, 0.18, "square"],
  [587, 0.38, 0.28, 0.16, "square"],
  [880, 0.70, 0.10, 0.15, "square"],
  [988, 0.80, 0.10, 0.15, "square"],
  [1109, 0.90, 0.16, 0.14, "square"],
];
const FANFARE_DURATION = 1.1;

// Infinite battle arpeggio — 32 steps × 0.08 s = 2.56 s per loop
const ARP_STEP = 0.08;
const ARP_PATTERN = [
  220, 277, 330, 415, 370, 330, 277, 220,
  185, 220, 277, 330, 277, 220, 185, 165,
  220, 294, 370, 440, 415, 370, 294, 220,
  185, 247, 330, 392, 370, 330, 247, 220,
];

function useLoaderAudio() {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nextRef = useRef(0);   // next note time on AudioContext clock
  const phaseRef = useRef(0);   // index into ARP_PATTERN (wraps mod length)
  const stoppedRef = useRef(true);
  const fadeTRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleNote = (
    ctx: AudioContext, master: GainNode,
    freq: number, t: number, dur: number, vol: number, type: OscillatorType
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + 0.010);
    gain.gain.setValueAtTime(vol, t + dur * 0.55);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  // Lookahead tick — runs every 80 ms, schedules notes 300 ms ahead
  const tick = useCallback(() => {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master || stoppedRef.current) return;
    const AHEAD = 0.30;
    while (nextRef.current < ctx.currentTime + AHEAD) {
      const t = nextRef.current;
      const freq = ARP_PATTERN[phaseRef.current % ARP_PATTERN.length];
      scheduleNote(ctx, master, freq, t, ARP_STEP * 0.75, 0.15, "square");
      scheduleNote(ctx, master, freq / 2, t, ARP_STEP * 0.60, 0.07, "triangle");
      phaseRef.current++;
      nextRef.current += ARP_STEP;
    }
  }, []);

  // startAudio — MUST be called from inside a user-gesture handler
  const startAudio = useCallback(() => {
    if (!stoppedRef.current) return; // already running
    try {
      stoppedRef.current = false;
      phaseRef.current = 0;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      ctx.resume(); // wake up suspended state (Safari quirk)

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.50, ctx.currentTime);
      master.connect(ctx.destination);

      ctxRef.current = ctx;
      masterRef.current = master;

      const t0 = ctx.currentTime + 0.02;

      // Play fanfare once
      FANFARE.forEach(([freq, offset, dur, vol, type]) =>
        scheduleNote(ctx, master, freq, t0 + offset, dur, vol, type)
      );

      // Noise-crack accent at very start
      const nLen = (ctx.sampleRate * 0.045) | 0;
      const nBuf = ctx.createBuffer(1, nLen, ctx.sampleRate);
      const nd = nBuf.getChannelData(0);
      for (let i = 0; i < nLen; i++) nd[i] = (Math.random() * 2 - 1) * 0.35;
      const ns = ctx.createBufferSource();
      ns.buffer = nBuf;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.45, t0);
      ng.gain.linearRampToValueAtTime(0, t0 + 0.045);
      ns.connect(ng); ng.connect(master);
      ns.start(t0);

      // Arpeggio starts after fanfare
      nextRef.current = t0 + FANFARE_DURATION;
      tick();
      timerRef.current = setInterval(tick, 80);

    } catch (e) {
      console.warn("PokeAudio start failed:", e);
      stoppedRef.current = true;
    }
  }, [tick]);

  // stopAudio — fade out and close (for cleanup only)
  const stopAudio = useCallback(() => {
    stoppedRef.current = true;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.7);
    fadeTRef.current = setTimeout(() => {
      try { ctx.close(); } catch (_) { }
      ctxRef.current = null; masterRef.current = null;
    }, 800);
  }, []);

  // setMute — toggle volume without stopping the scheduler
  const setMute = useCallback((muted: boolean) => {
    const master = masterRef.current;
    const ctx = ctxRef.current;
    if (!master || !ctx) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(muted ? 0 : 0.50, now + 0.18);
  }, []);

  // Cleanup on component unmount
  useEffect(() => () => {
    stoppedRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (fadeTRef.current) clearTimeout(fadeTRef.current);
    try { ctxRef.current?.close(); } catch (_) { }
  }, []);

  return { startAudio, stopAudio, setMute };
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const BOARD = [
  { name: "Chakshu Sharma", role: "Chair", pokemon: 6, type1: "fire", type2: "flying", ability: "Leads with Blaze", hp: 98 },
  { name: "Krishna Keshab Banik", role: "Vice Chair", pokemon: 149, type1: "dragon", type2: null, ability: "Hyper Drive Strategy", hp: 91 },
  { name: "Dhriti Kothari Jain", role: "Treasurer", pokemon: 36, type1: "normal", type2: "fairy", ability: "Golden Ratio Finance", hp: 85 },
  { name: "Ishita Chaurasia", role: "Secretary", pokemon: 196, type1: "psychic", type2: null, ability: "Mind Archive", hp: 88 },
  { name: "Salil Vaidya", role: "Membership Chair", pokemon: 131, type1: "water", type2: "ice", ability: "Community Hydration", hp: 87 },
  { name: "Ojas Mutreja", role: "Webmaster", pokemon: 137, type1: "normal", type2: null, ability: "Digital Evolution", hp: 84 },
];

const CORE = [
  { name: "Palak Maheshwari", role: "Corporate Head", pokemon: 130, type1: "water", type2: "flying", ability: "Corporate Typhoon", hp: 90 },
  { name: "Ishan Bakshi", role: "Corporate Lead", pokemon: 448, type1: "fighting", type2: "steel", ability: "Iron Business Fist", hp: 82 },
  { name: "Jahnavi Kishore", role: "Web Dev Head", pokemon: 282, type1: "psychic", type2: "fairy", ability: "Infinite Scroll Vision", hp: 86 },
  { name: "Satyam Tiwari", role: "Web Dev Lead", pokemon: 474, type1: "normal", type2: null, ability: "Porygon Code Rush", hp: 80 },
  { name: "Grihika", role: "Creatives Head", pokemon: 350, type1: "water", type2: null, ability: "Glamour Beam", hp: 83 },
  { name: "Nikitha", role: "Creatives Lead", pokemon: 35, type1: "normal", type2: "fairy", ability: "Cute Charm +", hp: 78 },
  { name: "Anurag Anand", role: "R&D Head", pokemon: 150, type1: "psychic", type2: null, ability: "Genetic Algorithm", hp: 95 },
  { name: "Janani Hema", role: "R&D Lead", pokemon: 380, type1: "psychic", type2: "dragon", ability: "Temporal Data Mining", hp: 88 },
  { name: "Rimil Bhattacharya", role: "R&D Lead", pokemon: 381, type1: "psychic", type2: "dragon", ability: "Spatial Data Shift", hp: 88 },
];

// ─── Type system ──────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; text: string; glow: string; card: string }> = {
  fire: { bg: "#ff6b35", text: "#fff", glow: "#ff6b3577", card: "linear-gradient(160deg,#fff8f5,#fff3ee)" },
  water: { bg: "#3b82f6", text: "#fff", glow: "#3b82f677", card: "linear-gradient(160deg,#f5f9ff,#eef4ff)" },
  grass: { bg: "#16a34a", text: "#fff", glow: "#16a34a77", card: "linear-gradient(160deg,#f5fff7,#edfff1)" },
  electric: { bg: "#ca8a04", text: "#fff", glow: "#ca8a0477", card: "linear-gradient(160deg,#fffdf0,#fffbdc)" },
  psychic: { bg: "#db2777", text: "#fff", glow: "#db277777", card: "linear-gradient(160deg,#fff5fa,#ffeef7)" },
  dragon: { bg: "#6d28d9", text: "#fff", glow: "#6d28d977", card: "linear-gradient(160deg,#faf5ff,#f4eeff)" },
  normal: { bg: "#78716c", text: "#fff", glow: "#78716c55", card: "linear-gradient(160deg,#fafaf9,#f5f5f4)" },
  flying: { bg: "#6366f1", text: "#fff", glow: "#6366f177", card: "linear-gradient(160deg,#f5f5ff,#eeefff)" },
  fighting: { bg: "#b91c1c", text: "#fff", glow: "#b91c1c77", card: "linear-gradient(160deg,#fff5f5,#ffeeee)" },
  steel: { bg: "#64748b", text: "#fff", glow: "#64748b55", card: "linear-gradient(160deg,#f8fafc,#f1f5f9)" },
  ice: { bg: "#0891b2", text: "#fff", glow: "#0891b277", card: "linear-gradient(160deg,#f0fdff,#e0f9ff)" },
  fairy: { bg: "#c026d3", text: "#fff", glow: "#c026d377", card: "linear-gradient(160deg,#fdf5ff,#faeeff)" },
};

// ─── Pokéball ─────────────────────────────────────────────────────────────────

function Pokeball({ size = 24, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100"
      style={{ animation: spinning ? "spinBall 1.8s linear infinite" : "none", flexShrink: 0 }}>
      <circle cx="50" cy="50" r="47" fill="#e63946" stroke="#1a1a2e" strokeWidth="5" />
      <path d="M3 50 A47 47 0 0 1 97 50" fill="#f1faee" />
      <rect x="3" y="46" width="94" height="8" fill="#1a1a2e" />
      <circle cx="50" cy="50" r="14" fill="#f1faee" stroke="#1a1a2e" strokeWidth="5" />
      <circle cx="50" cy="50" r="6" fill="#fff" stroke="#1a1a2e" strokeWidth="2" />
    </svg>
  );
}

// ─── Type Badge ───────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.normal;
  return (
    <span style={{
      background: c.bg, color: c.text,
      fontFamily: "'Press Start 2P', monospace",
      fontSize: "0.65rem",
      padding: "4px 9px", borderRadius: 4,
      letterSpacing: "0.04em",
      textTransform: "uppercase" as const,
      border: "2px solid rgba(0,0,0,0.15)",
      boxShadow: "2px 2px 0 rgba(0,0,0,0.18)",
      whiteSpace: "nowrap" as const,
    }}>
      {type}
    </span>
  );
}

// ─── HP Bar ───────────────────────────────────────────────────────────────────

function HPBar({ hp }: { hp: number }) {
  const color = hp > 60 ? "#16a34a" : hp > 30 ? "#ca8a04" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "0.65rem", color: "#374151", minWidth: 26 }}>HP</span>
      <div style={{ flex: 1, height: 9, background: "#e5e7eb", borderRadius: 3, border: "1px solid #d1d5db", overflow: "hidden" }}>
        <div style={{ width: `${hp}%`, height: "100%", background: color, borderRadius: 3, transition: "width 1.2s ease" }} />
      </div>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "0.65rem", color: "#374151" }}>{hp}</span>
    </div>
  );
}

// ─── Scratch Name Reveal ──────────────────────────────────────────────────────

const BRUSH_RADIUS = 28;
const REVEAL_THRESHOLD = 0.55; // 55% scratched = fully revealed

function ScratchName({ name, typeColor }: { name: string; typeColor: { bg: string; glow: string } }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [revealed, setRevealed] = useState(false);
  const [isScratching, setIsScratching] = useState(false);
  const initialized = useRef(false);
  const scratchedPixels = useRef(0);
  const totalPixels = useRef(0);

  // Draw pixel-art static pattern on canvas (the "scratch" overlay)
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || initialized.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    totalPixels.current = W * H;

    // Fill with pixelated pattern overlay
    const pixelSize = 5;
    for (let x = 0; x < W; x += pixelSize) {
      for (let y = 0; y < H; y += pixelSize) {
        const rand = Math.random();
        // Mix of dark colors for pixel-art effect
        if (rand < 0.3) ctx.fillStyle = "#1a1a2e";
        else if (rand < 0.55) ctx.fillStyle = "#2d2d44";
        else if (rand < 0.75) ctx.fillStyle = "#3a3a5c";
        else if (rand < 0.88) ctx.fillStyle = "#e63946";
        else ctx.fillStyle = "#d4a63a";
        ctx.fillRect(x, y, pixelSize, pixelSize);
      }
    }

    // "???" hint text
    ctx.font = "bold 14px 'Press Start 2P', monospace";
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.textAlign = "center";
    ctx.fillText("???", W / 2, H / 2 + 5);

    initialized.current = true;
    scratchedPixels.current = 0;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Set canvas display size & pixel size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width || 220;
    canvas.height = rect.height || 32;
    initialized.current = false;
    initCanvas();
  }, [initCanvas]);

  const scratch = useCallback((clientX: number, clientY: number) => {
    if (revealed) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    // Erase a circle using destination-out composite
    ctx.globalCompositeOperation = "destination-out";
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, BRUSH_RADIUS);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(0.6, "rgba(0,0,0,0.9)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, BRUSH_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";

    // Check reveal percentage via sampling
    const sampleStep = 4;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let transparent = 0;
    let total = 0;
    for (let i = 3; i < imageData.data.length; i += 4 * sampleStep) {
      total++;
      if (imageData.data[i] < 128) transparent++;
    }
    const ratio = transparent / total;
    if (ratio >= REVEAL_THRESHOLD) {
      setRevealed(true);
    }
  }, [revealed]);

  // Mouse handlers
  const onMouseDown = (e: React.MouseEvent) => {
    setIsScratching(true);
    scratch(e.clientX, e.clientY);
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isScratching) return;
    scratch(e.clientX, e.clientY);
  };
  const onMouseUp = () => setIsScratching(false);

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    setIsScratching(true);
    const t = e.touches[0];
    scratch(t.clientX, t.clientY);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    if (!isScratching) return;
    const t = e.touches[0];
    scratch(t.clientX, t.clientY);
  };
  const onTouchEnd = () => setIsScratching(false);

  return (
    <div style={{ position: "relative", height: 34, userSelect: "none" }}>
      {/* Actual name underneath */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center",
        fontFamily: "'Press Start 2P', monospace",
        fontSize: "0.72rem",
        color: "#1a1a2e",
        lineHeight: 1.6,
        overflow: "hidden",
        padding: "0 2px",
        transition: revealed ? "filter 0.4s ease" : "none",
        filter: revealed ? "none" : "blur(0px)", // name shows through canvas holes
      }}>
        {name}
      </div>

      {/* Canvas overlay — hidden when fully revealed */}
      {!revealed && (
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            borderRadius: 4,
            cursor: isScratching ? "crosshair" : "cell",
            touchAction: "none",
            border: `1px dashed ${typeColor.bg}55`,
            boxShadow: `0 0 8px ${typeColor.glow}`,
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        />
      )}

      {/* Revealed flash */}
      {revealed && (
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          borderRadius: 4,
          animation: "revealFlash 0.5s ease forwards",
          background: `radial-gradient(ellipse at center, ${typeColor.bg}33 0%, transparent 70%)`,
        }} />
      )}
    </div>
  );
}

// ─── Pokémon Card (fixed size) ────────────────────────────────────────────────

// Fixed card dimensions
const CARD_WIDTH = 260;
const CARD_HEIGHT = 420;

function PokeCard({ member, index }: { member: (typeof BOARD)[0]; index: number }) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const t1 = TYPE_COLORS[member.type1] ?? TYPE_COLORS.normal;
  const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${member.pokemon}.png`;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        margin: "0 auto",
        animationDelay: `${index * 70}ms`,
        animationFillMode: "both",
        animation: "cardReveal 0.65s cubic-bezier(0.34,1.56,0.64,1) both",
        flexShrink: 0,
      }}
    >
      <div style={{
        background: hovered ? t1.card : "linear-gradient(160deg,#fffdf0,#fef8e1)",
        border: `3px solid ${hovered ? t1.bg : "#d4a63a"}`,
        borderRadius: 18,
        padding: "0.85rem 0.9rem",
        boxShadow: hovered
          ? `0 20px 50px rgba(0,0,0,0.32), 0 0 0 1px ${t1.bg}44, 0 0 28px ${t1.glow}, 5px 5px 0 ${t1.bg}55`
          : "4px 4px 0 #d4a63a, 0 6px 24px rgba(0,0,0,0.18)",
        transform: hovered ? "translateY(-8px) scale(1.03) rotate(-0.5deg)" : "none",
        transition: "all 0.28s cubic-bezier(0.34,1.56,0.64,1)",
        width: "100%",
        height: "100%",
        position: "relative" as const,
        overflow: "hidden",
        cursor: "default",
        display: "flex",
        flexDirection: "column" as const,
        boxSizing: "border-box" as const,
      }}>

        {/* Holographic shimmer */}
        {hovered && (
          <div style={{
            position: "absolute", inset: 0, borderRadius: 15, pointerEvents: "none",
            background: `linear-gradient(125deg, transparent 20%, ${t1.bg}18 45%, transparent 65%)`,
            backgroundSize: "300% 100%",
            animation: "shimmerSlide 1.4s ease infinite",
            zIndex: 0,
          }} />
        )}

        {/* Row 1: Scratch name + HP */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem", position: "relative", zIndex: 1, gap: "0.4rem" }}>
          {/* Scratch reveal name — takes remaining space */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <ScratchName name={member.name} typeColor={t1} />
          </div>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "0.75rem",
            color: t1.bg,
            textShadow: `0 0 10px ${t1.glow}`,
            whiteSpace: "nowrap" as const,
            flexShrink: 0,
          }}>
            {member.hp} HP
          </div>
        </div>

        {/* Row 2: Type badges */}
        <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.45rem", flexWrap: "wrap" as const, position: "relative", zIndex: 1 }}>
          <TypeBadge type={member.type1} />
          {member.type2 && <TypeBadge type={member.type2} />}
        </div>

        {/* Row 3: Sprite — fixed height */}
        <div style={{
          background: `linear-gradient(135deg, ${t1.bg}0f, ${t1.bg}22)`,
          border: `2px solid ${t1.bg}33`,
          borderRadius: 10,
          height: 128,
          flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "0.5rem", position: "relative", overflow: "hidden", zIndex: 1,
        }}>
          <div style={{ position: "absolute", bottom: -20, right: -20, opacity: 0.06 }}>
            <Pokeball size={100} />
          </div>
          {!imgLoaded && (
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "0.7rem", color: t1.bg, animation: "pulse 1s step-end infinite" }}>...</div>
          )}
          <img
            src={spriteUrl}
            alt={`Pokémon ${member.pokemon}`}
            onLoad={() => setImgLoaded(true)}
            style={{
              maxHeight: 115, maxWidth: 120, objectFit: "contain",
              display: imgLoaded ? "block" : "none",
              filter: `drop-shadow(0 4px 14px ${t1.glow})`,
              animation: hovered ? "pokeBounce 0.55s ease-in-out infinite alternate" : "none",
              position: "relative", zIndex: 1,
            }}
          />
        </div>

        {/* Row 4: HP bar */}
        <div style={{ marginBottom: "0.45rem", position: "relative", zIndex: 1 }}>
          <HPBar hp={member.hp} />
        </div>

        {/* Row 5: Role — fixed height */}
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "0.6rem",
          color: "#6b7280",
          textAlign: "center" as const,
          marginBottom: "0.4rem",
          letterSpacing: "0.04em",
          position: "relative", zIndex: 1,
          height: 20,
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          {member.role}
        </div>

        {/* Row 6: Ability — fills remaining space */}
        <div style={{
          background: "rgba(0,0,0,0.06)", borderRadius: 7,
          padding: "0.4rem 0.55rem",
          border: "1px solid rgba(0,0,0,0.08)",
          position: "relative", zIndex: 1,
          flex: 1,
          display: "flex", flexDirection: "column" as const, justifyContent: "center",
        }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "0.5rem", color: "#9ca3af", marginBottom: 4 }}>ABILITY</div>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "0.58rem",
            color: "#1a1a2e",
            lineHeight: 1.8,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical" as const,
          }}>
            {member.ability}
          </div>
        </div>

        {/* Pokédex number */}
        <div style={{ position: "absolute", bottom: 7, right: 9, fontFamily: "'Press Start 2P', monospace", fontSize: "0.5rem", color: `${t1.bg}66`, zIndex: 1 }}>
          #{String(member.pokemon).padStart(3, "0")}
        </div>
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: "3rem" }}>
      <div style={{
        display: "inline-block",
        background: "#1a1a2e", border: "4px solid #d4a63a", borderRadius: 8,
        padding: "0.7rem 2rem", boxShadow: "5px 5px 0 #d4a63a",
        marginBottom: sub ? "0.9rem" : 0,
      }}>
        <span style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "clamp(0.8rem, 2.2vw, 1.1rem)",
          color: "#facc15", letterSpacing: "0.07em",
          textShadow: "0 0 20px #facc1577",
        }}>
          {title}
        </span>
      </div>
      {sub && (
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "clamp(0.58rem, 1.2vw, 0.72rem)",
          color: "#94a3b8", letterSpacing: "0.1em",
          marginTop: "0.4rem",
        }}>{sub}</div>
      )}
    </div>
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────

function LoadingScreen({ onDone, onAudioStop }: { onDone: () => void; onAudioStop: () => void }) {
  const [step, setStep] = useState(0);
  const [dots, setDots] = useState("");
  const [fadeOut, setFadeOut] = useState(false);

  const msgs = [
    "PROF. OAK: Welcome to the world of",
    "ACM SIGKDD!",
    "This world is inhabited by creatures",
    "called DATA SCIENTISTS.",
    "Some people use them for research.",
    "Others — for knowledge mining.",
    "Your story is about to unfold!",
    "A world of PATTERNS awaits. Let's GO!",
  ];

  useEffect(() => {
    const sInt = setInterval(() => setStep(s => Math.min(s + 1, msgs.length - 1)), 500);
    const dInt = setInterval(() => setDots(d => d.length >= 3 ? "" : d + "."), 380);
    const exit = setTimeout(() => {
      setFadeOut(true);
      onAudioStop();          // begin smooth audio fade as loader fades out
      setTimeout(onDone, 550);
    }, 4700);
    return () => { clearInterval(sInt); clearInterval(dInt); clearTimeout(exit); };
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999, background: "#1a1a2e",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      opacity: fadeOut ? 0 : 1, transition: "opacity 0.55s ease",
    }}>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(0deg,rgba(0,0,0,0.18) 0,rgba(0,0,0,0.18) 1px,transparent 1px,transparent 3px)" }} />

      {[...Array(7)].map((_, i) => (
        <div key={i} style={{ position: "absolute", top: `${8 + (i * 14) % 82}%`, left: `${6 + (i * 19) % 88}%`, opacity: 0.05, animation: `floatBall ${5 + i * 0.8}s ease-in-out infinite alternate`, animationDelay: `${i * 0.35}s` }}>
          <Pokeball size={35 + i * 15} />
        </div>
      ))}

      <div style={{ position: "relative", zIndex: 2, width: "min(520px,90vw)", textAlign: "center" }}>
        <div style={{ marginBottom: "1.25rem", animation: "heroFloat 1.4s ease-in-out infinite" }}>
          <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png" alt="Pikachu"
            style={{ width: 120, height: 120, objectFit: "contain", filter: "drop-shadow(0 0 22px #ca8a04aa)" }} />
        </div>

        <div style={{
          background: "#f1faee", border: "4px solid #1a1a2e", borderRadius: 8,
          padding: "1.4rem 1.6rem", boxShadow: "6px 6px 0 #1a1a2e", textAlign: "left",
        }}>
          <div style={{ minHeight: 100, fontFamily: "'Press Start 2P', monospace", fontSize: "clamp(0.65rem, 1.8vw, 0.82rem)", color: "#1a1a2e", lineHeight: 2.4 }}>
            {msgs.slice(0, step + 1).map((m, i) => (
              <div key={i} style={{ animation: "textPop 0.2s ease" }}>{m}{i === step ? dots : ""}</div>
            ))}
          </div>
          <div style={{ textAlign: "right", fontFamily: "'Press Start 2P', monospace", fontSize: "0.75rem", color: "#1a1a2e", animation: "pulse 0.7s step-end infinite", marginTop: 6 }}>▼</div>
        </div>

        <div style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "0.7rem", justifyContent: "center" }}>
          <Pokeball size={20} spinning />
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "0.72rem", color: "#facc15" }}>LOADING{dots}</span>
          <Pokeball size={20} spinning />
        </div>
      </div>

      <style>{`
        @keyframes textPop { from{opacity:0;transform:translateX(-6px)} to{opacity:1;transform:none} }
        @keyframes spinBall { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes floatBall { from{transform:translateY(0) rotate(0)} to{transform:translateY(-22px) rotate(18deg)} }
        @keyframes heroFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0} }
      `}</style>
    </div>
  );
}

// ─── Background ───────────────────────────────────────────────────────────────

function Background() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(155deg,#1a1a2e 0%,#16213e 45%,#0f3460 100%)" }} />
      <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(250,204,21,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(250,204,21,0.035) 1px,transparent 1px)", backgroundSize: "32px 32px" }} />
      {[
        { s: 90, t: "7%", l: "4%", o: 0.055, d: 7 },
        { s: 55, t: "18%", l: "88%", o: 0.045, d: 9 },
        { s: 130, t: "58%", l: "1%", o: 0.04, d: 11 },
        { s: 65, t: "78%", l: "91%", o: 0.055, d: 8 },
        { s: 45, t: "43%", l: "94%", o: 0.045, d: 6 },
        { s: 100, t: "4%", l: "54%", o: 0.035, d: 10 },
      ].map((b, i) => (
        <div key={i} style={{ position: "absolute", top: b.t, left: b.l, opacity: b.o, animation: `floatBall ${b.d}s ease-in-out infinite alternate`, animationDelay: `${i * 0.7}s` }}>
          <Pokeball size={b.s} />
        </div>
      ))}
      <div style={{ position: "absolute", top: "8%", left: "18%", width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle,rgba(230,57,70,0.1) 0%,transparent 70%)", filter: "blur(45px)" }} />
      <div style={{ position: "absolute", bottom: "12%", right: "12%", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle,rgba(250,204,21,0.07) 0%,transparent 70%)", filter: "blur(55px)" }} />
      <div style={{ position: "absolute", top: "50%", left: "45%", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle,rgba(109,40,217,0.07) 0%,transparent 70%)", filter: "blur(45px)" }} />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// CSS clamp helper for inline styles (avoids duplicating the string)
function clampSize(min: number, max: number) {
  return `clamp(${min}px, ${Math.round((min + max) / 2 / 5)}vw, ${max}px)`;
}

// ─── Root ─────────────────────────────────────────────────────────────────────
//
// Audio strategy:
//   1. A "PRESS START" splash is ALWAYS shown first — this gives us a guaranteed
//      user gesture on every platform (desktop + mobile), satisfying autoplay policy.
//   2. On that tap we call startAudio() — music begins immediately and loops forever.
//   3. The LoadingScreen then runs. When it finishes, audio keeps playing; we never
//      call stop() so the battle music continues across the whole page.
//   4. A mute toggle (🔊/🔇) in the corner lets users silence it anytime.

export default function Home() {
  const [phase, setPhase] = useState<"splash" | "loading" | "main">("splash");
  // splash  → big PRESS START screen (provides user gesture for audio)
  // loading → LoadingScreen (audio already running)
  // main    → full page visible

  const [muted, setMuted] = useState(false);
  const { startAudio, stopAudio, setMute } = useLoaderAudio();

  // Called when user presses PRESS START
  const handleSplashClick = () => {
    startAudio();          // guaranteed gesture → AudioContext starts immediately
    setPhase("loading");
  };

  // Called when LoadingScreen finishes
  const handleLoadDone = () => {
    setPhase("main");
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMute(next);
  };

  const visible = phase === "main";

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Nunito:wght@600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{background:#1a1a2e;overflow-x:hidden}
 
        @keyframes cardReveal { from{opacity:0;transform:translateY(38px) scale(0.9) rotate(-1.5deg)} to{opacity:1;transform:none} }
        @keyframes shimmerSlide { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes pokeBounce { from{transform:translateY(0) scale(1)} to{transform:translateY(-7px) scale(1.06)} }
        @keyframes titleIn { from{opacity:0;transform:scale(0.75) translateY(-18px)} to{opacity:1;transform:none} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:none} }
        @keyframes floatBall { from{transform:translateY(0) rotate(0deg)} to{transform:translateY(-24px) rotate(20deg)} }
        @keyframes heroFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes spinBall { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes revealFlash { 0%{opacity:0.7} 100%{opacity:0} }
        @keyframes rainbowBorder {
          0%{border-color:#e63946} 20%{border-color:#facc15} 40%{border-color:#22c55e}
          60%{border-color:#3b82f6} 80%{border-color:#7c3aed} 100%{border-color:#e63946}
        }
        @keyframes splashBlink { 0%,100%{opacity:1} 49%{opacity:1} 50%,99%{opacity:0} }
        @keyframes splashPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
 
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:#1a1a2e}
        ::-webkit-scrollbar-thumb{background:#e63946;border-radius:3px}
 
        /* Fixed card grid: always same column width */
        .card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 260px));
          gap: 1.5rem;
          justify-content: center;
        }
      `}</style>

      {/* ── PRESS START splash ── */}
      {phase === "splash" && (
        <div
          onClick={handleSplashClick}
          style={{
            position: "fixed", inset: 0, zIndex: 99999,
            background: "#1a1a2e",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            cursor: "pointer", userSelect: "none",
          }}
        >
          {/* CRT scanlines */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "repeating-linear-gradient(0deg,rgba(0,0,0,0.22) 0,rgba(0,0,0,0.22) 1px,transparent 1px,transparent 3px)"
          }} />
          {/* Grid */}
          <div style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "linear-gradient(rgba(250,204,21,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(250,204,21,0.03) 1px,transparent 1px)",
            backgroundSize: "32px 32px"
          }} />

          {/* Floating pokeballs */}
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              position: "absolute", top: `${12 + (i * 18) % 76}%`, left: `${8 + (i * 22) % 84}%`,
              opacity: 0.06, animation: `floatBall ${6 + i}s ease-in-out infinite alternate`, animationDelay: `${i * 0.5}s`
            }}>
              <Pokeball size={40 + i * 20} />
            </div>
          ))}

          <div style={{ position: "relative", zIndex: 2, textAlign: "center", padding: "2rem" }}>
            {/* Logo */}
            <div style={{ marginBottom: "2rem", animation: "splashPulse 2s ease-in-out infinite" }}>
              <div style={{
                fontFamily: "'Press Start 2P',monospace", fontSize: "clamp(0.55rem,1.4vw,0.75rem)",
                color: "#facc15", letterSpacing: "0.22em", marginBottom: "0.8rem", textShadow: "0 0 14px #facc1566"
              }}>
                ★ ACM STUDENT CHAPTER ★
              </div>
              <div style={{
                fontFamily: "'Press Start 2P',monospace", fontSize: "clamp(2.5rem,9vw,6rem)",
                lineHeight: 1.05, textShadow: "4px 4px 0 #e63946, 8px 8px 0 rgba(230,57,70,0.22)"
              }}>
                <span style={{ color: "#e63946" }}>SIG</span><span style={{ color: "#facc15" }}>KDD</span>
              </div>
            </div>

            {/* Pikachu */}
            <div style={{ marginBottom: "2rem", animation: "heroFloat 1.8s ease-in-out infinite" }}>
              <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png"
                alt="Pikachu" style={{
                  width: clampSize(100, 130), height: clampSize(100, 130), objectFit: "contain",
                  filter: "drop-shadow(0 0 24px #ca8a04bb)"
                }} />
            </div>

            {/* Press Start */}
            <div style={{
              fontFamily: "'Press Start 2P',monospace", fontSize: "clamp(0.65rem,2vw,0.95rem)",
              color: "#fff", letterSpacing: "0.12em", lineHeight: 2,
              animation: "splashBlink 1.1s step-end infinite",
              textShadow: "0 0 16px rgba(255,255,255,0.4)"
            }}>
              ▶ PRESS START ◀
            </div>
            <div style={{
              fontFamily: "'Press Start 2P',monospace", fontSize: "clamp(0.4rem,1vw,0.55rem)",
              color: "#64748b", marginTop: "0.7rem", letterSpacing: "0.1em"
            }}>
              CLICK OR TAP ANYWHERE
            </div>
          </div>
        </div>
      )}

      {/* Mute toggle — always visible once past splash */}
      {phase !== "splash" && (
        <button
          onClick={toggleMute}
          title={muted ? "Unmute" : "Mute"}
          style={{
            position: "fixed", bottom: 18, right: 18, zIndex: 9999,
            background: "#1a1a2e", border: `3px solid ${muted ? "#64748b" : "#facc15"}`,
            borderRadius: 8, padding: "0.45rem 0.7rem",
            boxShadow: `3px 3px 0 ${muted ? "#64748b" : "#facc15"}`,
            cursor: "pointer", transition: "all 0.2s",
            fontFamily: "'Press Start 2P',monospace", fontSize: "0.85rem",
            lineHeight: 1, color: muted ? "#64748b" : "#facc15",
          }}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      )}

      {phase === "loading" && <LoadingScreen onDone={handleLoadDone} onAudioStop={() => {/* keep playing */ }} />}
      <Background />

      <div style={{ position: "relative", zIndex: 2, minHeight: "100vh", opacity: visible ? 1 : 0, transition: "opacity 0.65s ease" }}>

        {/* ── Hero ── */}
        <header style={{ textAlign: "center", padding: "5.5rem 1.5rem 4rem" }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "clamp(0.6rem, 1.5vw, 0.8rem)",
            color: "#facc15", letterSpacing: "0.25em", marginBottom: "1.2rem",
            animation: "fadeUp 0.5s 0.1s both", textShadow: "0 0 14px #facc1566",
          }}>
            ★ ACM STUDENT CHAPTER ★
          </div>

          <h1 style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "clamp(2.2rem, 8vw, 5.5rem)",
            color: "#fff", lineHeight: 1.1,
            animation: "titleIn 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.2s both",
            marginBottom: "0.6rem",
            textShadow: "4px 4px 0 #e63946, 8px 8px 0 rgba(230,57,70,0.25)",
          }}>
            <span style={{ color: "#e63946" }}>SIG</span><span style={{ color: "#facc15" }}>KDD</span>
          </h1>

          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "clamp(0.5rem, 1.2vw, 0.7rem)",
            color: "#94a3b8", letterSpacing: "0.12em",
            animation: "fadeUp 0.5s 0.38s both", marginBottom: "3rem", lineHeight: 2.4,
          }}>
            KNOWLEDGE DISCOVERY &amp; DATA MINING
          </div>

          {/* Scratch hint */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.6rem",
            background: "rgba(250,204,21,0.1)", border: "2px dashed #facc1566",
            borderRadius: 8, padding: "0.55rem 1.2rem", marginBottom: "2rem",
            animation: "fadeUp 0.5s 0.45s both",
          }}>
            <span style={{ fontSize: "1.1rem" }}>✦</span>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "clamp(0.42rem, 1vw, 0.58rem)", color: "#facc15", letterSpacing: "0.08em" }}>
              SCRATCH THE NAME AREA TO REVEAL MEMBERS!
            </span>
            <span style={{ fontSize: "1.1rem" }}>✦</span>
          </div>

          {/* Legendary birds */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: "clamp(0.8rem,3vw,3rem)", animation: "fadeUp 0.5s 0.5s both", marginBottom: "2.5rem" }}>
            {[
              { id: 144, label: "Research", delay: 0 },
              { id: 146, label: "Innovation", delay: 0.4 },
              { id: 145, label: "Technology", delay: 0.8 },
            ].map(b => (
              <div key={b.id} style={{ textAlign: "center", animation: `heroFloat ${3.2 + b.delay * 0.4}s ease-in-out infinite`, animationDelay: `${b.delay}s` }}>
                <img src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${b.id}.png`} alt=""
                  style={{ width: "clamp(70px,10vw,110px)", height: "clamp(70px,10vw,110px)", objectFit: "contain", filter: "drop-shadow(0 4px 18px rgba(250,204,21,0.38))" }} />
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "clamp(0.45rem,1vw,0.6rem)", color: "#facc15", marginTop: 6, letterSpacing: "0.08em" }}>{b.label}</div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ flex: 1, height: 3, background: "linear-gradient(90deg,transparent,#e63946)" }} />
            <Pokeball size={26} />
            <div style={{ flex: 1, height: 3, background: "linear-gradient(90deg,#e63946,transparent)" }} />
          </div>
        </header>

        {/* ── Board ── */}
        <section style={{ padding: "0 clamp(1.5rem,4vw,3.5rem) 5rem", maxWidth: 1400, margin: "0 auto" }}>
          <SectionHeader title="★ BOARD MEMBERS ★" />
          <div className="card-grid">
            {BOARD.map((m, i) => <PokeCard key={m.name} member={m} index={i} />)}
          </div>
        </section>

        {/* ── Wild encounter ── */}
        <div style={{ maxWidth: 860, margin: "0 auto 4.5rem", padding: "0 2rem", textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "1rem",
            background: "#e63946", border: "4px solid #facc15", borderRadius: 8,
            padding: "0.8rem 1.8rem", boxShadow: "4px 4px 0 #facc15",
            animation: "rainbowBorder 3s linear infinite",
          }}>
            <Pokeball size={20} spinning />
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "clamp(0.5rem, 1.5vw, 0.72rem)", color: "#fff", letterSpacing: "0.09em" }}>
              A WILD CORE TEAM APPEARED!
            </span>
            <Pokeball size={20} spinning />
          </div>
        </div>

        {/* ── Core ── */}
        <section style={{ padding: "0 clamp(1.5rem,4vw,3.5rem) 7rem", maxWidth: 1600, margin: "0 auto" }}>
          <SectionHeader title="★ CORE MEMBERS ★" sub="CHOOSE YOUR STARTER TEAM" />
          <div className="card-grid">
            {CORE.map((m, i) => <PokeCard key={m.name} member={m} index={i} />)}
          </div>
        </section>

        {/* ── Footer ── */}
        <footer style={{ borderTop: "3px solid rgba(230,57,70,0.2)", padding: "2.5rem", textAlign: "center" }}>
          <div style={{ marginBottom: "0.9rem" }}><Pokeball size={30} /></div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "clamp(0.45rem,1vw,0.6rem)", color: "#4b5563", letterSpacing: "0.14em", lineHeight: 2.6 }}>
            ACM SIGKDD STUDENT CHAPTER · {new Date().getFullYear()}<br />
            <span style={{ color: "rgba(230,57,70,0.4)" }}>GOTTA MINE 'EM ALL</span>
          </div>
        </footer>
      </div>
    </>
  );
}