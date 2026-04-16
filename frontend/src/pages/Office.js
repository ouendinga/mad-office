import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { renderOffice, MOOD_COLORS } from '../canvas/officeRenderer';
import '../styles/office.css';

const WS_URL = process.env.REACT_APP_WS_URL || '';

export default function Office({ user, token, onLogout }) {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const animFrameRef = useRef(0);
  const rafRef = useRef(null);

  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [officeEvents, setOfficeEvents] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);

  // Connect WebSocket
  useEffect(() => {
    const socket = io(WS_URL || window.location.origin, {
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('auth', token);
    });

    socket.on('state:update', (updatedUsers) => {
      setUsers(updatedUsers);
    });

    socket.on('event:new', (event) => {
      setEvents(prev => [event, ...prev].slice(0, 50));
    });

    socket.on('office_event', (event) => {
      setOfficeEvents(prev => [event, ...prev].slice(0, 20));
      // Auto-remove after 10 seconds
      setTimeout(() => {
        setOfficeEvents(prev => prev.filter(e => e !== event));
      }, 10000);
    });

    socket.on('representation:triggered', (data) => {
      // Handled via state:update
    });

    socket.on('action:changed', (data) => {
      // Handled via state:update
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  // Canvas rendering loop
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    animFrameRef.current++;
    renderOffice(ctx, canvas, users, animFrameRef.current);

    rafRef.current = requestAnimationFrame(render);
  }, [users]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [render]);

  // Resize canvas
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const container = canvas.parentElement;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getDominantMood = (u) => {
    const moods = { happiness: u.happiness || 0, stress: u.stress || 0, frustration: u.frustration || 0, excitement: u.excitement || 0, sadness: u.sadness || 0, tiredness: u.tiredness || 0 };
    let dominant = 'happiness';
    let maxVal = 0;
    for (const [k, v] of Object.entries(moods)) {
      if (v > maxVal) { maxVal = v; dominant = k; }
    }
    return dominant;
  };

  const MOOD_LABELS = {
    happiness: 'Felicidad',
    stress: 'Estres',
    frustration: 'Frustracion',
    excitement: 'Emocion',
    sadness: 'Tristeza',
    tiredness: 'Cansancio',
  };

  const ACTION_LABELS = {
    sitting: 'Sentado',
    working_hard: 'Trabajando duro',
    slacking: 'Descansando',
    celebrating: 'Celebrando',
    pacing: 'Paseando',
    sleeping: 'Durmiendo',
    crying: 'Llorando',
    raging: 'Furioso',
  };

  return (
    <div className="office-page">
      {/* Header */}
      <header className="office-header">
        <div className="office-header-left">
          <span className="pixel-font office-logo">Mad Office</span>
        </div>
        <div className="office-header-right">
          <span className="office-user-name">{user.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <div className="office-layout">
        {/* Main canvas area */}
        <div className="office-canvas-container">
          <canvas ref={canvasRef} className="office-canvas" />

          {/* Office event notifications */}
          <div className="office-event-notifications">
            {officeEvents.map((e, i) => (
              <div key={i} className="office-event-toast">
                {e.description}
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <aside className="office-sidebar">
          {/* Team list */}
          <div className="sidebar-section">
            <h3 className="sidebar-title">Equipo</h3>
            <div className="team-list">
              {users.map(u => (
                <div
                  key={u.id}
                  className={`team-member ${selectedUser?.id === u.id ? 'selected' : ''}`}
                  onClick={() => setSelectedUser(u)}
                >
                  <div
                    className="team-member-dot"
                    style={{ background: MOOD_COLORS[getDominantMood(u)] }}
                  />
                  <div className="team-member-info">
                    <span className="team-member-name">{u.name}</span>
                    <span className="team-member-action">
                      {ACTION_LABELS[u.current_action] || u.current_action || 'Sentado'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Selected user details */}
          {selectedUser && (
            <div className="sidebar-section">
              <h3 className="sidebar-title">Estado de {selectedUser.name}</h3>
              <div className="mood-bars">
                {Object.entries(MOOD_LABELS).map(([key, label]) => (
                  <div key={key} className="mood-bar-row">
                    <span className="mood-label">{label}</span>
                    <div className="mood-bar-track">
                      <div
                        className="mood-bar-fill"
                        style={{
                          width: `${(selectedUser[key] || 0) * 10}%`,
                          background: MOOD_COLORS[key]
                        }}
                      />
                    </div>
                    <span className="mood-value">{selectedUser[key] || 0}</span>
                  </div>
                ))}
              </div>
              {selectedUser.current_representation && (
                <div className="mood-representation">
                  Representacion: <strong>{selectedUser.current_representation}</strong>
                </div>
              )}
            </div>
          )}

          {/* Event log */}
          <div className="sidebar-section">
            <h3 className="sidebar-title">Eventos Recientes</h3>
            <div className="event-log">
              {events.length === 0 && (
                <p className="event-empty">Esperando eventos...</p>
              )}
              {events.slice(0, 15).map((e, i) => (
                <div key={i} className="event-item">
                  <span className="event-source">{e.source}</span>
                  <span className="event-desc">{e.description}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
