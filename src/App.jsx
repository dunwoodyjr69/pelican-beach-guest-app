import { useState, useRef, useEffect, useCallback } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import lfvSun from "./assets/lfv-sun.png";
import pelicanHero from "./assets/pelican-hero.jpg";
import resortMap from "./assets/resort-map.png";

// ─── DATA ────────────────────────────────────────────────────────────────────
const HOST = {
  name: "LivingForVacation.com",
  phone: "404-441-1015",
  sms: "404-441-1015",
  email: "host@example.com",
  website: "https://www.lforv.com",
  about: "We're obsessed with making your stay unforgettable. From the moment you arrive to the second you check out, we've got you covered. Questions at midnight? Text us.",
};

const GUEST_API_KEY = import.meta.env.VITE_GUEST_API_KEY || "";
const REBOOK_DEADLINE = `December 31, ${new Date().getFullYear()}`;
const RESERVATION_CACHE_KEY = "pelican.reservation";
const LOGIN_ERROR =
  "We couldn't find a reservation for that email. Please call Philip at (404) 441-1015 and we'll get you sorted.";

const PELICAN_RESORT_NAME = "Pelican Beach Resort";
const PELICAN_STREET = "1002 Highway 98 E, Destin, FL 32541";
const PELICAN_ALLOWED_UNITS = ["1416", "1416-PBR"];

const PELICAN_CONFIG = {
  street: PELICAN_STREET,
  unitLine: "Unit 1416",
  photo: pelicanHero,
  guests: 4,
  bedrooms: 2,
  bathrooms: 2,
  wifi: { name: "pelican-guest.encowifi.com", password: "54541884" },
  cleaning: "Lemon Fresh Cleaning",
};

function getActiveReservation(session) {
  if (!session?.reservations?.length) return null;
  const item =
    session.reservations.find((r) => r.id === session.default_reservation_id) ||
    session.reservations[0];
  if (!item) return null;
  return {
    ...item,
    guest_name: session.guest_name,
    email: session.email,
  };
}

function isSupportedGuestSession(session) {
  const active = getActiveReservation(session);
  return Boolean(active?.unit && PELICAN_ALLOWED_UNITS.includes(active.unit));
}

function normalizeGuestSessionForCompare(session) {
  return {
    guest_name: session.guest_name,
    email: session.email,
    default_reservation_id: session.default_reservation_id,
    reservations: [...session.reservations]
      .sort((a, b) => a.id - b.id)
      .map((r) => ({
        id: r.id,
        unit: r.unit,
        property_name: r.property_name,
        check_in: r.check_in,
        check_out: r.check_out,
        door_code: r.door_code,
        stay_phase: r.stay_phase,
        num_guests: r.num_guests,
      })),
  };
}

function guestSessionsEqual(a, b) {
  if (!a || !b) return false;
  return (
    JSON.stringify(normalizeGuestSessionForCompare(a)) ===
    JSON.stringify(normalizeGuestSessionForCompare(b))
  );
}

function readCachedGuestSession() {
  try {
    const cached = localStorage.getItem(RESERVATION_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed.reservations) && isSupportedGuestSession(parsed)) {
      return parsed;
    }
    localStorage.removeItem(RESERVATION_CACHE_KEY);
  } catch {
    localStorage.removeItem(RESERVATION_CACHE_KEY);
  }
  return null;
}

async function refreshGuestSession(email) {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized || !GUEST_API_KEY) return null;
  try {
    const res = await fetch(
      `/api/guest/reservation?email=${encodeURIComponent(normalized)}`,
      { headers: { "X-Guest-API-Key": GUEST_API_KEY } },
    );
    if (res.status === 404) return { revoked: true };
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data.reservations) || !data.reservations.length) return { revoked: true };
    if (!isSupportedGuestSession(data)) return null;
    return data;
  } catch {
    return null;
  }
}

async function fetchReservation(email) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error(LOGIN_ERROR);
  try {
    const res = await fetch(
      `/api/guest/reservation?email=${encodeURIComponent(normalized)}`,
      { headers: { "X-Guest-API-Key": GUEST_API_KEY } },
    );
    if (!res.ok) throw new Error(LOGIN_ERROR);
    const data = await res.json();
    if (!Array.isArray(data.reservations) || !data.reservations.length) {
      throw new Error(LOGIN_ERROR);
    }
    if (!isSupportedGuestSession(data)) {
      throw new Error(LOGIN_ERROR);
    }
    return data;
  } catch (err) {
    if (err.message === LOGIN_ERROR) throw err;
    throw new Error(LOGIN_ERROR);
  }
}

function guestFirstName(guestName) {
  return (guestName || "Guest").trim().split(/\s+/)[0];
}

function checkInAtFromDate(checkIn) {
  return `${checkIn}T16:00:00`;
}

function checkOutAtFromDate(checkOut) {
  return `${checkOut}T10:00:00`;
}

function formatDisplayDate(isoDate) {
  const d = new Date(`${isoDate}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function getPreviousStays(guestSession) {
  if (!guestSession?.reservations?.length) return [];
  return guestSession.reservations.filter((r) => r.stay_phase === "past");
}

function formatStayDateRange(checkIn, checkOut) {
  if (!checkIn || !checkOut) return "—";
  return `${formatDisplayDate(checkIn)} – ${formatDisplayDate(checkOut)}`;
}

function displayUnitNumber(unit) {
  return String(unit).replace(/-PBR$/i, "");
}

function getProperty(reservation) {
  const unitNum = displayUnitNumber(reservation.unit);
  return {
    ...PELICAN_CONFIG,
    address: PELICAN_STREET,
    headerTitle: `${PELICAN_RESORT_NAME} - Condo# ${unitNum}`,
    name: `Condo# ${unitNum}`,
    host: HOST,
    checkIn: {
      date: formatDisplayDate(reservation.check_in),
      time: "4:00 PM",
    },
    checkOut: {
      date: formatDisplayDate(reservation.check_out),
      time: "10:00 AM",
    },
  };
}

const PARKING_NOTE =
  "Pull up to the security hut at the entrance gate and let them know you're checking into Unit 1416. You'll be directed to the lobby to get your parking pass. If there's a line, one person can wait while the rest of the group unloads and heads to the room. There's a 20-minute limit in the unloading area — security does enforce this, so please be quick.";

const DIRECTIONS_NOTE =
  "There are elevators in the main lobby and the back side of the building. Our condo is on the 14th floor. When you exit either elevator, follow the walkway down to Unit 1416. The back elevator is closer to the condo and a faster walk.";

// Per-unit door entry instructions (below the code display), keyed by unit number.
const DOOR_ENTRY_BY_UNIT = {
  "1416": "Enter on the keypad.",
};

function getDoorEntryNote(unit) {
  return DOOR_ENTRY_BY_UNIT[displayUnitNumber(unit)] ?? "";
}

const DOOR_ACCESS_NOTE =
  "No physical keys needed — your entry code is active only during your stay dates. Need an early check-in or late checkout? Contact us ahead of time so we can adjust your code. If the entry system ever fails, there's a manual key override — the lock box is on the exterior door. Call (404) 441-1015 for any access issues.";

const TV_REMOTES_NOTE =
  "Use the COX remote to turn on the TV and change channels/access the guide. Use the Samsung remote to access Netflix via the HUB button.";

// ─── CHECKOUT ─────────────────────────────────────────────────────────────────
const CHECKOUT_NOTICE =
  "Check-out is 10 AM. Need more time? Contact us in advance for approval. If housekeeping can't access your unit at checkout, a $100 fine applies.";

const CHECKOUT_ITEMS = [
  "Make sure no trash is on the deck",
  "Empty the kitchen trash can — trash chute is across from the back elevator; go right outside the door and follow the walkway to its end",
  "Pile all towels on the bathroom floor",
  "Return all beach supplies to the closet",
  "Run the dishwasher (doesn't need to be unloaded) — $40 fine if skipped",
  "If you used the living room throw blankets, wash/dry them and return them to the TV buffet",
  "Sweep sand off all floors in living areas; wipe sand off countertops and sinks",
];

