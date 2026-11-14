import React, { useState } from 'react';
import { api } from '../api';
import '../styles/onboarding.css';

// La puerta de la oficina publicada: la contraseña común de los paneles.
export default function Gate({ configured, onOpen }) {
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
        <h1 className="pixel-font onb-title">Mad Office</h1>
        <p className="onb-sub">
          {configured ? 'La oficina está cerrada con llave. ¿La contraseña?' : 'Aún no hay contraseña puesta en esta oficina.'}
        </p>
        <div className="onb-q">
          <input type="password" autoComplete="current-password" autoFocus value={password}
            onChange={e => setPassword(e.target.value)} disabled={!configured || busy} aria-label="Contraseña" />
        </div>
        {error && <div className="modal-error">{error}</div>}
        <div className="onb-actions">
          <span />
          <button type="submit" className="btn btn-primary" disabled={!configured || busy || !password}>Entrar</button>
        </div>
      </form>
    </div>
  );
}
