import React, { useEffect, useState } from 'react';
import { capi } from '../api';

// Dónde está la oficina (para el tiempo de verdad). Solo la cambia el admin.
export default function OfficeSettings({ isAdmin, onClose }) {
  const [loc, setLoc] = useState(null);
  const [weather, setWeather] = useState(null);
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    capi('/settings/location').then(r => { setLoc(r.location); setWeather(r.weather); }).catch(e => setError(e.message));
  }, []);

  const save = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await capi('/settings/location', { method: 'PUT', body: { city } });
      setLoc(r.location);
      setWeather(r.weather);
      setCity('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">&times;</button>
        <h2 className="modal-title">La oficina</h2>
        {loc && (
          <p>
            📍 Está en <strong>{loc.city}</strong>{loc.country ? `, ${loc.country}` : ''}.
            {weather && <> Ahora: {weather.desc}, {Math.round(weather.temp)} °C.</>}
          </p>
        )}
        <p className="muted">El tiempo y la estación de la oficina son los de verdad de ese sitio: si llueve allí, llueve aquí.</p>
        {isAdmin ? (
          <form onSubmit={save} className="onb-q" style={{ marginTop: '1rem' }}>
            <label htmlFor="city">Moverla a otra ciudad</label>
            <input id="city" value={city} onChange={e => setCity(e.target.value)} placeholder="Barcelona, Bilbao, Buenos Aires…" maxLength={80} />
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy || !city.trim()}>{busy ? 'Buscando…' : 'Mover la oficina'}</button>
          </form>
        ) : <p className="muted">Solo quien lleva la oficina puede moverla.</p>}
        <p className="muted" style={{ marginTop: '0.8rem' }}>El horario, el teletrabajo y la carga de trabajo están en «🏢 Empresa».</p>
        {error && <div className="modal-error">{error}</div>}
      </div>
    </div>
  );
}
