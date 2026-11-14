import React, { useEffect, useState } from 'react';
import { api } from '../api';

// Dónde está la oficina (para el tiempo de verdad). Solo la cambia el admin.
export default function OfficeSettings({ isAdmin, onClose }) {
  const [loc, setLoc] = useState(null);
  const [weather, setWeather] = useState(null);
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hours, setHours] = useState(null);
  const [hoursMsg, setHoursMsg] = useState('');

  useEffect(() => {
    api('/settings/location').then(r => { setLoc(r.location); setWeather(r.weather); }).catch(e => setError(e.message));
    api('/settings/hours').then(setHours).catch(() => {});
  }, []);

  const saveHours = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setHoursMsg('');
    try {
      setHours(await api('/settings/hours', { method: 'PUT', body: hours }));
      setHoursMsg('Horario guardado ✓');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api('/settings/location', { method: 'PUT', body: { city } });
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
        {hours && (
          <form onSubmit={saveHours} className="settings-hours">
            <h3 className="char-h3">🕘 Horario</h3>
            <div className="settings-grid">
              <label>Entrada<input type="time" value={hours.start} disabled={!isAdmin} onChange={e => setHours({ ...hours, start: e.target.value })} /></label>
              <label>Salida<input type="time" value={hours.end} disabled={!isAdmin} onChange={e => setHours({ ...hours, end: e.target.value })} /></label>
              <label>Comida<input type="time" value={hours.lunch} disabled={!isAdmin} onChange={e => setHours({ ...hours, lunch: e.target.value })} /></label>
              <label>Minutos para comer<input type="number" min={15} max={120} step={5} value={hours.lunchMin} disabled={!isAdmin} onChange={e => setHours({ ...hours, lunchMin: e.target.value })} /></label>
            </div>
            <p className="muted">Vienen media hora antes de entrar y se van al salir. Quien hace horas extra se queda dos horas más.</p>
            {isAdmin && <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>Guardar horario</button>}
            {hoursMsg && <span className="muted"> {hoursMsg}</span>}
          </form>
        )}
        {error && <div className="modal-error">{error}</div>}
      </div>
    </div>
  );
}
