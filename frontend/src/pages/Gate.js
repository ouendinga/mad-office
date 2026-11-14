import React, { useState } from 'react';
import { api } from '../api';
import '../styles/onboarding.css';

// La puerta de la oficina publicada: la contraseña común de los paneles.
export default function Gate({ configured, onOpen, onAccount }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/gate', { method: 'POST', body: { password } });
      onOpen();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="onb">
      <form className="onb-card gate-card" onSubmit={submit}>
        <img className="gate-logo" src="/logo.svg" alt="" width="64" height="64" />
        <h1 className="pixel-font onb-title">Mad Office</h1>
        <p className="onb-sub">
          {configured ? 'La oficina está cerrada con llave. ¿La contraseña?' : 'Aún no hay contraseña puesta en esta oficina.'}
        </p>
        <div className="onb-q">
          <input type="password" autoComplete="current-password" autoFocus value={password}
            onChange={e => setPassword(e.target.value)} disabled={!configured || busy} aria-label="Contraseña" />
        </div>
        {error && <div className="modal-error">{error}</div>}
        <p className="gate-note">¿Te han invitado? Abre el enlace que te pasaron: no necesitas esta contraseña.</p>
        <div className="onb-actions">
          <button type="button" className="btn btn-ghost" onClick={onAccount}>Ya tengo cuenta</button>
          <button type="submit" className="btn btn-primary" disabled={!configured || busy || !password}>Entrar</button>
        </div>
      </form>
    </div>
  );
}
