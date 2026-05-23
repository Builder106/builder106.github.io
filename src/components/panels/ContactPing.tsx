import { useEffect, useRef, useState } from "react";
import { PanelShell } from "./PanelShell";

interface ContactPingProps {
  open: boolean;
  onClose: () => void;
}

const NAME = "Olayinka David Vaughan";
const ROLE = "economics + cs · wesleyan ‘28";
const EMAIL = "vaughanolayinka@gmail.com";
const PHONE = "+1 475 331 4070";
const RESUME = "/Olayinka_Vaughan_Resume.pdf";
const MAILTO_SUBJECT = "hi yinka";
const MAILTO_BODY = "saw your portfolio — wanted to reach out.";

const ELSEWHERE = [
  { label: "github",   href: "https://github.com/Builder106" },
  { label: "linkedin", href: "https://www.linkedin.com/in/yinka-vaughan/" },
  { label: "devpost",  href: "https://devpost.com/olayinkav" },
];

// In-canvas contact panel, same chrome as the other panels.
// Stylised as an "uplink": identity strip → status pills (looking-for,
// based, live latency ticker) → contact-method cards → elsewhere
// chips → primary/secondary CTAs. Mailto links pre-fill subject + body
// so opening the system mail client lands on a partly-composed message
// rather than a blank canvas.

export function ContactPing({ open, onClose }: ContactPingProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(value);
      setTimeout(() => setCopied((c) => (c === value ? null : c)), 1400);
    } catch {
      /* clipboard blocked — fallback is the visible value itself */
    }
  };

  // Fake "uplink latency" ticker. Pure decoration — sells the
  // "connection established" metaphor by giving the status block a
  // value that moves. ~1 Hz update, ±2 ms wobble around a baseline,
  // updates only while the panel is open so we're not churning state
  // for a hidden DOM tree.
  const [latency, setLatency] = useState(13);
  const baselineRef = useRef(13);
  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => {
      // Random walk that gently meanders so the readout doesn't twitch
      // wildly — most updates are ±1 ms.
      baselineRef.current = Math.max(
        9,
        Math.min(18, baselineRef.current + (Math.random() < 0.5 ? -1 : 1)),
      );
      const jitter = Math.random() < 0.85 ? 0 : (Math.random() < 0.5 ? -1 : 1);
      setLatency(baselineRef.current + jitter);
    }, 1100);
    return () => window.clearInterval(id);
  }, [open]);

  const mailtoHref = `mailto:${EMAIL}?subject=${encodeURIComponent(
    MAILTO_SUBJECT,
  )}&body=${encodeURIComponent(MAILTO_BODY)}`;

  return (
    <PanelShell open={open} title="// uplink" onClose={onClose} variantClass="panel--contact">
      {/* Identity strip — green "connection established" dot + name +
          role. Reads as the contact panel's header card, parallel to
          the project card's identity strip. */}
      <section className="contact-identity">
        <div className="contact-identity__status">
          <span className="contact-identity__dot" aria-hidden />
          <span className="contact-identity__status-text">connection established</span>
        </div>
        <h3 className="contact-identity__name">{NAME}</h3>
        <span className="contact-identity__role">{ROLE}</span>
      </section>

      {/* Three compact pills carrying the at-a-glance context a
          recruiter wants before reading the rest: what you're after,
          where you are, and a live "the link is alive" decoration. */}
      <section className="contact-pills">
        <div className="contact-pill">
          <div className="contact-pill__label">looking for</div>
          <div className="contact-pill__value">swe / quant internship</div>
          <div className="contact-pill__sub">summer 2027</div>
        </div>
        <div className="contact-pill">
          <div className="contact-pill__label">based</div>
          <div className="contact-pill__value">middletown, ct</div>
          <div className="contact-pill__sub">open to remote</div>
        </div>
        <div className="contact-pill">
          <div className="contact-pill__label">uplink</div>
          <div className="contact-pill__value contact-pill__value--live">
            {latency}
            <span className="contact-pill__unit">ms</span>
          </div>
          <div className="contact-pill__sub">round-trip · live</div>
        </div>
      </section>

      {/* Direct contact methods. Each method is its own card — single
          row with the channel name, the address, a copy button, and
          an open action. Tapping the body opens the underlying mailto
          / tel link; tapping copy lifts the value to the clipboard. */}
      <section className="panel__section">
        <div className="panel__section-label">direct</div>
        <ul className="contact-methods">
          <li className="contact-method">
            <span className="contact-method__key">email</span>
            <a
              className="contact-method__value"
              href={mailtoHref}
            >
              {EMAIL}
            </a>
            <button
              type="button"
              className="contact-method__copy"
              onClick={() => copy(EMAIL)}
              aria-label="Copy email address"
            >
              {copied === EMAIL ? "copied" : "copy"}
            </button>
          </li>
          <li className="contact-method">
            <span className="contact-method__key">phone</span>
            <a
              className="contact-method__value"
              href={`tel:${PHONE.replace(/\s/g, "")}`}
            >
              {PHONE}
            </a>
            <button
              type="button"
              className="contact-method__copy"
              onClick={() => copy(PHONE)}
              aria-label="Copy phone number"
            >
              {copied === PHONE ? "copied" : "copy"}
            </button>
          </li>
        </ul>
      </section>

      {/* Social chips — outbound links to github / linkedin / devpost.
          Smaller and lower visual weight than the direct methods so
          email + phone read as the primary path. */}
      <section className="panel__section">
        <div className="panel__section-label">elsewhere</div>
        <div className="contact-elsewhere">
          {ELSEWHERE.map((link) => (
            <a
              key={link.label}
              className="contact-chip"
              href={link.href}
              target="_blank"
              rel="noreferrer"
            >
              <span className="contact-chip__label">{link.label}</span>
              <span className="contact-chip__arrow" aria-hidden>→</span>
            </a>
          ))}
        </div>
      </section>

      {/* Primary action (send email) + secondary (view resume). The
          mailto URL pre-fills subject + body so the recipient lands
          on a partly-composed message in their system mail client
          rather than a blank one. */}
      <section className="contact-ctas">
        <a className="contact-cta contact-cta--primary" href={mailtoHref}>
          <span className="contact-cta__prompt" aria-hidden>$</span>
          <span>send email</span>
          <span className="contact-cta__arrow" aria-hidden>→</span>
        </a>
        <a
          className="contact-cta contact-cta--secondary"
          href={RESUME}
          target="_blank"
          rel="noreferrer"
        >
          <span>view resume</span>
          <span className="contact-cta__arrow" aria-hidden>→</span>
        </a>
      </section>
    </PanelShell>
  );
}
