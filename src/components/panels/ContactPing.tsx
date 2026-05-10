import { useState } from "react";
import "./Panel.css";

interface ContactPingProps {
  open: boolean;
  onClose: () => void;
}

const EMAIL = "vaughanolayinka@gmail.com";
const PHONE = "+1 475 331 4070";

const ELSEWHERE = [
  { label: "github", href: "https://github.com/Builder106" },
  { label: "linkedin", href: "https://www.linkedin.com/in/yinka-vaughan/" },
  { label: "devpost", href: "https://devpost.com/olayinkav" },
];

// In-canvas contact panel, same chrome as TradingTerminal / ProjectCard.
// Stylised as a terminal `uplink` — no form submission, no backend; just
// addresses you can copy or tap and a button that shells out to the
// system mail handler.
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

  return (
    <div className={`panel ${open ? "panel--open" : ""}`} role="dialog" aria-hidden={!open}>
      <header className="panel__header">
        <div className="panel__chrome">
          <span className="panel__chrome-dot panel__chrome-dot--red" />
          <span className="panel__chrome-dot panel__chrome-dot--amber" />
          <span className="panel__chrome-dot panel__chrome-dot--green" />
        </div>
        <h2 className="panel__title">// uplink</h2>
        <button className="panel__close" onClick={onClose} aria-label="Close">
          <span aria-hidden>esc</span>
        </button>
      </header>

      <div className="panel__body">
        <section className="panel__section">
          <div className="panel__section-label">status</div>
          <ul className="contact__status">
            <li>
              <span className="contact__status-dot" />
              connection established
            </li>
            <li>
              <span className="contact__status-key">role</span>
              <span>economics + cs (declaring fall '26), wesleyan</span>
            </li>
            <li>
              <span className="contact__status-key">based</span>
              <span>middletown, ct</span>
            </li>
          </ul>
        </section>

        <section className="panel__section">
          <div className="panel__section-label">direct</div>
          <ul className="contact__list">
            <li>
              <span className="contact__key">email</span>
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
              <button className="contact__copy" onClick={() => copy(EMAIL)}>
                {copied === EMAIL ? "copied" : "copy"}
              </button>
            </li>
            <li>
              <span className="contact__key">phone</span>
              <a href={`tel:${PHONE.replace(/\s/g, "")}`}>{PHONE}</a>
              <button className="contact__copy" onClick={() => copy(PHONE)}>
                {copied === PHONE ? "copied" : "copy"}
              </button>
            </li>
          </ul>
        </section>

        <section className="panel__section">
          <div className="panel__section-label">elsewhere</div>
          <ul className="contact__list">
            {ELSEWHERE.map((link) => (
              <li key={link.label}>
                <span className="contact__key">{link.label}</span>
                <a href={link.href} target="_blank" rel="noreferrer">
                  {link.href.replace(/^https?:\/\//, "")} →
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel__section">
          <a className="contact__cta" href={`mailto:${EMAIL}`}>
            <span className="contact__cta-prompt">$</span>
            <span>ping yinka</span>
            <span className="contact__cta-arrow">→</span>
          </a>
        </section>
      </div>
    </div>
  );
}
