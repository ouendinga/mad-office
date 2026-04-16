import React, { useState } from 'react';
import '../styles/landing.css';

const API_URL = process.env.REACT_APP_API_URL || '';

const TESTIMONIALS = [
  { initials: 'MG', name: 'Maria Garcia', company: 'TechStart', stars: 5, text: 'Mad Office ha transformado como nuestro equipo remoto se conecta. Los avatares son geniales y los estados automaticos nos ayudan a entender mejor a nuestros companeros.' },
  { initials: 'JP', name: 'Juan Perez', company: 'InnovateLab', stars: 5, text: 'Desde que usamos Mad Office, la comunicacion del equipo ha mejorado enormemente. Es como tener una oficina real pero mejor.' },
  { initials: 'LC', name: 'Laura Castro', company: 'DataFlow', stars: 4, text: 'Los eventos aleatorios de la oficina siempre nos sacan una sonrisa. Es una forma divertida y efectiva de trabajar en remoto.' },
];

export default function Landing({ onAuth }) {
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
        body: JSON.stringify({ email, name })
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
            <button className="btn btn-ghost" onClick={() => openModal('login')}>Login</button>
            <button className="btn btn-primary" onClick={() => openModal('register')}>Registro</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="hero">
        <h1 className="hero-title">Mad Office</h1>
        <p className="hero-subtitle">Tu oficina, en cualquier lugar del mundo</p>
        <p className="hero-desc">La plataforma de oficina virtual con avatares pixel art que reflejan el estado de animo real de tu equipo. Conecta, colabora y diviertete trabajando en remoto.</p>
        <button className="btn btn-primary btn-lg" onClick={() => openModal('register')}>Registrate</button>
      </section>

      {/* How it works */}
      <section className="section">
        <h2 className="section-title">Como funciona</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-icon">&#x1F4DD;</div>
            <div className="step-number">1</div>
            <h3>Registrate</h3>
            <p>Crea tu cuenta en segundos con solo tu email y nombre.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">&#x1F3A8;</div>
            <div className="step-number">2</div>
            <h3>Crea tu avatar y unete</h3>
            <p>Personaliza tu avatar pixel art eligiendo pelo, ropa, piel y accesorios.</p>
          </div>
          <div className="step-card">
            <div className="step-icon">&#x1F680;</div>
            <div className="step-number">3</div>
            <h3>Trabaja con tu equipo</h3>
            <p>Tu avatar refleja automaticamente tu estado de animo basado en tus actividades.</p>
            <span className="badge">Automatico</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="section section-alt">
        <h2 className="section-title">Caracteristicas</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">&#x1F4C5;</div>
            <h3>Conexion con Google Calendar, Jira y Gmail</h3>
            <p>Integraciones con las herramientas que ya usas para detectar tu actividad automaticamente.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#x1F916;</div>
            <h3>Estados automatizados</h3>
            <p>Tu avatar cambia de estado segun tu actividad real. Sin configuracion manual.</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">&#x1F3AD;</div>
            <h3>Eventos de estados de animo y acciones</h3>
            <p>Los avatares expresan emociones con animaciones y eventos aleatorios mantienen la oficina viva.</p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section">
        <h2 className="section-title">Testimonios</h2>
        <div className="testimonials-grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="testimonial-card">
              <div className="testimonial-avatar">{t.initials}</div>
              <div className="testimonial-name">{t.name}</div>
              <div className="testimonial-company">{t.company}</div>
              <div className="testimonial-stars">{'★'.repeat(t.stars)}{'☆'.repeat(5 - t.stars)}</div>
              <p className="testimonial-text">{t.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-inner">
          <div className="logo">
            <span className="logo-icon">&#x1F3E2;</span>
            <span className="logo-text pixel-font">Mad Office</span>
          </div>
          <p>&copy; 2025 Mad Office. Todos los derechos reservados.</p>
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
                  {loading ? 'Registrando...' : 'Registrarse'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin}>
                <h2 className="modal-title">Iniciar sesion</h2>
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
