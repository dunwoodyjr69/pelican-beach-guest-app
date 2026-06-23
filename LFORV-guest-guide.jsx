import { useState, useRef, useEffect } from "react";

// ─── DATA ────────────────────────────────────────────────────────────────────
const PROPERTY = {
  name: "Unit 2017 — Myrtle Beach Resort",
  address: "5905 S Kings Hwy, Myrtle Beach, SC 29575",
  photo: "https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80",
  checkIn: { date: "Jun 20", time: "4:00 PM" },
  checkOut: { date: "Jun 27", time: "10:00 AM" },
  guests: 4, bedrooms: 2, bathrooms: 2,
  wifi: { name: "MBR_Unit2017", password: "beachlife2017" },
  accessCode: "4521#",
  parking: "Lot C, Space 47 — your parking pass is on the kitchen counter",
  host: {
    name: "LivingForVacation",
    phone: "+1 (843) 555-0192",
    sms: "+1 (843) 555-0192",
    email: "hello@lforv.com",
    website: "https://lforv.com",
    about: "We're obsessed with making your stay unforgettable. From the moment you arrive to the second you check out, we've got you covered. Questions at midnight? Text us.",
  },
  cleaning: "Lemon Fresh Cleaning",
};

const GUIDE_SECTIONS = {
  welcome: {
    title: "Welcome",
    content: `You made it! 🎉 Unit 2017 is all yours until ${PROPERTY.checkOut.date}. We've stocked the essentials and left you the best view on the floor. Need anything at all — Sunny's got answers, and so do we.`,
  },
  rules: [
    "No smoking inside the unit or on the balcony",
    "No parties or events — max ${PROPERTY.guests} guests",
    "Quiet hours: 10:00 PM – 9:00 AM",
    "No pets",
    "Respect your neighbors — this is a residential resort community",
  ],
  departure: [
    "Place all towels on the bathroom floor",
    "Load and start the dishwasher",
    "Bag all trash and take to the dumpster (parking lot C)",
    "Set AC to 74°F",
    "Close and lock all windows and doors",
    "Leave your keys on the kitchen counter",
  ],
  faq: [
    { q: "What's the WiFi password?", a: `Network: ${PROPERTY.wifi.name} · Password: ${PROPERTY.wifi.password} — also on the fridge magnet.` },
    { q: "Where do I park?", a: PROPERTY.parking },
    { q: "Can I get a mid-stay clean?", a: "Yes! We don't do daily housekeeping, but a mid-stay clean is available for a fee. Text us to arrange." },
    { q: "Pool hours?", a: "The resort pool is open 8 AM – 10 PM. Heated seasonally. Towels are in the hall closet." },
    { q: "What's the beach flag system?", a: "🟢 Green: calm. 🟡 Yellow: moderate surf/currents, swim with caution. 🔴 Red: high hazard, no swimming. 🟣 Purple: dangerous marine life. Double red = beach closed. Always check before you go in." },
    { q: "Checkout is when?", a: `${PROPERTY.checkOut.time} on ${PROPERTY.checkOut.date}. Late checkout may be available — text us 24hrs ahead.` },
  ],
  safety: "In any emergency, call 911. Fire extinguisher is in the kitchen cabinet under the sink. First aid kit is in the master bathroom. Nearest urgent care: AFC Urgent Care, 4.2 mi north on Kings Hwy.",
  travel: "Save this page to your home screen for offline access — tap the share button in your browser and select 'Add to Home Screen.'",
};