function buildGuideSections(property, reservation) {
  const unitNum = displayUnitNumber(reservation.unit);
  return {
    welcome: {
      title: "Welcome",
      content: `You made it! 🎉 Unit ${unitNum} is all yours until ${property.checkOut.date}. We've stocked the essentials and left you the best view on the floor. Need anything at all — Sunny's got answers, and so do we.`,
    },
    rules: [
      "No smoking inside the unit or on the balcony",
      `No parties or events — max ${property.guests} guests`,
      "Quiet hours: 11:00 PM – 7:00 AM",
      "No pets",
      "Respect your neighbors — this is a residential resort community",
    ],
    faq: [
      { q: "What's the WiFi password?", a: `Network: ${property.wifi.name} · Password: ${property.wifi.password} — also on the fridge magnet.` },
      {
        q: "How do I get my Door Code?",
        a: "Your Door Code will appear 24 hours prior to check-in. No physical keys needed — your entry code is active only during your stay dates. Need an early check-in or late checkout? Contact us ahead of time so we can adjust your code. If the entry system ever fails, there's a manual key override — the lock box is on the exterior door. Call (404) 441-1015 for any access issues.",
      },
      { q: "Where do I park?", a: PARKING_NOTE },
      { q: "What type of coffee maker is in the condo?", a: "Coffee maker is a dual drip and K Cup machine." },
      { q: "Pool hours?", a: "The resort pool is open 8 AM – 10 PM. Heated seasonally. Towels are rolled up in the book case." },
      { q: "What's the beach flag system?", a: "🟢 Green: calm. 🟡 Yellow: moderate surf/currents, swim with caution. 🔴 Red: high hazard, no swimming. 🟣 Purple: dangerous marine life. Double red = beach closed. Always check before you go in." },
      { q: "Checkout is when?", a: `${property.checkOut.time} on ${property.checkOut.date}. Late checkout may be available — text us 24hrs ahead.` },
    ],
    safety: "In any emergency, call 911. Fire extinguisher is in the kitchen cabinet under the sink. First aid kit is in the master bathroom.",
    travel: "Save this page to your home screen for offline access — tap the share button in your browser and select 'Add to Home Screen.'",
  };
}

const EMERGENCY_CONTACTS = [
  { icon: "🚓", label: "Police (Non-Emergency)", org: "Okaloosa County Sheriff's Office", num: "(850) 651-7400" },
  { icon: "🏥", label: "Hospital", org: "HCA Florida Fort Walton-Destin Hospital", num: "(850) 862-1111", addr: "1000 Mar Walt Dr, Fort Walton Beach, FL 32547" },
  { icon: "⚕️", label: "Closest Emergency Room (Destin)", org: "HCA Florida Destin Emergency", num: "(850) 837-9194", addr: "200 Tequesta Dr, Destin, FL 32541" },
  { icon: "💊", label: "Pharmacy", org: "Walgreens Pharmacy", num: "(850) 650-4538", addr: "977 US-98, Destin, FL 32541" },
];

// ─── ICONS ───────────────────────────────────────────────────────────────────
const Icon = ({ name, size = 22, color = "currentColor" }) => {
  const icons = {
    home: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
    book: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg>,
    contact: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.66A2 2 0 012 .18h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.9v2.02z"/></svg>,
    sun: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
    copy: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
    lock: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
    wifi: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0114.08 0"/><path d="M1.42 9a16 16 0 0121.16 0"/><path d="M8.53 16.11a6 6 0 016.95 0"/><circle cx="12" cy="20" r="1" fill={color}/></svg>,
    arrow: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
    map: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
    phone: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.66A2 2 0 012 .18h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.9v2.02z"/></svg>,
    mail: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
    msg: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
    send: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>,
    chevron: <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
    check: <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
    helpcircle: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    calendar: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  };
  return icons[name] || null;
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const useCopy = () => {
  const [copied, setCopied] = useState(null);
  const copy = (text, key) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  };
  return [copied, copy];
};

const EmergencyContactsList = () => (
  <div>
    {EMERGENCY_CONTACTS.map((c, i) => (
      <div key={c.label} style={{ padding: "10px 0", borderBottom: i < EMERGENCY_CONTACTS.length - 1 ? "1px solid #f3f4f6" : "none" }}>
        <div style={{ fontSize: 13, color: "#1a1a2e", lineHeight: 1.55 }}>
          {c.icon} {c.label}: {c.org} —{" "}
          <a href={`tel:${c.num.replace(/\D/g, "")}`} style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>{c.num}</a>
        </div>
        {c.addr && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(c.addr)}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "flex-start", gap: 4, marginTop: 4, color: "#0c8595", textDecoration: "none", fontSize: 12.5, lineHeight: 1.35 }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="map" size={13} color="#0c8595" /></span>
            {c.addr}
          </a>
        )}
      </div>
    ))}
  </div>
);

// Door code hides at 11:00 AM local on checkout day (client-side only).
function getDoorCodeExpireMs(checkOutAt) {
  const d = new Date(checkOutAt);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 11, 0, 0, 0).getTime();
}

function isDoorCodeExpired(reservation, now = Date.now()) {
  return now >= getDoorCodeExpireMs(checkOutAtFromDate(reservation.check_out));
}

function hasDoorCode(reservation) {
  return Boolean(String(reservation?.door_code ?? "").trim());
}

function useHourlyNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ─── SUNNY AI ─────────────────────────────────────────────────────────────────
function buildSunnyContext(reservation, property, now = Date.now()) {
  const unitNum = displayUnitNumber(reservation.unit);
  const codeUnlockMs =
    new Date(checkInAtFromDate(reservation.check_in)).getTime() - 24 * 60 * 60 * 1000;
  const codeUnlocked = now >= codeUnlockMs;

  let accessBlock;
  if (isDoorCodeExpired(reservation, now)) {
    accessBlock =
      "ACCESS CODE: unavailable — guest has checked out; do not share a code. Direct them to contact the host if locked out.";
  } else if (codeUnlocked && !hasDoorCode(reservation)) {
    accessBlock =
      "ACCESS CODE: not loaded yet — if the guest asks for their door code, tell them to text Philip at (404) 441-1015 for their door code. Do not guess or make up a code.";
  } else if (hasDoorCode(reservation)) {
    accessBlock = `ACCESS CODE: ${reservation.door_code}`;
  } else {
    accessBlock =
      "ACCESS CODE: not yet available — unlocks 24 hours before check-in. Do not share a code.";
  }
  return `
You are Sunny, the AI concierge for LivingForVacation at Pelican Beach Resort in Destin, FL.
You are warm, helpful, a little funny, and know this area like a local friend who lives here.
Keep answers concise and conversational — this is a phone app, not an essay.

PROPERTY: ${PELICAN_RESORT_NAME}, Unit ${unitNum}, ${property.address}
CHECK-IN: 4:00 PM | CHECK-OUT: 10:00 AM
WIFI: Network: ${property.wifi.name} | Password: ${property.wifi.password}
${accessBlock}
PARKING: ${PARKING_NOTE}
POOL HOURS: 8 AM – 10 PM (heated seasonally)
QUIET HOURS: 11 PM – 7 AM
MAX GUESTS: ${property.guests} | NO SMOKING | NO PETS | NO PARTIES

LOCAL KNOWLEDGE:
- Beach flag system: Green=safe, Yellow=caution, Red=dangerous, Purple=marine life, Double red=closed
- Nearest ER: HCA Florida Destin Emergency, 200 Tequesta Dr, Destin
- Pharmacy: Walgreens, 977 US-98, Destin

DEPARTURE CHECKLIST: towels on bathroom floor, run dishwasher, take out trash, set thermostat to 72°, close and lock everything.

If you don't know something specific, say so and direct them to text the host at ${HOST.phone}.
Never make up information about access codes, prices, or policies you're not sure about.
`;
}

