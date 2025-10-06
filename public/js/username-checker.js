// public/js/username-checker.js
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('username');
  const status = document.getElementById('username-status');
  const form = document.getElementById('registerForm'); // ok if null
  if (!input || !status) return;

  let debounceId;
  let controller;
  const cache = new Map();

  const MSG = {
    available: 'Username is available',
    taken: 'This username is already taken',
    tooShort: 'Must be at least 3 characters',
    tooLong: 'Must be 30 characters or fewer',
    invalidChars: 'Use only lowercase letters, numbers, underscores (_) or periods (.)',
    badEdges: 'Start and end with a letter or number',
    doubles: 'No consecutive periods or underscores',
    genericErr: 'Unable to verify username right now'
  };

  // UI helpers
  function setIdle() {
    status.textContent = '';
    status.className = 'field-status';
    input.classList.remove('is-valid', 'is-invalid');
  }
  function setOK() {
    status.textContent = MSG.available;
    status.className = 'field-status valid';
    input.classList.add('is-valid');
    input.classList.remove('is-invalid');
  }
  function setErr(msg) {
    status.textContent = msg;
    status.className = 'field-status invalid';
    input.classList.add('is-invalid');
    input.classList.remove('is-valid');
  }

  // Local validation (returns { ok: true } or { ok:false, msg } or { ok:null } for empty)
  function localValidate(v) {
    if (!v) return { ok: null };
    if (v.length < 3) return { ok: false, msg: MSG.tooShort };
    if (v.length > 30) return { ok: false, msg: MSG.tooLong };
    if (!/^[a-z0-9._]+$/.test(v)) return { ok: false, msg: MSG.invalidChars };
    if (!/^[a-z0-9].*[a-z0-9]$/.test(v)) return { ok: false, msg: MSG.badEdges };
    if (/[._]{2,}/.test(v)) return { ok: false, msg: MSG.doubles };
    return { ok: true };
  }

  async function checkRemote(v) {
    // cache to avoid repeated network calls
    if (cache.has(v)) return cache.get(v);

    controller?.abort();
    controller = new AbortController();

    const qs = new URLSearchParams({ username: v });
    const res = await fetch(`/auth/check-username?${qs}`, { signal: controller.signal });
    const data = await res.json();
    const available = !!data?.available;

    cache.set(v, available);
    return available;
  }

  function handleInput() {
    clearTimeout(debounceId);

    // force lowercase as user types
    const caret = input.selectionStart;
    let v = (input.value || '').trim().toLowerCase();
    if (input.value !== v) {
      input.value = v;
      try { input.setSelectionRange(caret, caret); } catch (_) {}
    }

    const lv = localValidate(v);
    if (lv.ok === null) return setIdle();
    if (lv.ok === false) return setErr(lv.msg);

    // no "checking…" message — leave status blank while we debounce
    setIdle();

    debounceId = setTimeout(async () => {
      try {
        const avail = await checkRemote(v);
        // ignore stale response if the field changed meanwhile
        if ((input.value || '').trim().toLowerCase() !== v) return;
        avail ? setOK() : setErr(MSG.taken);
      } catch (e) {
        if (e.name !== 'AbortError') setErr(MSG.genericErr);
      }
    }, 300);
  }

  input.addEventListener('input', handleInput);
  input.addEventListener('blur', handleInput);

  // Optional: prevent submit if locally invalid
  if (form) {
    form.addEventListener('submit', (e) => {
      const v = (input.value || '').trim().toLowerCase();
      input.value = v;
      const lv = localValidate(v);
      if (lv.ok === false || lv.ok === null) {
        e.preventDefault();
        setErr(lv.ok === null ? MSG.tooShort : lv.msg);
        input.focus();
      }
    });
  }
});