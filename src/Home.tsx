import { useEffect, useState } from "react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const BOARD = [
  { name: "Chakshu Sharma",     role: "Chair",            pokemon: 6,   type1: "fire",    type2: "flying",  ability: "Leads with Blaze",       hp: 98 },
  { name: "Krish Keshab Banik", role: "Vice Chair",       pokemon: 149, type1: "dragon",  type2: null,      ability: "Hyper Drive Strategy",   hp: 91 },
  { name: "Dhriti Kothari Jain",role: "Treasurer",        pokemon: 36,  type1: "normal",  type2: "fairy",   ability: "Golden Ratio Finance",   hp: 85 },
  { name: "Ishita Chaurasia",   role: "Secretary",        pokemon: 196, type1: "psychic", type2: null,      ability: "Mind Archive",           hp: 88 },
  { name: "Salil Vaidya",       role: "Membership Chair", pokemon: 131, type1: "water",   type2: "ice",     ability: "Community Hydration",    hp: 87 },
  { name: "Ojas Mutreja",       role: "Webmaster",        pokemon: 137, type1: "normal",  type2: null,      ability: "Digital Evolution",      hp: 84 },
];

const CORE = [
  { name: "Palak Maheshwari",   role: "Corporate Head",   pokemon: 130, type1: "water",   type2: "flying",  ability: "Corporate Typhoon",      hp: 90 },
  { name: "Ishan Bakshi",       role: "Corporate Lead",   pokemon: 448, type1: "fighting",type2: "steel",   ability: "Iron Business Fist",     hp: 82 },
  { name: "Jahnavi Kishore",    role: "Web Dev Head",     pokemon: 282, type1: "psychic", type2: "fairy",   ability: "Infinite Scroll Vision", hp: 86 },
  { name: "Satyam Tiwari",      role: "Web Dev Lead",     pokemon: 474, type1: "normal",  type2: null,      ability: "Porygon Code Rush",      hp: 80 },
  { name: "Grihika",            role: "Creatives Head",   pokemon: 350, type1: "water",   type2: null,      ability: "Glamour Beam",           hp: 83 },
  { name: "Nikitha",            role: "Creatives Lead",   pokemon: 35,  type1: "normal",  type2: "fairy",   ability: "Cute Charm +",           hp: 78 },
  { name: "Anurag Anand",       role: "R&D Head",         pokemon: 150, type1: "psychic", type2: null,      ability: "Genetic Algorithm",      hp: 95 },
  { name: "Janani Hema",        role: "R&D Lead",         pokemon: 380, type1: "psychic", type2: "dragon",  ability: "Temporal Data Mining",   hp: 88 },
  { name: "Rimil Bhattacharya", role: "R&D Lead",         pokemon: 381, type1: "psychic", type2: "dragon",  ability: "Spatial Data Shift",     hp: 88 },
];

// ─── Type system ──────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { bg: string; text: string; glow: string; card: string }> = {
  fire:     { bg: "#ff6b35", text: "#fff", glow: "#ff6b3577", card: "linear-gradient(160deg,#fff8f5,#fff3ee)" },
  water:    { bg: "#3b82f6", text: "#fff", glow: "#3b82f677", card: "linear-gradient(160deg,#f5f9ff,#eef4ff)" },
  grass:    { bg: "#16a34a", text: "#fff", glow: "#16a34a77", card: "linear-gradient(160deg,#f5fff7,#edfff1)" },
  electric: { bg: "#ca8a04", text: "#fff", glow: "#ca8a0477", card: "linear-gradient(160deg,#fffdf0,#fffbdc)" },
  psychic:  { bg: "#db2777", text: "#fff", glow: "#db277777", card: "linear-gradient(160deg,#fff5fa,#ffeef7)" },
  dragon:   { bg: "#6d28d9", text: "#fff", glow: "#6d28d977", card: "linear-gradient(160deg,#faf5ff,#f4eeff)" },
  normal:   { bg: "#78716c", text: "#fff", glow: "#78716c55", card: "linear-gradient(160deg,#fafaf9,#f5f5f4)" },
  flying:   { bg: "#6366f1", text: "#fff", glow: "#6366f177", card: "linear-gradient(160deg,#f5f5ff,#eeefff)" },
  fighting: { bg: "#b91c1c", text: "#fff", glow: "#b91c1c77", card: "linear-gradient(160deg,#fff5f5,#ffeeee)" },
  steel:    { bg: "#64748b", text: "#fff", glow: "#64748b55", card: "linear-gradient(160deg,#f8fafc,#f1f5f9)" },
  ice:      { bg: "#0891b2", text: "#fff", glow: "#0891b277", card: "linear-gradient(160deg,#f0fdff,#e0f9ff)" },
  fairy:    { bg: "#c026d3", text: "#fff", glow: "#c026d377", card: "linear-gradient(160deg,#fdf5ff,#faeeff)" },
};