function SunnyTab({ reservation, property }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hey! I'm Sunny ☀️ — your local guide for this stay. Ask me anything about the property, the beach, where to eat, what to do, or what time checkout is. I actually live here (sort of)." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: userMsg });

      const res = await fetch("/api/sunny", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: buildSunnyContext(reservation, property),
          messages: history,
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Hmm, I hit a snag. Try texting the host directly!";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: `Lost my WiFi for a sec 😅 Try again, or text the host at ${HOST.phone}.` }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f7f9fc" }}>
      {/* Header */}
      <div style={{ background: "#fff", padding: "16px 20px 12px", borderBottom: "1px solid #eef0f4", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={lfvSun} alt="Sunny" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "contain" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>Sunny</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Your Destin local guide</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 0" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && (
              <img src={lfvSun} alt="Sunny" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "contain", flexShrink: 0, marginRight: 8, alignSelf: "flex-end" }} />
            )}
            <div style={{
              maxWidth: "78%", padding: "10px 14px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              background: m.role === "user" ? "#2563eb" : "#fff",
              color: m.role === "user" ? "#fff" : "#1a1a2e",
              fontSize: 14, lineHeight: 1.5,
              boxShadow: m.role === "assistant" ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
            }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <img src={lfvSun} alt="Sunny" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "contain" }} />
            <div style={{ background: "#fff", padding: "10px 16px", borderRadius: "18px 18px 18px 4px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {[0,1,2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#9ca3af", animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} style={{ height: 8 }} />
      </div>

      {/* Input */}
      <div style={{ padding: "12px 16px 16px", background: "#fff", borderTop: "1px solid #eef0f4", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Ask Sunny anything..."
            style={{ flex: 1, padding: "11px 16px", borderRadius: 24, border: "1.5px solid #e5e7eb", fontSize: 14, outline: "none", background: "#f7f9fc", color: "#1a1a2e" }}
          />
          <button onClick={send} disabled={!input.trim() || loading} style={{ width: 42, height: 42, borderRadius: "50%", background: input.trim() ? "#2563eb" : "#e5e7eb", border: "none", cursor: input.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.2s", flexShrink: 0 }}>
            <Icon name="send" size={16} color={input.trim() ? "#fff" : "#9ca3af"} />
          </button>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["Pool hours?", "Best seafood?", "Checkout checklist", "Beach flags?"].map(q => (
            <button key={q} onClick={() => { setInput(q); }} style={{ padding: "5px 12px", borderRadius: 20, border: "1.5px solid #e5e7eb", background: "#fff", fontSize: 12, color: "#4b5563", cursor: "pointer" }}>{q}</button>
          ))}
        </div>
      </div>
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}

// ─── STAY TAB ─────────────────────────────────────────────────────────────────
function StayTab({ reservation, property }) {
  const [copied, copy] = useCopy();
  const [checked, setChecked] = useState({});
  const now = useHourlyNow();

  // Door code unlocks 24 hours before check-in.
  const codeUnlockMs = new Date(checkInAtFromDate(reservation.check_in)).getTime() - 24 * 60 * 60 * 1000;
  const codeUnlocked = now >= codeUnlockMs;
  const codeExpired = isDoorCodeExpired(reservation, now);
  const doorCodeReady = hasDoorCode(reservation);
  const doorEntryNote = getDoorEntryNote(reservation.unit);
  const mapQuery = `${property.street}, ${property.unitLine}`;

  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
      {/* Welcome banner */}
      <div style={{ background: "linear-gradient(135deg, #0ea5b7, #0c8595)", color: "#fff", padding: "16px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Welcome, {guestFirstName(reservation.guest_name)}! 👋</div>
        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 2 }}>{property.headerTitle}</div>
      </div>

      {/* Hero */}
      <div style={{ position: "relative", height: 200 }}>
        <img src={property.photo} alt="property" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>

      <div style={{ padding: "16px 16px 16px" }}>
        {/* Reservation */}
        <Card>
          <SectionLabel>Reservation Info</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0" }}>
            <DateBox label="Check-in" date={property.checkIn.date} time={property.checkIn.time} />
            <div style={{ flex: 1, height: 1, background: "#e5e7eb", position: "relative" }}>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "#fff", padding: "0 4px" }}>
                <Icon name="arrow" size={14} color="#9ca3af" />
              </div>
            </div>
            <DateBox label="Check-out" date={property.checkOut.date} time={property.checkOut.time} right />
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
            {[["👥", reservation.num_guests, "Guests"], ["🛏", property.bedrooms, "Bedrooms"], ["🚿", property.bathrooms, "Bathrooms"]].map(([icon, val, label]) => (
              <div key={label} style={{ textAlign: "center", flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{icon} {val}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Map */}
        <Card>
          <SectionLabel>Getting Here</SectionLabel>
          <div style={{ margin: "12px 0", borderRadius: 10, overflow: "hidden", height: 140, background: "#e5e7eb", position: "relative" }}>
            <iframe
              title="map"
              key={mapQuery}
              width="100%" height="140"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed&z=15`}
            />
          </div>
          <AddressRow address={property.address} copied={copied} onCopy={copy} />
        </Card>

        {/* Door code */}
        <Card>
          <SectionLabel>🔒 Door code</SectionLabel>
          {!codeUnlocked ? (
            <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6, margin: "10px 0 0" }}>
              Unlocks 24 hours before check-in — see the Door Code FAQ for details.
            </p>
          ) : codeExpired ? (
            <p style={{ fontSize: 18, fontWeight: 700, color: "#0c8595", textAlign: "center", margin: "16px 0 4px" }}>
              See you next time! 👋
            </p>
          ) : !doorCodeReady ? (
            <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6, margin: "10px 0 0" }}>
              We don't have your code loaded yet — text Philip at (404) 441-1015 and he'll get you in.
            </p>
          ) : (
            <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
              <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 8, fontFamily: "ui-monospace, Consolas, monospace", color: "#0c8595" }}>{reservation.door_code}</div>
              {doorEntryNote && (
                <p style={{ fontSize: 13, color: "#6b7280", margin: "6px 0 0" }}>{doorEntryNote}</p>
              )}
            </div>
          )}
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
            <SectionLabel>🅿️ Parking</SectionLabel>
            <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6, margin: "8px 0 0" }}>
              {PARKING_NOTE}
            </p>
          </div>
          <div style={{ marginTop: 12 }}>
            <SectionLabel>🚪 Finding your condo</SectionLabel>
            <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6, margin: "8px 0 0" }}>
              {DIRECTIONS_NOTE}
            </p>
          </div>
        </Card>

        {/* WiFi */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <SectionLabel>WiFi</SectionLabel>
            <Icon name="wifi" size={18} color="#2563eb" />
          </div>
          {[["Wifi Name", property.wifi.name, "wifiname"], ["Wifi Password", property.wifi.password, "wifipw"]].map(([label, val, key]) => (
            <div key={key} style={{ marginTop: 10, padding: "12px 14px", background: "#f9fafb", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{val}</div>
              </div>
              <CopyBtn text={val} label={key} copied={copied} onCopy={copy} />
            </div>
          ))}
        </Card>

        {/* TV Remotes */}
        <Card>
          <SectionLabel>TV Remotes</SectionLabel>
          <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6, margin: "10px 0 0" }}>{TV_REMOTES_NOTE}</p>
        </Card>

        {/* Checkout checklist */}
        <Card>
          <SectionLabel>Checkout checklist</SectionLabel>
          <div style={{ marginTop: 10, padding: "10px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, fontSize: 12.5, color: "#92400e", lineHeight: 1.5 }}>
            ⚠️ {CHECKOUT_NOTICE}
          </div>
          <div style={{ marginTop: 10 }}>
            {CHECKOUT_ITEMS.map((item, i) => (
              <label key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", cursor: "pointer", borderBottom: i < CHECKOUT_ITEMS.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                <input type="checkbox" checked={!!checked[i]} onChange={() => setChecked(c => ({ ...c, [i]: !c[i] }))} style={{ marginTop: 2, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: checked[i] ? "#9ca3af" : "#4b5563", textDecoration: checked[i] ? "line-through" : "none", lineHeight: 1.45 }}>{item}</span>
              </label>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── GUIDE TAB ────────────────────────────────────────────────────────────────
// Resort tab — add Pelican Beach map, on-property dining, and amenities here.
const RESORT_MAP = resortMap;
const RESORT_DINING = [
  { name: "Pelican Beach Cafè (Jan-Oct)", loc: "Breakfast and Lunch" },
];
const RESORT_AMENITIES = [
  {
    name: "Resort Amenities",
    items: [
      "Pelican Beach Cafè (seasonal)",
      "Complimentary High Speed Internet Access",
      "Three heated swimming pools and two kiddie pools",
      "Seven (7) gas grills at grill station between the Cafe and side pool",
      "Tennis courts and Pickle Ball Courts",
      "Video game room",
      "Poolside hot tub",
      "Fitness room",
      "Conference/meeting facilities",
      "24 hour Front Desk",
      "Beachside/poolside Tiki bar (seasonal)",
      "Covered parking",
    ],
  },
];

const GuideBullet = ({ item }) => {
  const it = typeof item === "string" ? { name: item } : item;
  const mapsUrl = it.addr ? `https://maps.google.com/?q=${encodeURIComponent(it.addr)}` : null;
  const titleStyle = { fontWeight: 600, fontSize: 13, lineHeight: 1.45 };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 0", fontSize: 13, lineHeight: 1.45 }}>
      <span style={{ color: "#0c8595", flexShrink: 0 }}>•</span>
      <div>
        {it.href ? (
          <a href={it.href} target="_blank" rel="noopener noreferrer" style={{ ...titleStyle, color: "#0c8595", textDecoration: "none" }}>{it.name}</a>
        ) : (
          <div style={{ ...titleStyle, color: "#1a1a2e" }}>{it.name}</div>
        )}
        {it.detail && <div style={{ color: "#6b7280", marginTop: 1 }}>{it.detail}</div>}
        {it.link && (
          <div style={{ marginTop: 6, color: "#4b5563" }}>
            {it.link.prefix}
            <a href={it.link.href} target="_blank" rel="noopener noreferrer" style={{ color: "#0c8595", textDecoration: "none", fontWeight: 600 }}>
              {it.link.label}
            </a>
          </div>
        )}
        {mapsUrl && (
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "flex-start", gap: 4, marginTop: 3, color: "#0c8595", textDecoration: "none", fontSize: 12.5, lineHeight: 1.35 }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}><Icon name="map" size={13} color="#0c8595" /></span>
            {it.addr}
          </a>
        )}
      </div>
    </div>
  );
};

// Local Guide tab — Pelican Beach / Destin area recommendations.
const LOCAL_GUIDE = [
  {
    name: "Groceries",
    items: [
      { name: "Walmart Supercenter", detail: "1.8 mi", addr: "15017 Emerald Coast Pkwy, Destin, FL" },
      { name: "Fresh Market", detail: "2.8 mi", addr: "4495 Commons Dr W, Destin, FL" },
      { name: "Kroger", detail: "3.1 mi", addr: "4425 Commons Dr E, Destin, FL" },
      { name: "Whole Foods", detail: "3.6 mi", addr: "4402 Legendary Dr, Destin, FL" },
    ],
  },
  {
    name: "Beaches",
    items: [
      {
        name: "Pelican Beach Resort",
        detail: "We provide you 2 chairs and an umbrella. Waterfront setups are available by rental only. Please book as early as possible if you chose to. The information is below:",
        link: {
          prefix: "Chair Rentals - ",
          label: "La Dolce Vita",
          href: "https://ldvbeach.com/destin/pelican-beach-resort/beach-chairs-umbrellas",
        },
      },
      { name: "Henderson Beach State Park", detail: "1.8 mi east, 3 parking areas", addr: "17000 Emerald Coast Pkwy, Destin, FL" },
    ],
  },
  {
    name: "Breakfast",
    items: [
      { name: "Pelican Beach Cafe", detail: "On-site · (850) 654-1425" },
      { name: "Crackings", detail: "Formerly Another Broken Egg — highly recommended", addr: "979 Hwy 98 E Ste 4, Destin, FL" },
      { name: "Donut Hole Bakery Cafe", detail: "Destin landmark", addr: "635 Harbor Blvd, Destin, FL" },
      { name: "Pancakery", addr: "960 Hwy 98 Ste 104, Destin, FL" },
    ],
  },
  {
    name: "Dinner",
    groups: [
      {
        label: "Pickup / Delivery",
        items: [
          { name: "Destin Ice Seafood Market & Deli", detail: "Low country boil/steamed shrimp — they cook it for you · (850) 837-8333", addr: "663 Harbor Blvd, Destin, FL" },
          { name: "Crockpot Dinner", detail: "DIY — 12qt crockpot provided" },
          { name: "Merlin's Pizza", detail: "Delivers · (850) 650-3000" },
          { name: "Thai Delights", detail: "(850) 650-3945", addr: "821 Harbor Blvd, Destin, FL" },
        ],
      },
      {
        label: "Dining Out",
        items: [
          { name: "Louisiana Lagniappe", detail: "Top recommendation — fresh seafood and Cajun · (850) 837-0881", addr: "775 Gulf Shore Dr, Destin, FL" },
          { name: "TripAdvisor's Destin Dining Guide", href: "https://www.tripadvisor.com/Restaurants-g34182-Destin_Florida.html" },
          { name: "Yelp Dining Guide", href: "https://www.yelp.com/search?find_desc=Best+Restaurants&find_loc=Destin%2C+FL+32541" },
        ],
      },
    ],
  },
];

// Shown on the General tab (above FAQs), not Local Guide.
const GENERAL_SECTIONS = [
  {
    name: "What's Provided In Your Condo",
    collapsed: true,
    groups: [
      { label: "Kitchen", inline: true, items: ["Frying pans", "Sauce pots", "Steam pot", "12qt crockpot", "Dual drip and K Cup coffee maker", "Blender", "Mixer", "Cutting boards", "Mixing bowls", "Cookie sheets", "Muffin pan", "Kitchen towels"] },
      { label: "Bath (each bathroom)", inline: true, items: ["2 rolls TP", "3 sets of towels (under sink)", "Travel-size shampoo/conditioner/soap", "Hand soap", "Hair dryer", "10x lighted mirror (master bath only)"], note: "Sheets for the pull-out sofa are in the master bedroom closet." },
      { label: "Cleaning", inline: true, items: ["Paper towels", "All-purpose cleaner", "Sponge", "Trash bags", "Dish soap", "Dishwasher tabs", "Laundry detergent & dryer sheets (on top of washer/dryer machine)"] },
      { label: "Beach gear", inline: true, items: ["2 beach chairs", "Umbrella", "12pk cooler", "4 pool towels"] },
    ],
  },
  {
    name: "What To Bring",
    groups: [
      { label: "Short stay (3 days or less)", inline: true, items: ["You should have everything you need provided."] },
      { label: "Longer stay (4+ days)", inline: true, items: ["Extra shampoo/conditioner/soap", "Paper towels", "Toilet paper"] },
    ],
  },
];

// Reusable collapsible section card (used by Local Guide and General tabs).
const GuideSection = ({ s, open, onToggle }) => (
  <Card>
    <button onClick={onToggle} style={{ width: "100%", padding: 0, background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}>
      <SectionLabel>{s.name}</SectionLabel>
      <div style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
        <Icon name="chevron" size={16} color="#9ca3af" />
      </div>
    </button>
    {open && (
      <div style={{ marginTop: 10 }}>
        {s.items && s.items.map((item, j) => <GuideBullet key={j} item={item} />)}
        {s.note && <p style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", margin: "8px 0 0", lineHeight: 1.5 }}>💡 {s.note}</p>}
        {s.groups && s.groups.map((g) => (
          <div key={g.label}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", margin: "10px 0 4px" }}>{g.label}</div>
            {g.items && (g.inline
              ? <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6, margin: 0 }}>{g.items.join(", ")}</p>
              : g.items.map((item, j) => <GuideBullet key={j} item={item} />))}
            {g.subgroups && g.subgroups.map((sg) => (
              <div key={sg.label}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#0c8595", margin: "8px 0 2px" }}>{sg.label}</div>
                {sg.items.map((item, j) => <GuideBullet key={j} item={item} />)}
              </div>
            ))}
            {g.note && <p style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", margin: "6px 0 0", lineHeight: 1.5 }}>{g.note}</p>}
          </div>
        ))}
      </div>
    )}
  </Card>
);

function GuideTab({ reservation, property }) {
  const guideSections = buildGuideSections(property, reservation);
  const [subTab, setSubTab] = useState("general");
  const [openFaq, setOpenFaq] = useState(null);
  const [openBuilding, setOpenBuilding] = useState(() => (RESORT_AMENITIES.length === 1 ? 0 : null));
  const [mapZoom, setMapZoom] = useState(false);
  const [openLocal, setOpenLocal] = useState(() =>
    Object.fromEntries(LOCAL_GUIDE.map((s, i) => [i, !s.collapsed]))
  );
  const [openGeneral, setOpenGeneral] = useState(() =>
    Object.fromEntries(GENERAL_SECTIONS.map((s, i) => [i, !s.collapsed]))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Property mini-header */}
      <div style={{ padding: "14px 16px 0", background: "#fff" }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: "#1a1a2e" }}>{property.headerTitle}</div>
        <div style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
          <Icon name="map" size={12} color="#9ca3af" /> {property.address}
        </div>
        {/* Sub-tabs */}
        <div style={{ display: "flex", gap: 0, marginTop: 14, borderBottom: "1px solid #e5e7eb" }}>
          {[["resort","Resort"],["general","General"],["local","Local Guide"]].map(([key, label]) => (
            <button key={key} onClick={() => setSubTab(key)} style={{ flex: 1, padding: "8px 4px", background: "none", border: "none", borderBottom: subTab === key ? "2px solid #2563eb" : "2px solid transparent", color: subTab === key ? "#2563eb" : "#6b7280", fontSize: 12, fontWeight: subTab === key ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 16px" }}>
        {subTab === "general" && (
          <>
            {GENERAL_SECTIONS.map((s, i) => (
              <GuideSection key={s.name} s={s} open={openGeneral[i]} onToggle={() => setOpenGeneral(o => ({ ...o, [i]: !o[i] }))} />
            ))}
            <Card>
              <SectionLabel>FAQs</SectionLabel>
              <div style={{ marginTop: 8 }}>
                {guideSections.faq.map((item, i) => (
                  <div key={i} style={{ borderBottom: i < guideSections.faq.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: "100%", padding: "12px 0", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{item.q}</span>
                      <div style={{ transform: openFaq === i ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                        <Icon name="chevron" size={16} color="#9ca3af" />
                      </div>
                    </button>
                    {openFaq === i && <div style={{ padding: "0 0 12px", fontSize: 13, color: "#4b5563", lineHeight: 1.6 }}>{item.a}</div>}
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <SectionLabel>House Rules</SectionLabel>
              <div style={{ marginTop: 8 }}>
                {guideSections.rules.map((r, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#4b5563", padding: "7px 0", borderBottom: i < guideSections.rules.length - 1 ? "1px solid #f3f4f6" : "none" }}>• {r}</div>
                ))}
              </div>
            </Card>
            <Card>
              <SectionLabel>Safety Info</SectionLabel>
              <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6, margin: "8px 0 0" }}>{guideSections.safety}</p>
              <EmergencyContactsList />
            </Card>
            <Card>
              <SectionLabel>Travel Tips</SectionLabel>
              <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6, margin: "8px 0 0" }}>{guideSections.travel}</p>
            </Card>
          </>
        )}

        {subTab === "local" && (
          <>
            {LOCAL_GUIDE.length === 0 ? (
              <Card>
                <SectionLabel>Local Guide</SectionLabel>
                <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, margin: "10px 0 0" }}>
                  Pelican Beach-area recommendations coming soon — groceries, dining, and things to do.
                </p>
              </Card>
            ) : (
              LOCAL_GUIDE.map((s, i) => (
                <GuideSection key={s.name} s={s} open={openLocal[i]} onToggle={() => setOpenLocal(o => ({ ...o, [i]: !o[i] }))} />
              ))
            )}
          </>
        )}

        {subTab === "resort" && (
          <>
            <Card>
              <SectionLabel>Resort Map</SectionLabel>
              {RESORT_MAP ? (
                <>
                  <button onClick={() => setMapZoom(true)} style={{ display: "block", width: "100%", marginTop: 10, padding: 0, border: "none", background: "none", cursor: "zoom-in", borderRadius: 10, overflow: "hidden" }}>
                    <img src={RESORT_MAP} alt="Resort map" style={{ width: "100%", display: "block", borderRadius: 10 }} />
                  </button>
                  <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 6, textAlign: "center" }}>Tap the map to zoom in</p>
                </>
              ) : (
                <div style={{ marginTop: 10, padding: "32px 16px", background: "#f3f4f6", borderRadius: 10, textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: "#6b7280", margin: 0, lineHeight: 1.5 }}>Resort map coming soon</p>
                </div>
              )}
            </Card>

            <Card>
              <SectionLabel>Dining On Property</SectionLabel>
              {RESORT_DINING.length === 0 ? (
                <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, margin: "10px 0 0" }}>
                  On-property dining options coming soon.
                </p>
              ) : (
                <div style={{ marginTop: 8 }}>
                  {RESORT_DINING.map((d, i) => (
                    <div key={d.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, padding: "8px 0", borderBottom: i < RESORT_DINING.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{d.name}</span>
                      <span style={{ fontSize: 12, color: "#6b7280", flexShrink: 0, textAlign: "right" }}>{d.loc}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {RESORT_AMENITIES.length === 0 ? (
              <Card>
                <SectionLabel>Resort Amenities</SectionLabel>
                <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, margin: "10px 0 0" }}>
                  Resort amenities and building details coming soon.
                </p>
              </Card>
            ) : (
              RESORT_AMENITIES.map((b, i) => (
                <Card key={b.name}>
                  <button onClick={() => setOpenBuilding(openBuilding === i ? null : i)} style={{ width: "100%", padding: 0, background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", textAlign: "left" }}>
                    <SectionLabel>{b.name}</SectionLabel>
                    <div style={{ transform: openBuilding === i ? "rotate(90deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }}>
                      <Icon name="chevron" size={16} color="#9ca3af" />
                    </div>
                  </button>
                  {openBuilding === i && (
                    <div style={{ marginTop: 10 }}>
                      {b.items && b.items.map((item) => (
                        <div key={item} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 0", fontSize: 13, color: "#4b5563", lineHeight: 1.4 }}>
                          <span style={{ color: "#0c8595", flexShrink: 0 }}>•</span>{item}
                        </div>
                      ))}
                      {b.groups && b.groups.map((g) => (
                        <div key={g.label}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a2e", margin: "10px 0 4px" }}>{g.label}</div>
                          {g.items.map((item) => (
                            <div key={item} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "5px 0", fontSize: 13, color: "#4b5563", lineHeight: 1.4 }}>
                              <span style={{ color: "#0c8595", flexShrink: 0 }}>•</span>{item}
                            </div>
                          ))}
                        </div>
                      ))}
                      {b.note && <p style={{ fontSize: 12, color: "#6b7280", fontStyle: "italic", margin: "10px 0 0" }}>** {b.note}</p>}
                    </div>
                  )}
                </Card>
              ))
            )}
          </>
        )}
      </div>

      {mapZoom && RESORT_MAP && (
        <div onClick={() => setMapZoom(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
          <img src={RESORT_MAP} alt="Resort map" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
          <button onClick={() => setMapZoom(false)} style={{ position: "absolute", top: 16, right: 16, width: 36, height: 36, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.9)", color: "#1a1a2e", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
      )}
    </div>
  );
}

// ─── CONTACT TAB ──────────────────────────────────────────────────────────────
function ContactTab({ reservation, property }) {
  const unitNum = displayUnitNumber(reservation.unit);
  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "16px 16px 16px" }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <img src={lfvSun} alt={property.host.name} style={{ width: 52, height: 52, borderRadius: 12, objectFit: "contain" }} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>{property.host.name}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Vacation Rental Host</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6, margin: "0 0 16px" }}>{property.host.about}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <ActionBtn icon="phone" label="Call" href={`tel:${property.host.phone}`} />
          <ActionBtn icon="msg" label="Text" href={`sms:${property.host.sms}`} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <ActionBtn icon="mail" label="Email" href={`mailto:${property.host.email}`} />
          <ActionBtn icon="map" label="Website" href={property.host.website} />
        </div>
      </Card>

      <Card>
        <SectionLabel>Cleaning Crew</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🍋</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a2e" }}>{property.cleaning}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Keeping Unit {unitNum} fresh</div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionLabel>Emergency Contacts</SectionLabel>
        <div style={{ marginTop: 8 }}>
          <div style={{ padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ fontSize: 13, color: "#1a1a2e", lineHeight: 1.55 }}>
              🚨 Emergency —{" "}
              <a href="tel:911" style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}>911</a>
            </div>
          </div>
          <EmergencyContactsList />
        </div>
      </Card>
    </div>
  );
}

// ─── REBOOK TAB ───────────────────────────────────────────────────────────────
const REBOOK_MIN_NIGHTS = 4;
const REBOOK_DATE_INPUT_STYLE = {
  width: "100%",
  padding: "12px",
  fontSize: 14,
  border: "1.5px solid #e5e7eb",
  borderRadius: 10,
  color: "#1a1a2e",
  boxSizing: "border-box",
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayDateKey() {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
}

function compareDateKeys(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function addDaysToDateKey(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

function nightsBetweenKeys(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const [iy, im, id] = checkIn.split("-").map(Number);
  const [oy, om, od] = checkOut.split("-").map(Number);
  return Math.round((Date.UTC(oy, om - 1, od) - Date.UTC(iy, im - 1, id)) / 86400000);
}

function normalizeStayRanges(stays) {
  return (stays || [])
    .map((stay) => ({
      checkIn: stay.check_in || stay.checkIn,
      checkOut: stay.check_out || stay.checkOut,
    }))
    .filter((stay) => stay.checkIn && stay.checkOut);
}

function hasCheckInOnDay(stayRanges, key) {
  return stayRanges.some((stay) => stay.checkIn === key);
}

function isInteriorNight(stayRanges, key) {
  return stayRanges.some(
    (stay) => compareDateKeys(stay.checkIn, key) < 0 && compareDateKeys(key, stay.checkOut) < 0,
  );
}

function isBlockedKey(stayRanges, blockedRanges, key) {
  for (const range of blockedRanges || []) {
    if (compareDateKeys(key, range.start) >= 0 && compareDateKeys(key, range.end) <= 0) {
      return true;
    }
  }
  return false;
}

function isOccupiedNightForDisplay(stayRanges, blockedRanges, key) {
  if (isInteriorNight(stayRanges, key)) return true;
  if (hasCheckInOnDay(stayRanges, key)) return true;
  if (!stayRanges.length) {
    for (const range of blockedRanges || []) {
      const interiorStart = addDaysToDateKey(range.start, 1);
      if (compareDateKeys(interiorStart, key) <= 0 && compareDateKeys(key, range.end) <= 0) {
        return true;
      }
    }
  }
  return isBlockedKey(stayRanges, blockedRanges, key);
}

function stayRangeIsValid(stayRanges, blockedRanges, checkIn, checkOut) {
  if (!checkIn || !checkOut || compareDateKeys(checkOut, checkIn) <= 0) return false;
  let d = checkIn;
  while (compareDateKeys(d, checkOut) < 0) {
    if (
      isBlockedKey(stayRanges, blockedRanges, d) ||
      isInteriorNight(stayRanges, d) ||
      hasCheckInOnDay(stayRanges, d)
    ) {
      return false;
    }
    d = addDaysToDateKey(d, 1);
  }
  return true;
}

function checkOutPickAllowed(stayRanges, blockedRanges, checkIn, checkOutKey) {
  return stayRangeIsValid(stayRanges, blockedRanges, checkIn, checkOutKey);
}

function calendarDaySelectable(stayRanges, blockedRanges, key, checkIn, checkOut) {
  if (compareDateKeys(key, todayDateKey()) < 0) return false;
  const pickCheckout = !!(checkIn && !checkOut);
  if (pickCheckout) {
    return checkOutPickAllowed(stayRanges, blockedRanges, checkIn, key);
  }
  if (isBlockedKey(stayRanges, blockedRanges, key)) return false;
  if (isInteriorNight(stayRanges, key) || hasCheckInOnDay(stayRanges, key)) return false;
  return true;
}

function checkInPickAllowed(stayRanges, blockedRanges, key) {
  if (compareDateKeys(key, todayDateKey()) < 0) return false;
  if (isBlockedKey(stayRanges, blockedRanges, key)) return false;
  if (isInteriorNight(stayRanges, key) || hasCheckInOnDay(stayRanges, key)) return false;
  return true;
}

async function fetchUnitAvailability(unit) {
  const normalizedUnit = (unit || "").trim();
  if (!normalizedUnit) {
    console.error("[fetchUnitAvailability] missing unit parameter");
    return null;
  }
  if (!GUEST_API_KEY) {
    console.error("[fetchUnitAvailability] VITE_GUEST_API_KEY is not configured in this build");
    return null;
  }

  const url = `/api/guest/availability?unit=${encodeURIComponent(normalizedUnit)}`;
  try {
    const res = await fetch(url, {
      headers: { "X-Guest-API-Key": GUEST_API_KEY },
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[fetchUnitAvailability] HTTP error", {
        url,
        status: res.status,
        statusText: res.statusText,
        body,
      });
      return null;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const body = await res.text();
      console.error("[fetchUnitAvailability] non-JSON response (often a login redirect or SPA fallback)", {
        url,
        contentType,
        bodyPreview: body.slice(0, 200),
      });
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("[fetchUnitAvailability] network or parse error", { url, err });
    return null;
  }
}

function RebookDatePicker({ unit, checkIn, checkOut, onChangeDates }) {
  const [stayRanges, setStayRanges] = useState([]);
  const [blockedRanges, setBlockedRanges] = useState([]);
  const [availabilityError, setAvailabilityError] = useState("");
  const [loadingAvailability, setLoadingAvailability] = useState(true);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  useEffect(() => {
    let cancelled = false;
    setLoadingAvailability(true);
    setAvailabilityError("");
    fetchUnitAvailability(unit).then((data) => {
      if (cancelled) return;
      if (!data) {
        setAvailabilityError("Could not load availability. Please try again in a moment.");
        setStayRanges([]);
        setBlockedRanges([]);
      } else {
        setStayRanges(normalizeStayRanges(data.stays));
        setBlockedRanges(Array.isArray(data.blocked) ? data.blocked : []);
      }
      setLoadingAvailability(false);
    });
    return () => {
      cancelled = true;
    };
  }, [unit]);

  useEffect(() => {
    if (loadingAvailability) return;
    if (checkIn && !checkInPickAllowed(stayRanges, blockedRanges, checkIn)) {
      onChangeDates("", "");
      return;
    }
    if (checkIn && checkOut && !stayRangeIsValid(stayRanges, blockedRanges, checkIn, checkOut)) {
      onChangeDates(checkIn, "");
    }
  }, [loadingAvailability, stayRanges, blockedRanges, checkIn, checkOut, onChangeDates]);

  const handleCheckInChange = (value) => {
    let nextCheckOut = checkOut;
    if (value && nextCheckOut && !checkOutPickAllowed(stayRanges, blockedRanges, value, nextCheckOut)) {
      nextCheckOut = "";
    }
    if (value && !checkInPickAllowed(stayRanges, blockedRanges, value)) {
      onChangeDates("", "");
      return;
    }
    onChangeDates(value, nextCheckOut);
  };

  const handleCheckOutChange = (value) => {
    if (!checkIn) {
      onChangeDates(checkIn, "");
      return;
    }
    if (value && !checkOutPickAllowed(stayRanges, blockedRanges, checkIn, value)) {
      onChangeDates(checkIn, "");
      return;
    }
    onChangeDates(checkIn, value);
  };

  const handleCalendarDayClick = (key) => {
    if (!calendarDaySelectable(stayRanges, blockedRanges, key, checkIn, checkOut)) return;
    if (!checkIn || (checkIn && checkOut)) {
      onChangeDates(key, "");
      return;
    }
    if (compareDateKeys(key, checkIn) <= 0) {
      onChangeDates(key, "");
      return;
    }
    if (checkOutPickAllowed(stayRanges, blockedRanges, checkIn, key)) {
      onChangeDates(checkIn, key);
    }
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const weekdayLabels = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const first = new Date(viewYear, viewMonth, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayKey = todayDateKey();

  const calendarDays = [];
  for (let p = 0; p < startPad; p += 1) {
    calendarDays.push({ key: `pad-${p}`, empty: true });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${viewYear}-${pad2(viewMonth + 1)}-${pad2(day)}`;
    calendarDays.push({ key, empty: false });
  }

  const shiftMonth = (delta) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: "#4b5563", margin: "8px 0 10px" }}>
        Choose your check-in and checkout dates (minimum {REBOOK_MIN_NIGHTS} nights). Unavailable dates are greyed out on the calendar.
      </p>
      <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Check-in date</label>
      <input
        type="date"
        value={checkIn}
        min={todayKey}
        onChange={(e) => handleCheckInChange(e.target.value)}
        style={{ ...REBOOK_DATE_INPUT_STYLE, marginBottom: 12 }}
      />
      <label style={{ display: "block", fontSize: 12, color: "#6b7280", marginBottom: 6 }}>Checkout date</label>
      <input
        type="date"
        value={checkOut}
        min={checkIn ? addDaysToDateKey(checkIn, 1) : todayKey}
        onChange={(e) => handleCheckOutChange(e.target.value)}
        style={{ ...REBOOK_DATE_INPUT_STYLE, marginBottom: 12 }}
        disabled={!checkIn}
      />
      <div style={{ marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: "#4b5563" }}
            aria-label="Previous month"
          >
            ←
          </button>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>
            {monthNames[viewMonth]} {viewYear}
          </div>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 8, padding: "4px 10px", cursor: "pointer", color: "#4b5563" }}
            aria-label="Next month"
          >
            →
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
          {weekdayLabels.map((label) => (
            <div key={label} style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", fontWeight: 600 }}>
              {label}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
          {calendarDays.map((day) => {
            if (day.empty) {
              return <div key={day.key} aria-hidden="true" />;
            }
            const occupied = isOccupiedNightForDisplay(stayRanges, blockedRanges, day.key);
            const past = compareDateKeys(day.key, todayKey) < 0;
            const selectable = !past && calendarDaySelectable(stayRanges, blockedRanges, day.key, checkIn, checkOut);
            const inRange =
              checkIn &&
              checkOut &&
              compareDateKeys(day.key, checkIn) >= 0 &&
              compareDateKeys(day.key, checkOut) < 0;
            const isStart = day.key === checkIn;
            const isEnd = day.key === checkOut;
            let background = "#fff";
            let color = "#1a1a2e";
            if (occupied || past) {
              background = "#e5e7eb";
              color = "#9ca3af";
            } else if (isStart || isEnd) {
              background = "#0ea5b7";
              color = "#fff";
            } else if (inRange) {
              background = "#cffafe";
              color = "#0f766e";
            }
            return (
              <button
                key={day.key}
                type="button"
                disabled={!selectable || loadingAvailability}
                onClick={() => handleCalendarDayClick(day.key)}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 8,
                  padding: "8px 0",
                  fontSize: 13,
                  fontWeight: isStart || isEnd ? 700 : 500,
                  background,
                  color,
                  cursor: selectable && !loadingAvailability ? "pointer" : "default",
                  opacity: loadingAvailability ? 0.6 : 1,
                }}
              >
                {Number(day.key.split("-")[2])}
              </button>
            );
          })}
        </div>
        {loadingAvailability && (
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, textAlign: "center" }}>Loading availability…</p>
        )}
        {availabilityError && (
          <p style={{ fontSize: 12, color: "#b45309", marginTop: 8, textAlign: "center" }}>{availabilityError}</p>
        )}
      </div>
    </div>
  );
}

function RebookPaymentForm({ paymentIntentId, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handlePay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    setSubmitting(true);
    onError("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (error) {
      onError(error.message || "Payment failed. Please try again.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status !== "succeeded") {
      onError("Payment was not completed. Please try again.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/rebook/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-API-Key": GUEST_API_KEY,
        },
        body: JSON.stringify({ payment_intent_id: paymentIntentId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not confirm your hold.");
      onSuccess(data);
    } catch (err) {
      onError(err.message || "Payment succeeded but we could not save your hold. Contact us.");
    }
    setSubmitting(false);
  };

  return (
    <form onSubmit={handlePay}>
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || submitting}
        style={{
          width: "100%",
          marginTop: 16,
          padding: "14px",
          borderRadius: 12,
          border: "none",
          background: submitting ? "#94a3b8" : "#0ea5b7",
          color: "#fff",
          fontSize: 16,
          fontWeight: 600,
          cursor: submitting ? "default" : "pointer",
        }}
      >
        {submitting ? "Processing…" : "Pay $100 deposit"}
      </button>
    </form>
  );
}

function RebookTab({ reservation, property, guestSession }) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [step, setStep] = useState("intro");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clientSecret, setClientSecret] = useState(null);
  const [stripePromise, setStripePromise] = useState(null);
  const [paymentIntentId, setPaymentIntentId] = useState(null);
  const [holdSummary, setHoldSummary] = useState(null);

  const nights = nightsBetweenKeys(checkIn, checkOut);
  const belowMinStay = checkIn && checkOut && nights > 0 && nights < REBOOK_MIN_NIGHTS;
  const canHold =
    checkIn &&
    checkOut &&
    nights >= REBOOK_MIN_NIGHTS &&
    !belowMinStay;

  const handleDateChange = useCallback((nextCheckIn, nextCheckOut) => {
    setCheckIn(nextCheckIn);
    setCheckOut(nextCheckOut);
  }, []);

  const startHold = async () => {
    setError("");
    if (!canHold) return;
    if (!GUEST_API_KEY) {
      setError("Guest API is not configured for this build.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/rebook/create-payment-intent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Guest-API-Key": GUEST_API_KEY,
        },
        body: JSON.stringify({
          email: reservation.email,
          property: reservation.unit,
          check_in: checkIn,
          check_out: checkOut,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start checkout.");
      setClientSecret(data.client_secret);
      setPaymentIntentId(data.payment_intent_id);
      setHoldSummary(data);
      setStripePromise(loadStripe(data.publishable_key));
      setStep("payment");
    } catch (err) {
      setError(err.message || "Something went wrong. Try again or contact us.");
    }
    setLoading(false);
  };

  if (step === "success") {
    return (
      <div style={{ overflowY: "auto", height: "100%", padding: "16px 16px 16px" }}>
        <Card>
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1a1a2e" }}>Your week is held!</div>
            <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.6, marginTop: 10 }}>
              {property.name} · {holdSummary?.check_in} to {holdSummary?.check_out}
            </p>
            <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginTop: 12 }}>
              We received your <strong>refundable $100 deposit</strong>. Confirm your reservation and make your first payment by <strong>{REBOOK_DEADLINE}</strong> or we'll release the week and refund your deposit.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "16px 16px 16px" }}>
      <div style={{ background: "linear-gradient(135deg, #0ea5b7, #0c8595)", color: "#fff", borderRadius: 14, padding: "20px", marginBottom: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700, textAlign: "center" }}>Come back next year ☀️</div>
        <p style={{ fontSize: 13, opacity: 0.95, margin: "8px 0 0", lineHeight: 1.55, textAlign: "justify" }}>
          Hold your favorite week with a <strong>refundable $100 deposit</strong>. Booking direct means no Online Booking Company fees when you're ready to confirm.
        </p>
      </div>

      <Card>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 44, fontWeight: 800, color: "#0c8595" }}>$100</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>refundable deposit · credited toward your stay</div>
        </div>
      </Card>

      <Card>
        <div style={{ padding: "12px 14px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#92400e", marginBottom: 6 }}>How This Works</div>
          <p style={{ fontSize: 13, color: "#78350f", lineHeight: 1.6, margin: 0, textAlign: "justify" }}>
            Your $100 is a refundable deposit. It blocks your week on our calendar while you decide whether you can come back.
          </p>
          <p style={{ fontSize: 13, color: "#78350f", lineHeight: 1.6, margin: "10px 0 0", textAlign: "justify" }}>
            You have until December 31, 2026 to confirm your reservation. If you confirm, we will send you a payment plan schedule. If we don't hear from you by then or you cancel your hold, your $100 deposit will be refunded.
          </p>
        </div>
      </Card>

      {step === "intro" && (
        <>
          <Card>
            <SectionLabel>Your week</SectionLabel>
            <p style={{ fontSize: 13, color: "#4b5563", margin: "8px 0 0" }}>You loved {property.name} — want it again?</p>
            <RebookDatePicker
              unit={reservation.unit}
              checkIn={checkIn}
              checkOut={checkOut}
              onChangeDates={handleDateChange}
            />
            {belowMinStay && (
              <p style={{ fontSize: 13, color: "#b45309", margin: "10px 0 0" }}>
                Minimum stay is {REBOOK_MIN_NIGHTS} nights.
              </p>
            )}
          </Card>
          {error && (
            <div style={{ marginBottom: 12, padding: "12px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 13, color: "#b91c1c" }}>
              {error}
            </div>
          )}
          <button
            onClick={startHold}
            disabled={loading || !canHold}
            style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: loading || !canHold ? "#94a3b8" : "#0ea5b7", color: "#fff", fontSize: 16, fontWeight: 600, cursor: loading || !canHold ? "default" : "pointer" }}
          >
            {loading ? "Preparing checkout…" : "Hold my week — $100 deposit"}
          </button>
          <div style={{ textAlign: "center", marginTop: "16px" }}>
            <p style={{ fontSize: "14px", color: "#555", margin: 0 }}>
              Want to see our other condos?{" "}
              <a
                href="https://www.lforv.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#0d9488", fontWeight: 600, textDecoration: "underline" }}
              >
                Click here for our website
              </a>
            </p>
          </div>
        </>
      )}

      {step === "payment" && clientSecret && stripePromise && (
        <Card>
          <SectionLabel>Card payment</SectionLabel>
          <p style={{ fontSize: 13, color: "#4b5563", margin: "8px 0 12px", lineHeight: 1.5 }}>
            {holdSummary?.property_name} · {holdSummary?.check_in} to {holdSummary?.check_out}
          </p>
          {error && (
            <div style={{ marginBottom: 12, padding: "12px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 13, color: "#b91c1c" }}>
              {error}
            </div>
          )}
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
            <RebookPaymentForm
              paymentIntentId={paymentIntentId}
              onSuccess={(data) => { setHoldSummary(data); setStep("success"); }}
              onError={setError}
            />
          </Elements>
          <button
            type="button"
            onClick={() => { setStep("intro"); setError(""); }}
            style={{ width: "100%", marginTop: 10, padding: "10px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280", fontSize: 13, cursor: "pointer" }}
          >
            ← Back
          </button>
        </Card>
      )}

      <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 10 }}>🔒 Secure payment via Stripe · test mode in development</p>
      <PreviousStaysSection guestSession={guestSession} />
    </div>
  );
}

function PreviousStaysSection({ guestSession }) {
  const pastStays = getPreviousStays(guestSession);
  if (pastStays.length === 0) return null;

  return (
    <Card>
      <SectionLabel>Previous Stays</SectionLabel>
      <div style={{ marginTop: 8 }}>
        {pastStays.map((stay, i) => (
          <div
            key={stay.id}
            style={{
              padding: "10px 0",
              borderBottom: i < pastStays.length - 1 ? "1px solid #f3f4f6" : "none",
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>
              Condo# {displayUnitNumber(stay.unit)}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
              {formatStayDateRange(stay.check_in, stay.check_out)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
const Card = ({ children }) => (
  <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)" }}>
    {children}
  </div>
);

const SectionLabel = ({ children }) => (
  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>{children}</div>
);

const DateBox = ({ label, date, time, right }) => (
  <div style={{ textAlign: right ? "right" : "left" }}>
    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
    <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1a2e" }}>{date}</div>
    <div style={{ fontSize: 12, color: "#6b7280" }}>{time}</div>
  </div>
);

const CopyBtn = ({ text, label, copied, onCopy }) => (
  <button onClick={() => onCopy(text, label)} style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #e5e7eb", background: copied === label ? "#f0fdf4" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
    {copied === label ? <Icon name="check" size={14} color="#16a34a" /> : <Icon name="copy" size={14} color="#6b7280" />}
  </button>
);

const AddressRow = ({ address, copied, onCopy }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#4b5563" }}>
      <Icon name="map" size={14} color="#2563eb" />
      {address}
    </div>
    <CopyBtn text={address} label="address" copied={copied} onCopy={onCopy} />
  </div>
);

const ActionBtn = ({ icon, label, href }) => (
  <a href={href} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", background: "#f7f9fc", borderRadius: 10, textDecoration: "none", border: "1px solid #e5e7eb" }}>
    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 4px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Icon name={icon} size={16} color="#2563eb" />
    </div>
    <span style={{ fontSize: 12, color: "#4b5563", fontWeight: 500 }}>{label}</span>
  </a>
);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await onLogin(email);
    } catch (err) {
      setError(err.message || LOGIN_ERROR);
    }
    setBusy(false);
  };

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100dvh", display: "flex", flexDirection: "column", background: "#f7f9fc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ background: "linear-gradient(135deg, #0ea5b7, #0c8595)", color: "#fff", padding: "32px 20px 28px", textAlign: "center" }}>
        <img src={lfvSun} alt="LivingForVacation" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "contain", marginBottom: 12 }} />
        <div style={{ fontSize: 22, fontWeight: 700 }}>LivingForVacation</div>
        <div style={{ fontSize: 14, opacity: 0.9, marginTop: 4 }}>Pelican Beach Resort guest guide</div>
      </div>
      <div style={{ padding: 16, flex: 1 }}>
        <Card>
          <SectionLabel>Find your stay</SectionLabel>
          <p style={{ fontSize: 13, color: "#6b7280", margin: "8px 0 16px", lineHeight: 1.5 }}>
            Enter the email address you used when booking. We'll pull up your reservation details.
          </p>
          <form onSubmit={submit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email you booked with"
              autoComplete="email"
              required
              style={{ width: "100%", padding: "12px 14px", fontSize: 14, border: "1.5px solid #e5e7eb", borderRadius: 10, color: "#1a1a2e", boxSizing: "border-box", outline: "none" }}
            />
            {error && (
              <div style={{ marginTop: 12, padding: "12px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, fontSize: 13, color: "#b91c1c", lineHeight: 1.5 }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy || !email.trim()}
              style={{
                width: "100%",
                marginTop: 16,
                padding: "14px",
                borderRadius: 12,
                border: "none",
                background: busy || !email.trim() ? "#94a3b8" : "#0ea5b7",
                color: "#fff",
                fontSize: 16,
                fontWeight: 600,
                cursor: busy || !email.trim() ? "default" : "pointer",
              }}
            >
              {busy ? "Looking…" : "View my stay"}
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App() {
  const [guestSession, setGuestSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab] = useState("stay");

  const reservation = guestSession ? getActiveReservation(guestSession) : null;

  useEffect(() => {
    const cached = readCachedGuestSession();
    if (cached) {
      setGuestSession(cached);
    }
    setAuthLoading(false);

    if (!cached?.email) return undefined;

    let cancelled = false;
    refreshGuestSession(cached.email).then((fresh) => {
      if (cancelled) return;
      if (fresh?.revoked) {
        localStorage.removeItem(RESERVATION_CACHE_KEY);
        setGuestSession(null);
        return;
      }
      if (!fresh) return;
      if (!guestSessionsEqual(cached, fresh)) {
        setGuestSession(fresh);
        localStorage.setItem(RESERVATION_CACHE_KEY, JSON.stringify(fresh));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email) => {
    const session = await fetchReservation(email);
    setGuestSession(session);
    localStorage.setItem(RESERVATION_CACHE_KEY, JSON.stringify(session));
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f7f9fc", color: "#6b7280", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        Loading your stay…
      </div>
    );
  }

  if (!reservation) {
    return <LoginScreen onLogin={login} />;
  }

  const property = getProperty(reservation);

  const tabs = [
    { key: "stay", label: "Stay", icon: "home" },
    { key: "guide", label: "Guide", icon: "book" },
    { key: "contact", label: "Contact", icon: "contact" },
    { key: "rebook", label: "Rebook", icon: "calendar" },
  ];

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", height: "100dvh", display: "flex", flexDirection: "column", background: "#f7f9fc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", position: "relative", overflow: "hidden" }}>
      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ display: tab === "stay" ? "block" : "none", height: "100%" }}><StayTab reservation={reservation} property={property} /></div>
        <div style={{ display: tab === "guide" ? "flex" : "none", flexDirection: "column", height: "100%" }}><GuideTab reservation={reservation} property={property} /></div>
        <div style={{ display: tab === "contact" ? "block" : "none", height: "100%" }}><ContactTab reservation={reservation} property={property} /></div>
        <div style={{ display: tab === "sunny" ? "flex" : "none", flexDirection: "column", height: "100%" }}><SunnyTab reservation={reservation} property={property} /></div>
        <div style={{ display: tab === "rebook" ? "block" : "none", height: "100%" }}><RebookTab reservation={reservation} property={property} guestSession={guestSession} /></div>
      </div>

      {/* Bottom Nav (colored / filled) */}
      <div style={{ background: "#fff", borderTop: "1px solid #eef0f4", display: "flex", boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}>
        {tabs.map(t => {
          const active = tab === t.key;
          const c = active ? "#0c8595" : "#9ca3af";
          return (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: "10px 2px 8px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <Icon name={t.icon} size={22} color={c} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, whiteSpace: "nowrap", color: c }}>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Ask Sunny banner */}
      <button
        onClick={() => setTab("sunny")}
        style={{ width: "100%", border: "none", cursor: "pointer", background: "linear-gradient(135deg, #FFD93D, #FF6B35)", color: "#fff", fontSize: 15, fontWeight: 600, padding: "11px 12px", paddingBottom: "calc(11px + env(safe-area-inset-bottom))", textAlign: "center", letterSpacing: "0.2px" }}
      >
        ☀️ Questions? Ask Sunny
      </button>
    </div>
  );
}
