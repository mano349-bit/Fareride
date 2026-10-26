import {CHAT_TEXT_LIMIT, chatParticipant, canSendChat, chatJobs, chatJobLabel, chatMessage} from './job-chat-state.js?v=20261026-job-chat';

// The view owns subscriptions and drafts so switching jobs or accounts cannot mix conversations.
export function mountJobChat(host, transport) {
  host.innerHTML = `<h2>Live job chat</h2>
    <p>Messages are shared with the rider, assigned driver and FareRide Admin.</p>
    <label for="jobChatJob">Job</label><select id="jobChatJob" aria-label="Choose a job conversation"></select>
    <div class="job-chat-log" role="log" aria-label="Job messages" aria-live="polite" aria-relevant="additions text" tabindex="0"></div>
    <form class="job-chat-form"><label for="jobChatText">Message</label>
      <textarea id="jobChatText" rows="2" maxlength="${CHAT_TEXT_LIMIT}" placeholder="Type a message…" disabled></textarea>
      <button type="submit" disabled>Send message</button></form>
    <p class="job-chat-status" role="status" aria-live="polite">Sign in to use live job chat.</p>
    <button class="job-chat-retry" type="button" hidden>Reconnect chat</button>`;
  const picker = host.querySelector('select'), log = host.querySelector('[role="log"]');
  const form = host.querySelector('form'), input = host.querySelector('textarea');
  const send = host.querySelector('button[type="submit"]'), retry = host.querySelector('.job-chat-retry'), status = host.querySelector('[role="status"]');
  let identity = null, jobs = [], selected = '', ride = null, ready = false, readError = '';
  let stopJobs, stopRide, stopMessages, sessionVersion = 0, threadVersion = 0, destroyed = false;
  const drafts = new Map(), sending = new Set();
  function controls() {
    const allowed = ready && !readError && canSendChat(ride, identity);
    input.disabled = !allowed;
    send.disabled = !allowed || sending.has(selected) || !input.value.trim();
    send.textContent = sending.has(selected) ? 'Sending…' : 'Send message';
  }
  function pickerOptions() {
    const available = [...jobs];
    if (selected && !available.some(job => job.id === selected)) available.unshift(ride || {id: selected, status: 'unavailable'});
    picker.replaceChildren();
    if (!available.length) {
      const option = document.createElement('option');
      option.value = ''; option.textContent = identity ? 'No live jobs right now' : 'Sign in to see your jobs';
      picker.append(option);
    }
    for (const job of available) {
      const option = document.createElement('option'); option.value = job.id; option.textContent = chatJobLabel(job); picker.append(option);
    }
    picker.value = selected;
    picker.disabled = !identity || !available.length;
  }
  function clearThread() {
    threadVersion++; stopRide?.(); stopMessages?.(); stopRide = stopMessages = null;
    ride = null; ready = false; readError = ''; retry.hidden = true; log.replaceChildren();
  }
  function denyThread(message) {
    clearThread(); readError = message;
    status.textContent = message; retry.hidden = false; controls();
  }
  function selectJob(id) {
    if (selected) drafts.set(selected, input.value);
    clearThread(); selected = id; input.value = drafts.get(id) || ''; pickerOptions(); controls();
    if (!id || !identity) {status.textContent = identity ? 'Your conversation appears when you have a live job.' : 'Sign in to use live job chat.'; return;}
    status.textContent = 'Connecting to this job’s chat…';
    const version = threadVersion, session = sessionVersion;
    const current = () => !destroyed && sessionVersion === session && threadVersion === version;
    stopRide = transport.watchRide(id, next => {
      if (!current()) return;
      if (!next || !chatParticipant(next, identity)) {denyThread('This conversation is no longer available to your account.'); return;}
      ride = {...next, id}; pickerOptions(); controls();
      if (!canSendChat(ride, identity)) status.textContent = 'Job ended. This conversation is read-only.';
      if (!stopMessages) stopMessages = transport.watchMessages(id, messages => {
        if (!current() || !chatParticipant(ride, identity)) return;
        const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 60;
        const previousIds = Array.from(log.children, node => node.dataset.messageId).join('|');
        const fragment = document.createDocumentFragment();
        for (const message of messages) {
          const row = document.createElement('div'); row.className = 'job-chat-message'; row.dataset.messageId = message.id;
          const author = document.createElement('strong');
          const role = {rider: 'Rider', driver: 'Driver', admin: 'FareRide Admin'}[message.senderRole] || 'Participant';
          author.textContent = `${message.senderId === identity.uid ? 'You · ' : ''}${role}`;
          const at = message.createdAt?.toDate?.();
          const time = document.createElement('small'); time.textContent = message.pending ? 'Sending…' : at ? at.toLocaleString() : '';
          const text = document.createElement('p'); text.textContent = String(message.text ?? '');
          row.append(author, time, text); fragment.append(row);
        }
        log.replaceChildren(fragment);
        if (!messages.length) log.textContent = 'No messages yet. Start the conversation.';
        if (nearBottom || !previousIds) log.scrollTop = log.scrollHeight;
        ready = true; readError = ''; controls();
        status.textContent = canSendChat(ride, identity) ? 'Live chat ready. Showing the latest 100 messages.' : 'Job ended. This conversation is read-only.';
      }, () => {
        if (current()) denyThread('Chat could not connect. Choose Reconnect chat. Contact FareRide Admin if this continues.');
      });
    }, () => {if (current()) denyThread('Unable to access this job’s chat. Contact FareRide Admin.');});
  }
  function sessionChanged(next) {
    if (destroyed) return;
    sessionVersion++; stopJobs?.(); stopJobs = null; clearThread();
    identity = next; selected = ''; jobs = []; drafts.clear(); sending.clear(); input.value = '';
    pickerOptions(); controls(); status.textContent = next ? 'Loading live jobs…' : 'Sign in to use live job chat.';
    if (!next) return;
    const version = sessionVersion;
    stopJobs = transport.watchJobs(next, rides => {
      if (destroyed || version !== sessionVersion) return;
      jobs = chatJobs(rides, identity);
      if (!selected && jobs.length) selectJob(jobs[0].id);
      else {pickerOptions(); if (!selected) status.textContent = 'Your conversation appears when you have a live job.';}
    }, () => {
      if (destroyed || version !== sessionVersion) return;
      status.textContent = 'Unable to load live jobs. Choose Reconnect chat.'; retry.hidden = false;
    });
  }
  retry.addEventListener('click', () => {if (selected) selectJob(selected); else sessionChanged(identity);});
  picker.addEventListener('change', () => selectJob(picker.value));
  input.addEventListener('input', () => {drafts.set(selected, input.value); controls();});
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || readError || sending.has(selected)) return;
    let message;
    try {message = chatMessage(ride, identity, input.value);} catch (error) {status.textContent = error.message; return;}
    const id = selected, version = sessionVersion, raw = input.value;
    drafts.set(id, raw); sending.add(id); controls(); status.textContent = 'Sending message…';
    try {
      await transport.sendMessage(id, message);
      if (destroyed || version !== sessionVersion) return;
      if (drafts.get(id) === raw) drafts.delete(id);
      if (selected === id && input.value === raw) input.value = '';
      if (selected === id) status.textContent = 'Message sent.';
    } catch {
      if (!destroyed && version === sessionVersion && selected === id) status.textContent = 'Message was not sent. Your text is saved here; check your connection and try again.';
    } finally {
      if (!destroyed && version === sessionVersion) {sending.delete(id); controls();}
    }
  });
  const stopSession = transport.watchSession(sessionChanged);
  return {destroy() {destroyed = true; sessionVersion++; stopSession?.(); stopJobs?.(); clearThread(); identity = null; selected = ''; drafts.clear(); sending.clear(); host.replaceChildren();}};
}
