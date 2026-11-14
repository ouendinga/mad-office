import React, { useState } from 'react';
import '../styles/landing.css';

const API_URL = process.env.REACT_APP_API_URL || '';

export default function Landing({ onAuth, invite }) {
  const [modal, setModal] = useState(null); // 'login' | 'register' | null
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, ...(invite ? { invite } : {}) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAuth(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAuth(data.user, data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (type) => {
    setModal(type);
    setError('');
    setEmail('');
    setName('');
  };

  const closeModal = () => setModal(null);

  return (
    <div className="landing">
      {/* Header */}
      <header className="landing-header">
        <div className="landing-header-inner">
          <div className="logo">
            <span className="logo-icon">&#x1F3E2;</span>
            <span className="logo-text pixel-font">Mad Office</span>
          </div>
          <div className="header-buttons">
            <button className="btn btn-ghost" onClick={() => openModal('login')}>Entrar</button>
            <button className="btn btn-primary" onClick={() => openModal('register')}>Crear cuenta</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      {invite && (
        <div className="invite-banner" role="status">
          ✉️ Te han invitado a una empresa. Crea tu cuenta (o entra si ya tienes) y pasarás directo.
        </div>
      )}
      <section className="hero">
        <h1 className="hero-title">Mad Office</h1>
        <p className="hero-subtitle">La oficina donde tu personaje vive solo</p>
        <p className="hero-desc">Cada uno tiene una caricatura de sí mismo que trabaja, cotillea, hace tratos y escribe su diario sin que nadie le diga qué hacer. Tú solo puedes susurrarle un sueño cada noche. Por la mañana, él decide si te hace caso.</p>
        <button className="btn btn-primary btn-lg" onClick={() => openModal('login')}>Entrar a la oficina</button>
      </section>

      {/* How it works */}
      <section className="section">
        <h2 className="section-title">Cómo va</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-icon">&#x1F3A8;</div>
            <div className="step-number">1</div>
            <h3>Tu avatar</h3>
            <p>Pelo, ropa y gafas en pixel art. Un minuto.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">&#x1F3A4;</div>
            <div className="step-number">2</div>
            <h3>Una entrevista absurda</h3>
            <p>Seis preguntas y sale tu caricatura: manías, muletillas y un objetivo vital ridículo. La retocas y la apruebas.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">&#x1F319;</div>
            <div className="step-number">3</div>
            <h3>Le susurras de noche</h3>
            <p>De 18:00 a 09:00 le mandas un sueño de 200 caracteres. A las 9 se despierta y decide qué hacer con él.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="logo">
            <span className="logo-icon">&#x1F3E2;</span>
            <span className="logo-text pixel-font">Mad Office</span>
          </div>
          <p>Mad Office · comedia de oficina con personajes de IA</p>
        </div>
      </footer>

      {/* Modals */}
      {modal && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal">
            <button className="modal-close" onClick={closeModal}>&times;</button>
            {modal === 'register' ? (
              <form onSubmit={handleRegister}>
                <h2 className="modal-title">Crear cuenta</h2>
                {error && <div className="modal-error">{error}</div>}
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required />
                </div>
                <div className="form-group">
                  <label>Nombre</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" required />
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? 'Creando...' : 'Crear cuenta'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin}>
                <h2 className="modal-title">Entrar</h2>
                {error && <div className="modal-error">{error}</div>}
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" required />
                </div>
                <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