// ─── Pokéball ─────────────────────────────────────────────────────────────────

function Pokeball({ size = 24, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100"
      style={{ animation: spinning ? "spinBall 1.8s linear infinite" : "none", flexShrink: 0 }}>
      <circle cx="50" cy="50" r="47" fill="#e63946" stroke="#1a1a2e" strokeWidth="5"/>
      <path d="M3 50 A47 47 0 0 1 97 50" fill="#f1faee"/>
      <rect x="3" y="46" width="94" height="8" fill="#1a1a2e"/>
      <circle cx="50" cy="50" r="14" fill="#f1faee" stroke="#1a1a2e" strokeWidth="5"/>
      <circle cx="50" cy="50" r="6" fill="#fff" stroke="#1a1a2e" strokeWidth="2"/>
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
      fontSize: "0.7rem",
      padding: "5px 11px", borderRadius: 4,
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
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "0.72rem", color: "#374151", minWidth: 28 }}>HP</span>
      <div style={{ flex: 1, height: 10, background: "#e5e7eb", borderRadius: 3, border: "1px solid #d1d5db", overflow: "hidden" }}>
        <div style={{ width: `${hp}%`, height: "100%", background: color, borderRadius: 3, transition: "width 1.2s ease" }} />
      </div>
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "0.72rem", color: "#374151" }}>{hp}</span>
    </div>
  );
}

// ─── Pokémon Card ─────────────────────────────────────────────────────────────

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
        animationDelay: `${index * 70}ms`,
        animationFillMode: "both",
        animation: "cardReveal 0.65s cubic-bezier(0.34,1.56,0.64,1) both",
      }}
    >
      <div style={{
        background: hovered ? t1.card : "linear-gradient(160deg,#fffdf0,#fef8e1)",
        border: `3px solid ${hovered ? t1.bg : "#d4a63a"}`,
        borderRadius: 18,
        padding: "1rem 1rem 1rem",
        boxShadow: hovered
          ? `0 20px 50px rgba(0,0,0,0.32), 0 0 0 1px ${t1.bg}44, 0 0 28px ${t1.glow}, 5px 5px 0 ${t1.bg}55`
          : "4px 4px 0 #d4a63a, 0 6px 24px rgba(0,0,0,0.18)",
        transform: hovered ? "translateY(-8px) scale(1.03) rotate(-0.5deg)" : "none",
        transition: "all 0.28s cubic-bezier(0.34,1.56,0.64,1)",
        maxWidth: 260,
        margin: "0 auto",
        position: "relative" as const,
        overflow: "hidden",
        cursor: "default",
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

        {/* Name + HP row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.45rem", position: "relative", zIndex: 1 }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "0.75rem",
            color: "#1a1a2e", lineHeight: 1.8, maxWidth: "62%",
          }}>
            {member.name}
          </div>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "0.82rem",
            color: t1.bg, textShadow: `0 0 10px ${t1.glow}`,
            whiteSpace: "nowrap" as const,
          }}>
            {member.hp} HP
          </div>
        </div>

        {/* Type badges */}
        <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.55rem", flexWrap: "wrap" as const, position: "relative", zIndex: 1 }}>
          <TypeBadge type={member.type1} />
          {member.type2 && <TypeBadge type={member.type2} />}
        </div>

        {/* Sprite */}
        <div style={{
          background: `linear-gradient(135deg, ${t1.bg}0f, ${t1.bg}22)`,
          border: `2px solid ${t1.bg}33`,
          borderRadius: 10, height: 140,
          display: "flex", alignItems: "center", justifyContent: "center",
          marginBottom: "0.6rem", position: "relative", overflow: "hidden", zIndex: 1,
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
              maxHeight: 125, maxWidth: 130, objectFit: "contain",
              display: imgLoaded ? "block" : "none",
              filter: `drop-shadow(0 4px 14px ${t1.glow})`,
              animation: hovered ? "pokeBounce 0.55s ease-in-out infinite alternate" : "none",
              position: "relative", zIndex: 1,
            }}
          />
        </div>

        {/* HP bar */}
        <div style={{ marginBottom: "0.55rem", position: "relative", zIndex: 1 }}>
          <HPBar hp={member.hp} />
        </div>

        {/* Role */}
        <div style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: "0.68rem",
          color: "#6b7280", textAlign: "center" as const,
          marginBottom: "0.55rem", letterSpacing: "0.04em",
          position: "relative", zIndex: 1,
        }}>
          {member.role}
        </div>

        {/* Ability */}
        <div style={{
          background: "rgba(0,0,0,0.06)", borderRadius: 7,
          padding: "0.5rem 0.65rem", border: "1px solid rgba(0,0,0,0.08)",
          position: "relative", zIndex: 1,
        }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "0.55rem", color: "#9ca3af", marginBottom: 5 }}>ABILITY</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "0.65rem", color: "#1a1a2e", lineHeight: 1.8 }}>{member.ability}</div>
        </div>

        {/* Pokédex number */}
        <div style={{ position: "absolute", bottom: 8, right: 10, fontFamily: "'Press Start 2P', monospace", fontSize: "0.52rem", color: `${t1.bg}66`, zIndex: 1 }}>
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

