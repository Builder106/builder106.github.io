import { useState } from 'react';
import { PanelShell } from './PanelShell';

interface ContactPingProps {
  open: boolean;
  onClose: () => void;
}

const NAME = 'Olayinka David Vaughan';
const ROLE = "Economics and CS, Wesleyan '28";
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
      <p className="contact__ask">Looking for an SWE or quant internship in summer 2027.</p>
      <p className="contact__who">
        {NAME}
        <span className="contact__rule" aria-hidden>
          |
        </span>
        <span className="sr-only">, </span>
        {ROLE}
        <br />
        Based in Middletown, CT. Open to remote roles.
      </p>

      <ul className="contact-methods" aria-label="Contact details">
        <li className="contact-method">
          <span className="contact-method__key">email</span>
          <a className="contact-method__value" href={mailtoHref}>
            {EMAIL}
          </a>
          <button type="button" className="contact-method__copy" onClick={() => copy(EMAIL)}>
            {copied === EMAIL ? 'copied' : 'copy'}
            <span className="sr-only"> email address</span>
          </button>
        </li>
        <li className="contact-method">
          <span className="contact-method__key">phone</span>
          <a className="contact-method__value" href={`tel:${PHONE.replace(/\s/g, '')}`}>
            {PHONE}
          </a>
          <button type="button" className="contact-method__copy" onClick={() => copy(PHONE)}>
            {copied === PHONE ? 'copied' : 'copy'}
            <span className="sr-only"> phone number</span>
          </button>
        </li>
      </ul>
      <p className="sr-only" role="status">
        {copied ? 'Copied to the clipboard.' : ''}
      </p>

      <div className="contact__actions">
        <a className="contact-cta contact-cta--primary" href={mailtoHref}>
          Send email
          <span aria-hidden>→</span>
        </a>
        <a className="contact__link" href={DEVPOST} target="_blank" rel="noreferrer">
          Devpost profile
        </a>
      </div>
    </PanelShell>
  );
}
