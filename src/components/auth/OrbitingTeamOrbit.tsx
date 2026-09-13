import { useState, type CSSProperties } from "react";
import { RevenantMark } from "./RevenantMark";

const ORBIT_USERS = [
  {
    fullName: "Priya Sharma",
    org: "FinStack",
    initials: "PS",
    color: "from-violet-500 to-purple-600",
    duration: 32,
    radius: 170,
    delay: 0,
  },
  {
    fullName: "Arjun Mehta",
    org: "NovaHealth",
    initials: "AM",
    color: "from-cyan-500 to-blue-600",
    duration: 36,
    radius: 170,
    delay: -6,
  },
  {
    fullName: "Sneha Reddy",
    org: "LogiCore",
    initials: "SR",
    color: "from-emerald-500 to-teal-600",
    duration: 34,
    radius: 170,
    delay: -12,
  },
  {
    fullName: "Rahul Kapoor",
    org: "PayGrid",
    initials: "RK",
    color: "from-amber-500 to-orange-600",
    duration: 38,
    radius: 130,
    delay: -3,
  },
  {
    fullName: "Maya Iyer",
    org: "CloudNine",
    initials: "MI",
    color: "from-rose-500 to-pink-600",
    duration: 30,
    radius: 130,
    delay: -10,
  },
  {
    fullName: "Dev Patel",
    org: "StackRail",
    initials: "DP",
    color: "from-indigo-500 to-blue-700",
    duration: 35,
    radius: 130,
    delay: -16,
  },
];

export function OrbitingTeamOrbit() {
  const [hovered, setHovered] = useState<string | null>(null);
  const paused = hovered !== null;

  return (
    <div
      className={`relative mx-auto mb-2 flex h-[280px] w-[280px] items-center justify-center overflow-visible ${paused ? "auth-orbit-paused" : ""}`}
    >
      {/* Orbit paths — white, 40% opacity */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-[5] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white"
        style={{ width: 260, height: 260, opacity: 0.1 }}
      />
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-[5] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white"
        style={{ width: 340, height: 340, opacity: 0.1 }}
      />

      {/* Ripples start at the logo size and expand out — water-drop, not a shaking box */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-52 w-52 -translate-x-1/2 -translate-y-1/2">
        <span className="auth-ripple" />
        <span className="auth-ripple auth-ripple-delay-1" />
        <span className="auth-ripple auth-ripple-delay-2" />
      </div>

      <RevenantMark
        size="hero"
        glow
        className="relative z-20 shadow-[0_0_28px_rgba(37,99,235,0.45)]"
      />

      {ORBIT_USERS.map((user) => (
        <div
          key={user.fullName}
          className="auth-orbit-node pointer-events-auto absolute left-1/2 top-1/2 z-30 h-0 w-0"
          style={
            {
              "--orbit-r": `${user.radius}px`,
              "--orbit-duration": `${user.duration}s`,
              animationDelay: `${user.delay}s`,
            } as CSSProperties
          }
          onMouseEnter={() => setHovered(user.fullName)}
          onMouseLeave={() => setHovered(null)}
        >
          <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2">
            <div
              className={`relative flex flex-col items-center transition-transform duration-300 ${
                hovered === user.fullName ? "scale-110" : "scale-100"
              }`}
            >
              <div
                className={`pointer-events-none absolute -top-8 whitespace-nowrap rounded-md border border-white/15 bg-slate-900/95 px-2 py-1 text-center shadow-lg backdrop-blur-sm transition-opacity duration-200 ${
                  hovered === user.fullName ? "opacity-100" : "opacity-0"
                }`}
              >
                <div className="text-[11px] font-semibold text-white">
                  {user.fullName}
                </div>
                <div className="text-[9px] text-slate-400">{user.org}</div>
              </div>
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br ${user.color} text-[9px] font-bold text-white ring-2 ring-white/35 shadow-md ${
                  hovered === user.fullName ? "ring-cyan-300" : ""
                }`}
                title={user.fullName}
              >
                {user.initials}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