const LOCAL = [
  { category: "🍽 Restaurants", items: [
    { name: "Sea Captain's House", note: "Seafood institution. Get the she-crab soup. Busy — go early or late.", distance: "1.2 mi" },
    { name: "Croissants Bistro & Bakery", note: "Best breakfast in Myrtle. Local favorite, not a tourist trap.", distance: "2.1 mi" },
    { name: "The Dead Dog Saloon", note: "Cold beer, great views, don't let the name stop you.", distance: "0.8 mi" },
    { name: "Thoroughbreds", note: "Upscale steakhouse if it's a special night.", distance: "3.4 mi" },
  ]},
  { category: "🏖 Beach & Outdoors", items: [
    { name: "Myrtle Beach State Park", note: "Quieter beach, nature trails, actual parking. Worth the drive.", distance: "3.1 mi" },
    { name: "Broadway at the Beach", note: "Shopping, restaurants, mini golf. Peak tourist territory but great for a night out.", distance: "4.5 mi" },
    { name: "Inlet Point Plantation Fishing Charters", note: "Best fishing charter on the Grand Strand. Book ahead.", distance: "12 mi" },
  ]},
  { category: "🛒 Essentials", items: [
    { name: "Walmart Supercenter", note: "Sunscreen, groceries, beach gear — all 24 hrs.", distance: "1.8 mi" },
    { name: "Publix", note: "Better quality groceries, especially the deli.", distance: "2.3 mi" },
    { name: "CVS Pharmacy", note: "24hr pharmacy.", distance: "0.6 mi" },
  ]},
  { category: "🚨 Good to Know", items: [
    { name: "Grand Strand Medical Center", note: "Full ER.", distance: "5.2 mi" },
    { name: "AFC Urgent Care", note: "Non-emergency care, faster than the ER.", distance: "4.2 mi" },
    { name: "Myrtle Beach Police (non-emergency)", note: "(843) 918-1382", distance: "" },
  ]},
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

// ─── SUNNY AI ─────────────────────────────────────────────────────────────────
const SUNNY_CONTEXT = `
You are Sunny, the AI concierge for LivingForVacation, a vacation rental company in Myrtle Beach, SC.
You are warm, helpful, a little funny, and know this area like a local friend who lives here.
Keep answers concise and conversational — this is a phone app, not an essay.

PROPERTY: Unit 2017, Myrtle Beach Resort, 5905 S Kings Hwy, Myrtle Beach SC 29575
CHECK-IN: 4:00 PM | CHECK-OUT: 10:00 AM
WIFI: Network: MBR_Unit2017 | Password: beachlife2017
ACCESS CODE: 4521#
PARKING: Lot C, Space 47 — parking pass on the kitchen counter
POOL HOURS: 8 AM – 10 PM (heated seasonally)
QUIET HOURS: 10 PM – 9 AM
MAX GUESTS: 4 | NO SMOKING | NO PETS | NO PARTIES

LOCAL KNOWLEDGE:
- Best seafood: Sea Captain's House (she-crab soup is legendary)
- Best breakfast: Croissants Bistro & Bakery (locals, not tourists)
- Best beach: Myrtle Beach State Park for a quieter spot
- Beach flag system: Green=safe, Yellow=caution, Red=dangerous, Purple=marine life, Double red=closed
- Nearest urgent care: AFC Urgent Care, 4.2 mi north
- ER: Grand Strand Medical Center, 5.2 mi
- 24hr pharmacy: CVS, 0.6 mi

DEPARTURE CHECKLIST: towels on bathroom floor, run dishwasher, take out trash to Lot C dumpster, set AC to 74°F, close and lock everything, leave keys on counter.

If you don't know something specific, say so and direct them to text the host at (843) 555-0192.
Never make up information about access codes, prices, or policies you're not sure about.
`;

function SunnyTab() {
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

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          system: SUNNY_CONTEXT,
          messages: history,
        }),
      });
      const data = await res.json();
      const reply = data.content?.[0]?.text || "Hmm, I hit a snag. Try texting the host directly!";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Lost my WiFi for a sec 😅 Try again, or text the host at (843) 555-0192." }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f7f9fc" }}>
      {/* Header */}
      <div style={{ background: "#fff", padding: "16px 20px 12px", borderBottom: "1px solid #eef0f4", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #FFD93D, #FF6B35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>☀️</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>Sunny</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Your Myrtle Beach local guide</div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 0" }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 12, display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #FFD93D, #FF6B35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginRight: 8, alignSelf: "flex-end" }}>☀️</div>
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
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #FFD93D, #FF6B35)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>☀️</div>
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
function StayTab() {
  const [copied, copy] = useCopy();
  const [showCode, setShowCode] = useState(false);

  return (
    <div style={{ overflowY: "auto", height: "100%" }}>
      {/* Hero */}
      <div style={{ position: "relative", height: 200 }}>
        <img src={PROPERTY.photo} alt="property" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.65))" }} />
        <div style={{ position: "absolute", bottom: 16, left: 16, right: 16 }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 20, lineHeight: 1.2 }}>{PROPERTY.name}</div>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
            <Icon name="map" size={13} color="rgba(255,255,255,0.85)" />
            {PROPERTY.address}
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 16px 100px" }}>
        {/* Reservation */}
        <Card>
          <SectionLabel>Reservation Info</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0" }}>
            <DateBox label="Check-in" date={PROPERTY.checkIn.date} time={PROPERTY.checkIn.time} />
            <div style={{ flex: 1, height: 1, background: "#e5e7eb", position: "relative" }}>
              <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "#fff", padding: "0 4px" }}>
                <Icon name="arrow" size={14} color="#9ca3af" />
              </div>
            </div>
            <DateBox label="Check-out" date={PROPERTY.checkOut.date} time={PROPERTY.checkOut.time} right />
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 8, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
            {[["👥", PROPERTY.guests, "Guests"], ["🛏", PROPERTY.bedrooms, "Bedrooms"], ["🚿", PROPERTY.bathrooms, "Bathrooms"]].map(([icon, val, label]) => (
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
              width="100%" height="140"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://maps.google.com/maps?q=${encodeURIComponent(PROPERTY.address)}&output=embed&z=15`}
            />
          </div>
          <AddressRow address={PROPERTY.address} copied={copied} onCopy={copy} />
        </Card>

        {/* Access */}
        <Card>
          <SectionLabel>Access</SectionLabel>
          <button onClick={() => setShowCode(!showCode)} style={{ width: "100%", marginTop: 12, padding: "12px", borderRadius: 10, border: "1.5px solid #2563eb", background: showCode ? "#2563eb" : "#fff", color: showCode ? "#fff" : "#2563eb", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}>
            <Icon name="lock" size={16} color={showCode ? "#fff" : "#2563eb"} />
            {showCode ? "Hide Access Code" : "Show Access Code"}
          </button>
          {showCode && (
            <div style={{ marginTop: 10, padding: "14px 16px", background: "#f0f7ff", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Door Code</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#1a1a2e", letterSpacing: 4 }}>{PROPERTY.accessCode}</div>
              </div>
              <CopyBtn text={PROPERTY.accessCode} label="code" copied={copied} onCopy={copy} />
            </div>
          )}
          <div style={{ marginTop: 12, padding: "12px 14px", background: "#f9fafb", borderRadius: 10, fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
            🅿️ {PROPERTY.parking}
          </div>
        </Card>

        {/* WiFi */}
        <Card>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <SectionLabel>WiFi</SectionLabel>
            <Icon name="wifi" size={18} color="#2563eb" />
          </div>
          {[["Wifi Name", PROPERTY.wifi.name, "wifiname"], ["Wifi Password", PROPERTY.wifi.password, "wifipw"]].map(([label, val, key]) => (
            <div key={key} style={{ marginTop: 10, padding: "12px 14px", background: "#f9fafb", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{val}</div>
              </div>
              <CopyBtn text={val} label={key} copied={copied} onCopy={copy} />
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ─── GUIDE TAB ────────────────────────────────────────────────────────────────
function GuideTab() {
  const [subTab, setSubTab] = useState("welcome");
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Property mini-header */}
      <div style={{ padding: "14px 16px 0", background: "#fff" }}>
        <div style={{ fontWeight: 700, fontSize: 17, color: "#1a1a2e" }}>{PROPERTY.name}</div>
        <div style={{ fontSize: 12, color: "#6b7280", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
          <Icon name="map" size={12} color="#9ca3af" /> {PROPERTY.address}
        </div>
        {/* Sub-tabs */}
        <div style={{ display: "flex", gap: 0, marginTop: 14, borderBottom: "1px solid #e5e7eb" }}>
          {[["welcome","Welcome"],["access","Access"],["general","General"],["local","Local Guide"]].map(([key, label]) => (
            <button key={key} onClick={() => setSubTab(key)} style={{ flex: 1, padding: "8px 4px", background: "none", border: "none", borderBottom: subTab === key ? "2px solid #2563eb" : "2px solid transparent", color: subTab === key ? "#2563eb" : "#6b7280", fontSize: 12, fontWeight: subTab === key ? 600 : 400, cursor: "pointer", transition: "all 0.15s" }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 100px" }}>
        {subTab === "welcome" && (
          <>
            <Card>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1a2e", marginBottom: 8 }}>Welcome</div>
              <p style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.6, margin: 0 }}>{GUIDE_SECTIONS.welcome.content}</p>
            </Card>
            <Card>
              <SectionLabel>Reservation Info</SectionLabel>
              <div style={{ fontSize: 13, color: "#4b5563", marginTop: 8, lineHeight: 1.6 }}>
                <div>📅 Check-in: <strong>{PROPERTY.checkIn.date} at {PROPERTY.checkIn.time}</strong></div>
                <div style={{ marginTop: 4 }}>📅 Check-out: <strong>{PROPERTY.checkOut.date} at {PROPERTY.checkOut.time}</strong></div>
              </div>
            </Card>
            <Card>
              <SectionLabel>Departure Instructions</SectionLabel>
              <div style={{ marginTop: 8 }}>
                {GUIDE_SECTIONS.departure.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: "1.5px solid #d1d5db", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Icon name="check" size={10} color="#9ca3af" />
                    </div>
                    <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.4, paddingTop: 2 }}>{item}</div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {subTab === "access" && (
          <>
            <Card>
              <SectionLabel>Getting Here</SectionLabel>
              <div style={{ margin: "12px 0", borderRadius: 10, overflow: "hidden", height: 140 }}>
                <iframe title="map2" width="100%" height="140" style={{ border: 0 }} loading="lazy"
                  src={`https://maps.google.com/maps?q=${encodeURIComponent(PROPERTY.address)}&output=embed&z=15`} />
              </div>
              <div style={{ fontSize: 13, color: "#4b5563" }}>{PROPERTY.address}</div>
            </Card>
            <Card>
              <SectionLabel>Guest Access Code</SectionLabel>
              <div style={{ marginTop: 10, padding: "14px 16px", background: "#f0f7ff", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>Door Code</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#1a1a2e", letterSpacing: 4 }}>{PROPERTY.accessCode}</div>
                </div>
              </div>
            </Card>
            <Card>
              <SectionLabel>Parking</SectionLabel>
              <div style={{ marginTop: 8, fontSize: 13, color: "#4b5563", lineHeight: 1.6 }}>🅿️ {PROPERTY.parking}</div>
            </Card>
            <Card>
              <SectionLabel>WiFi</SectionLabel>
              {[["Network", PROPERTY.wifi.name],["Password", PROPERTY.wifi.password]].map(([label, val]) => (
                <div key={label} style={{ marginTop: 10, padding: "12px 14px", background: "#f9fafb", borderRadius: 10 }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{val}</div>
                </div>
              ))}
            </Card>
          </>
        )}

        {subTab === "general" && (
          <>
            <Card>
              <SectionLabel>House Rules</SectionLabel>
              <div style={{ marginTop: 8 }}>
                {GUIDE_SECTIONS.rules.map((r, i) => (
                  <div key={i} style={{ fontSize: 13, color: "#4b5563", padding: "7px 0", borderBottom: i < GUIDE_SECTIONS.rules.length - 1 ? "1px solid #f3f4f6" : "none" }}>• {r}</div>
                ))}
              </div>
            </Card>
            <Card>
              <SectionLabel>Safety Info</SectionLabel>
              <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6, margin: "8px 0 0" }}>{GUIDE_SECTIONS.safety}</p>
            </Card>
            <Card>
              <SectionLabel>FAQs</SectionLabel>
              <div style={{ marginTop: 8 }}>
                {GUIDE_SECTIONS.faq.map((item, i) => (
                  <div key={i} style={{ borderBottom: i < GUIDE_SECTIONS.faq.length - 1 ? "1px solid #f3f4f6" : "none" }}>
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
              <SectionLabel>Travel Tips</SectionLabel>
              <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6, margin: "8px 0 0" }}>{GUIDE_SECTIONS.travel}</p>
            </Card>
          </>
        )}

        {subTab === "local" && (
          <>
            {LOCAL.map((section, si) => (
              <Card key={si}>
                <SectionLabel>{section.category}</SectionLabel>
                <div style={{ marginTop: 8 }}>
                  {section.items.map((item, i) => (
                    <div key={i} style={{ padding: "10px 0", borderBottom: i < section.items.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a2e" }}>{item.name}</div>
                        {item.distance && <div style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8, flexShrink: 0 }}>{item.distance}</div>}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3, lineHeight: 1.4 }}>{item.note}</div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// ─── CONTACT TAB ──────────────────────────────────────────────────────────────
function ContactTab() {
  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "16px 16px 100px" }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: "linear-gradient(135deg, #2563eb, #1d4ed8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🌴</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "#1a1a2e" }}>{PROPERTY.host.name}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>Vacation Rental Host</div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.6, margin: "0 0 16px" }}>{PROPERTY.host.about}</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <ActionBtn icon="phone" label="Call" href={`tel:${PROPERTY.host.phone}`} />
          <ActionBtn icon="msg" label="Text" href={`sms:${PROPERTY.host.sms}`} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          <ActionBtn icon="mail" label="Email" href={`mailto:${PROPERTY.host.email}`} />
          <ActionBtn icon="map" label="Website" href={PROPERTY.host.website} />
        </div>
      </Card>

      <Card>
        <SectionLabel>Cleaning Crew</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🍋</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1a2e" }}>{PROPERTY.cleaning}</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Keeping Unit 2017 fresh</div>
          </div>
        </div>
      </Card>

      <Card>
        <SectionLabel>Emergency Contacts</SectionLabel>
        <div style={{ marginTop: 8 }}>
          {[["🚨", "Emergency", "911"], ["🚓", "Police (non-emergency)", "(843) 918-1382"], ["🏥", "Grand Strand Medical", "(843) 692-1000"], ["💊", "CVS Pharmacy (24hr)", "(843) 448-0000"]].map(([icon, label, num]) => (
            <a key={label} href={`tel:${num.replace(/\D/g,"")}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6", textDecoration: "none" }}>
              <div style={{ fontSize: 13, color: "#1a1a2e" }}>{icon} {label}</div>
              <div style={{ fontSize: 13, color: "#2563eb", fontWeight: 600 }}>{num}</div>
            </a>
          ))}
        </div>
      </Card>
    </div>
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

// ─── APP SHELL ────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("stay");

  const tabs = [
    { key: "stay", label: "Stay", icon: "home" },
    { key: "guide", label: "Guide", icon: "book" },
    { key: "contact", label: "Contact", icon: "contact" },
    { key: "sunny", label: "Sunny", icon: "sun" },
  ];

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", height: "100dvh", display: "flex", flexDirection: "column", background: "#f7f9fc", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", position: "relative", overflow: "hidden" }}>
      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ display: tab === "stay" ? "block" : "none", height: "100%" }}><StayTab /></div>
        <div style={{ display: tab === "guide" ? "flex" : "none", flexDirection: "column", height: "100%" }}><GuideTab /></div>
        <div style={{ display: tab === "contact" ? "block" : "none", height: "100%" }}><ContactTab /></div>
        <div style={{ display: tab === "sunny" ? "flex" : "none", flexDirection: "column", height: "100%" }}><SunnyTab /></div>
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#fff", borderTop: "1px solid #eef0f4", display: "flex", paddingBottom: "env(safe-area-inset-bottom)", boxShadow: "0 -2px 12px rgba(0,0,0,0.06)" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: "10px 4px 8px", background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, transition: "opacity 0.15s" }}>
            <div style={{ opacity: tab === t.key ? 1 : 0.45 }}>
              <Icon name={t.icon} size={22} color={tab === t.key ? (t.key === "sunny" ? "#FF6B35" : "#2563eb") : "#6b7280"} />
            </div>
            <span style={{ fontSize: 10, fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? (t.key === "sunny" ? "#FF6B35" : "#2563eb") : "#9ca3af" }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
