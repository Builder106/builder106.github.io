import { useState } from 'react';
import { PanelShell } from './PanelShell';

interface ContactPingProps {
  open: boolean;
  onClose: () => void;
}

const NAME = 'Olayinka David Vaughan';
const ROLE = "Economics and CS | Wesleyan '28";
const EMAIL = 'vaughanolayinka@gmail.com';
const PHONE = '+1 475 331 4070';
const MAILTO_SUBJECT = 'Hi Yinka';
const MAILTO_BODY = 'I saw your portfolio and wanted to reach out.';
const DEVPOST = 'https://devpost.com/olayinkav';

// The mailto action opens a message with a short subject and body.

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

  const mailtoHref = `mailto:${EMAIL}?subject=${encodeURIComponent(
    MAILTO_SUBJECT,
  )}&body=${encodeURIComponent(MAILTO_BODY)}`;

  return (
    <PanelShell open={open} title="Contact" onClose={onClose} variantClass="panel--contact">
      <section className="contact-identity">
        <h3 className="contact-identity__name">{NAME}</h3>
        <span className="contact-identity__role">{ROLE}</span>
      </section>

      <section className="contact-pills" aria-label="Internship and location">
        <div className="contact-pill">
          <p className="contact-pill__value">
            Looking for an SWE or quant internship in summer 2027.
          </p>
        </div>
        <div className="contact-pill">
          <p className="contact-pill__value">Based in Middletown, CT. Open to remote roles.</p>
        </div>
      </section>

      <section className="panel__section" aria-label="Contact details">
        <ul className="contact-methods">
          <li className="contact-method">
            <span className="contact-method__key">email</span>
            <a className="contact-method__value" href={mailtoHref}>
              {EMAIL}
            </a>
            <button
              type="button"
              className="contact-method__copy"
              onClick={() => copy(EMAIL)}
              aria-label="Copy email address"
            >
              {copied === EMAIL ? 'copied' : 'copy'}
            </button>
          </li>
          <li className="contact-method">
            <span className="contact-method__key">phone</span>
            <a className="contact-method__value" href={`tel:${PHONE.replace(/\s/g, '')}`}>
              {PHONE}
            </a>
            <button
              type="button"
              className="contact-method__copy"
              onClick={() => copy(PHONE)}
              aria-label="Copy phone number"
            >
              {copied === PHONE ? 'copied' : 'copy'}
            </button>
          </li>
        </ul>
      </section>

      <div className="contact-profile">
        <a className="contact-chip" href={DEVPOST} target="_blank" rel="noreferrer">
          <span>Devpost profile</span>
          <span className="contact-chip__arrow" aria-hidden>
            →
          </span>
        </a>
      </div>

      <div className="contact-ctas">
        <a className="contact-cta contact-cta--primary" href={mailtoHref}>
          <span>Send email</span>
          <span className="contact-cta__arrow" aria-hidden>
            →
          </span>
        </a>
      </div>
    </PanelShell>
  );
}