function LoadingScreen({ onDone }: { onDone: () => void }) {
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
    const exit = setTimeout(() => { setFadeOut(true); setTimeout(onDone, 550); }, 4700);
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
        <div key={i} style={{ position: "absolute", top: `${8+(i*14)%82}%`, left: `${6+(i*19)%88}%`, opacity: 0.05, animation: `floatBall ${5+i*0.8}s ease-in-out infinite alternate`, animationDelay: `${i*0.35}s` }}>
          <Pokeball size={35+i*15} />
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
        { s:90,  t:"7%",  l:"4%",  o:0.055, d:7  },
        { s:55,  t:"18%", l:"88%", o:0.045, d:9  },
        { s:130, t:"58%", l:"1%",  o:0.04,  d:11 },
        { s:65,  t:"78%", l:"91%", o:0.055, d:8  },
        { s:45,  t:"43%", l:"94%", o:0.045, d:6  },
        { s:100, t:"4%",  l:"54%", o:0.035, d:10 },
      ].map((b,i)=>(
        <div key={i} style={{ position:"absolute", top:b.t, left:b.l, opacity:b.o, animation:`floatBall ${b.d}s ease-in-out infinite alternate`, animationDelay:`${i*0.7}s` }}>
          <Pokeball size={b.s} />
        </div>
      ))}
      <div style={{ position:"absolute", top:"8%", left:"18%", width:450, height:450, borderRadius:"50%", background:"radial-gradient(circle,rgba(230,57,70,0.1) 0%,transparent 70%)", filter:"blur(45px)" }} />
      <div style={{ position:"absolute", bottom:"12%", right:"12%", width:520, height:520, borderRadius:"50%", background:"radial-gradient(circle,rgba(250,204,21,0.07) 0%,transparent 70%)", filter:"blur(55px)" }} />
      <div style={{ position:"absolute", top:"50%", left:"45%", width:380, height:380, borderRadius:"50%", background:"radial-gradient(circle,rgba(109,40,217,0.07) 0%,transparent 70%)", filter:"blur(45px)" }} />
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => { if (loaded) setTimeout(() => setVisible(true), 60); }, [loaded]);

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
        @keyframes rainbowBorder {
          0%{border-color:#e63946} 20%{border-color:#facc15} 40%{border-color:#22c55e}
          60%{border-color:#3b82f6} 80%{border-color:#7c3aed} 100%{border-color:#e63946}
        }
        ::-webkit-scrollbar{width:5px}
        ::-webkit-scrollbar-track{background:#1a1a2e}
        ::-webkit-scrollbar-thumb{background:#e63946;border-radius:3px}
      `}</style>

      {!loaded && <LoadingScreen onDone={() => setLoaded(true)} />}
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

          {/* Legendary birds */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: "clamp(0.8rem,3vw,3rem)", animation: "fadeUp 0.5s 0.5s both", marginBottom: "2.5rem" }}>
            {[
              { id: 144, label: "Research",   delay: 0   },
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
          <SectionHeader title="★ BOARD MEMBERS ★" sub="THE ELITE FOUR OF SIGKDD" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: "1.5rem" }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(215px,1fr))", gap: "1.4rem" }}>
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