import React, { useEffect, useState } from 'react';
import { capi } from '../api';

// Dónde está la oficina (para el tiempo de verdad). Va dentro de «Ajustes», que solo ve quien
// lleva la empresa (antes era una ventana aparte, «Oficina»).
export default function LocationSection() {
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
    <>
      {loc && (
        <p>
          Está en <strong>{loc.city}</strong>{loc.country ? `, ${loc.country}` : ''}.
          {weather && <> Ahora: {weather.desc}, {Math.round(weather.temp)} °C.</>}
        </p>
      )}
      <p className="muted">El tiempo y la estación de la oficina son los de verdad de ese sitio: si llueve allí, llueve aquí.</p>
      <form onSubmit={save} className="set-row" style={{ marginTop: '0.6rem' }}>
        <label>Moverla a otra ciudad
          <input type="text" value={city} onChange={e => setCity(e.target.value)} placeholder="Barcelona, Bilbao, Buenos Aires…" maxLength={80} />
        </label>
        <button type="submit" className="btn btn-secondary btn-sm" disabled={busy || !city.trim()}>{busy ? 'Buscando…' : 'Mover la oficina'}</button>
      </form>
      {error && <div className="modal-error">{error}</div>}
    </>
  );
}
