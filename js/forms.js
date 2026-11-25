/* ==========================================================================
   NEXERAWEBS · js/forms.js
   --------------------------------------------------------------------------
   Contact page enquiry form.

   What it does
     - Checks each field that has data-rule="required|phone|emailOptional|consent".
     - Shows an error under the field and marks it aria-invalid.
     - Blocks bots with a hidden "honeypot" field.
     - Sends each enquiry to your inbox by email (Web3Forms, no database needed).
     - Pre-selects the plan when the page is opened as contact.html?plan=Business%20Basic
     - Until an access key is set it runs in DEMO MODE: the form works and says so,
       but nothing is sent.

   SECURITY: only the PUBLIC Web3Forms access key belongs in this file.
   ========================================================================== */
(function () {
  'use strict';
  const { $, $$ } = NX;

  /* ---------- EDIT: your settings ---------- */
  const CONFIG = {
    /* Free access key from web3forms.com. The key decides WHICH inbox receives the messages:
       create it with nexerasupport01@gmail.com. */
    emailAccessKey: 'f0e1abe0-8593-4987-b084-ac4df88bfd8a',
    emailEndpoint: 'https://api.web3forms.com/submit',
    fallbackWhatsApp: 'https://wa.me/919520903782',     // shown if sending fails
  };
  const isConfigured = !CONFIG.emailAccessKey.includes('YOUR_WEB3FORMS');

  /* ---------- Validation rules (return true, or the error message) ---------- */
  const RULES = {
    required:      (v) => !!v.trim() || 'This field is required.',
    phone:         (v) => /^[0-9]{10}$/.test(v.trim()) || 'Enter a 10-digit mobile number.',
    emailOptional: (v) => !v.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) || 'Enter a valid email address.',
    consent:       (v) => !!v || 'Please accept the policies.',
  };

  function validate(form) {
    let allValid = true;
    $$('[data-rule]', form).forEach((field) => {
      const raw = field.type === 'checkbox' ? (field.checked ? 'yes' : '') : field.value;
      const result = RULES[field.dataset.rule](raw);
      const message = document.getElementById(field.id + '-error');
      field.setAttribute('aria-invalid', String(result !== true));
      if (message) message.textContent = result === true ? '' : result;
      if (result !== true) allValid = false;
    });
    return allValid;
  }

  /* ---------- Send one message to your inbox ---------- */
  async function sendEmail(f) {
    const payload = {
      access_key: CONFIG.emailAccessKey,
      subject: `New website enquiry from ${f.name.value.trim()} (${f.selectedPlan.value})`,
      from_name: 'NEXERAWEBS website',
      name: f.name.value.trim(),
      whatsapp_number: f.phone.value.trim(),
      business: f.businessType.value,
      plan: f.selectedPlan.value,
      message: f.message.value.trim() || '(no message)',
    };
    if (f.email.value.trim()) payload.email = f.email.value.trim();     // lets you reply straight to the visitor
    const response = await fetch(CONFIG.emailEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.success === false) throw new Error(result.message || 'Email service error');
  }

  /* ---------- Wire the form up ---------- */
  NX.onReady(() => {
    const form = $('#enquiry-form');
    if (!form) return;
    const status = $('.form-status', form);
    const button = $('button[type="submit"]', form);
    const idleLabel = button.textContent;

    /* Pre-select the plan from ?plan=... (the buttons on services.html use this) */
    const planSelect = $('#e-plan');
    const wanted = new URLSearchParams(location.search).get('plan');
    const match = wanted && Array.from(planSelect.options).find((o) => o.value.toLowerCase().startsWith(wanted.toLowerCase()));
    if (match) planSelect.value = match.value;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form.elements.website.value) return;                       // honeypot filled: it's a bot

      if (!validate(form)) {
        status.className = 'form-status is-bad';
        status.textContent = 'Please fix the highlighted fields.';
        return;
      }

      button.disabled = true;
      button.textContent = 'Sending…';
      status.className = 'form-status';
      status.textContent = '';

      try {
        if (isConfigured) await sendEmail(form);
        else await new Promise((resolve) => setTimeout(resolve, 900));   // demo mode
        status.className = 'form-status is-ok';
        status.textContent = isConfigured
          ? 'Thank you. We received your details and will reach out on WhatsApp soon.'
          : 'Demo mode: the form works, but delivery is not configured yet, so nothing was sent.';
        form.reset();
      } catch (error) {
        console.error('Enquiry form error:', error);
        status.className = 'form-status is-bad';
        status.innerHTML = `Something went wrong. Please try again, or message us on <a href="${CONFIG.fallbackWhatsApp}">WhatsApp</a>.`;
      } finally {
        button.disabled = false;
        button.textContent = idleLabel;
      }
    });
  });
})();
