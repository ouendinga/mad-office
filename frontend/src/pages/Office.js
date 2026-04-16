import React, { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { renderOffice, MOOD_COLORS, getCamera, getTileMap } from '../canvas/officeRenderer';
import Movement from '../engine/Movement';
import '../styles/office.css';

const WS_URL = process.env.REACT_APP_WS_URL || '';
const API_URL = process.env.REACT_APP_API_URL || '';

const MOOD_LABELS = {
  alegria: { name: 'Alegria', low: 'Tristeza', high: 'Felicidad' },
  energia: { name: 'Energia', low: 'Cansancio', high: 'Energico' },
  optimismo: { name: 'Optimismo', low: 'Pesimismo', high: 'Optimista' },
  frustracion: { name: 'Frustracion', low: 'Frustrado', high: 'Complacido' },
  estres: { name: 'Estres', low: 'Estresado', high: 'Chill' },
};

const ACTION_LABELS = {
  sentado: 'Sentado',
  rabieta: 'Montando una rabieta',
  celebrando: 'Celebrando',
  holgazaneando: 'Holgazaneando',
  durmiendo: 'Durmiendo',
  lavabo: 'En el lavabo',
  corriendo: 'Corriendo',
  reunido: 'En reunion',
  paseando: 'Paseando',
  pizarra: 'En la pizarra',
};

const REPRESENTATION_LABELS = {
  llorando: 'Llorando',
  enfadado: 'Enfadado',
  somnoliento: 'Somnoliento',
  cantando: 'Cantando',
  tirandose_del_pelo: 'Tirandose del pelo',
  nube_en_la_cabeza: 'Nube en la cabeza',
};

const EMOJI_LIST = ['😀', '😂', '😍', '🎉', '👍', '🔥', '😢', '😡', '💤', '☕', '🍕', '🐱'];

export default function Office({ user, token, onLogout, onEditAvatar, setUser }) {
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const animFrameRef = useRef(0);
  const animTickRef = useRef(0);
  const rafRef = useRef(null);
  const movementRef = useRef(null);
  const remotePositions = useRef({});  // userId -> {x, y, moving}

  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [officeEvents, setOfficeEvents] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRanking, setShowRanking] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [virtualClock, setVirtualClock] = useState({ hour: 9, minute: 0, working: true });
  const [profileName, setProfileName] = useState(user.name);
  const [profileEmail, setProfileEmail] = useState(user.email);
  const [currentZone, setCurrentZone] = useState(null);
  const chatEndRef = useRef(null);

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
      setTimeout(() => {
        setOfficeEvents(prev => prev.filter(e => e !== event));
      }, 10000);
    });

    socket.on('reaction:new', (data) => {
      setReactions(prev => [...prev, { ...data, id: Date.now() + Math.random() }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== data.id));
      }, 3000);
    });

    socket.on('chat:history', (messages) => {
      setChatMessages(messages);
    });

    socket.on('chat:message', (msg) => {
      setChatMessages(prev => [...prev, msg]);
    });

    socket.on('clock:update', (clock) => {
      setVirtualClock(clock);
    });

    // Posiciones remotas de otros usuarios (movimiento manual)
    socket.on('position:remote', (data) => {
      remotePositions.current[data.userId] = {
        x: data.x, y: data.y, moving: data.moving
      };
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Inicializar Movement controller
  useEffect(() => {
    // Forzar un primer render para que tileMap se inicialice
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      renderOffice(ctx, canvas, [], 0, [], virtualClock);
    }

    const tileMap = getTileMap();
    if (!tileMap) return;

    const movement = new Movement(tileMap);
    const deskPos = tileMap.getDeskPosition(user.desk_index || 0);
    const startX = deskPos ? deskPos.x : tileMap.pixelW / 2;
    const startY = deskPos ? deskPos.y + 40 : tileMap.pixelH / 2;
    movement.init(startX, startY);

    movement.onPositionChange = (x, y, moving) => {
      if (socketRef.current) {
        socketRef.current.emit('position:update', { x, y, moving });
      }
    };

    movement.onZoneEnter = (zone) => setCurrentZone(zone);
    movement.onZoneLeave = () => setCurrentZone(null);

    movementRef.current = movement;

    return () => movement.destroy();
    // eslint-disable-next-line
  }, [user.desk_index]);

  // Canvas rendering loop con movement update
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;

    animFrameRef.current++;
    if (animFrameRef.current % 6 === 0) {
      animTickRef.current++;
    }

    // Actualizar movimiento del usuario
    const mv = movementRef.current;
    if (mv) {
      mv.update();

      // Camara sigue al avatar del usuario
      const cam = getCamera();
      if (cam) {
        cam.follow(mv.x, mv.y);
      }

      // Inyectar posicion local del usuario en la lista de users
      // y posiciones remotas de otros usuarios
      const enrichedUsers = users.map(u => {
        if (u.id === user.id) {
          return { ...u, position_x: mv.x, position_y: mv.y, _isLocal: true, _moving: mv.moving };
        }
        const remote = remotePositions.current[u.id];
        if (remote) {
          return { ...u, position_x: remote.x, position_y: remote.y, _moving: remote.moving };
        }
        return u;
      });

      renderOffice(ctx, canvas, enrichedUsers, animTickRef.current, reactions, virtualClock);
    } else {
      renderOffice(ctx, canvas, users, animTickRef.current, reactions, virtualClock);
    }

    rafRef.current = requestAnimationFrame(render);
  }, [users, reactions, virtualClock, user.id]);

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

  // Click en canvas → mover avatar
  const handleCanvasClick = useCallback((e) => {
    const mv = movementRef.current;
    const cam = getCamera();
    if (!mv || !cam) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = cam.screenToWorld(screenX, screenY);
    mv.handleClick(world.x, world.y);
  }, []);

  // Desactivar movimiento cuando se escribe en chat
  const handleChatFocus = () => {
    if (movementRef.current) movementRef.current.enabled = false;
  };
  const handleChatBlur = () => {
    if (movementRef.current) movementRef.current.enabled = true;
  };

  const sendReaction = (emoji) => {
    if (socketRef.current) {
      socketRef.current.emit('reaction:send', { emoji });
    }
  };

  const sendChat = (e) => {
    e.preventDefault();
    if (chatInput.trim() && socketRef.current) {
      socketRef.current.emit('chat:send', { message: chatInput.trim() });
      setChatInput('');
    }
  };

  const saveProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/${user.id}/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: profileName, email: profileEmail })
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        setShowProfile(false);
      }
    } catch (err) {
      console.error('Error guardando perfil:', err);
    }
  };

  const getDominantMood = (u) => {
    const moods = { alegria: u.alegria || 5, energia: u.energia || 5, optimismo: u.optimismo || 5, frustracion: u.frustracion || 5, estres: u.estres || 5 };
    // Find worst mood (lowest value = most negative)
    let worst = 'alegria';
    let minVal = 10;
    for (const [k, v] of Object.entries(moods)) {
      if (v < minVal) { minVal = v; worst = k; }
    }
    return minVal < 4 ? worst : 'neutral';
  };

  // Rankings
  const getRankings = () => {
    const sorted = (key, asc) => [...users].sort((a, b) => asc ? (a[key] || 5) - (b[key] || 5) : (b[key] || 5) - (a[key] || 5));
    return {
      feliz: sorted('alegria', false),
      energico: sorted('energia', false),
      estresado: sorted('estres', true),
      frustrado: sorted('frustracion', true),
    };
  };

  const formatClock = () => {
    const h = String(virtualClock.hour).padStart(2, '0');
    const m = String(virtualClock.minute).padStart(2, '0');
    return `${h}:${m}`;
  };

  return (
    <div className="office-page">
      {/* Header */}
      <header className="office-header">
        <div className="office-header-left">
          <span className="pixel-font office-logo">Mad Office</span>
          <span className="office-clock">{formatClock()}{!virtualClock.working && ' (Fuera de horario)'}</span>
        </div>
        <div className="office-header-right">
          <span className="office-user-name">{user.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowProfile(true)}>Perfil</button>
          <button className="btn btn-ghost btn-sm" onClick={onEditAvatar}>Avatar</button>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Salir</button>
        </div>
      </header>

      <div className="office-layout">
        {/* Main canvas area */}
        <div className="office-canvas-container">
          <canvas ref={canvasRef} className="office-canvas" onClick={handleCanvasClick} />

          {/* Indicador de zona */}
          {currentZone && (
            <div className="zone-indicator">
              <span className="zone-indicator-icon">📍</span>
              <span>{currentZone.label}</span>
            </div>
          )}

          {/* Office event notifications */}
          <div className="office-event-notifications">
            {officeEvents.map((e, i) => (
              <div key={i} className="office-event-toast">{e.description}</div>
            ))}
          </div>

          {/* Emoji bar */}
          <div className="emoji-bar">
            {EMOJI_LIST.map((emoji, i) => (
              <button key={i} className="emoji-btn" onClick={() => sendReaction(emoji)}>{emoji}</button>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <aside className="office-sidebar">
          {/* Sidebar buttons */}
          <div className="sidebar-buttons">
            <button className={`sidebar-tab ${!showRanking && !showChat ? 'active' : ''}`} onClick={() => { setShowRanking(false); setShowChat(false); }}>Equipo</button>
            <button className={`sidebar-tab ${showRanking ? 'active' : ''}`} onClick={() => { setShowRanking(true); setShowChat(false); }}>Ranking</button>
            <button className={`sidebar-tab ${showChat ? 'active' : ''}`} onClick={() => { setShowChat(true); setShowRanking(false); }}>Chat</button>
          </div>

          {/* Chat panel */}
          {showChat && (
            <div className="sidebar-section chat-section">
              <div className="chat-messages">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`chat-msg ${msg.user_id === user.id ? 'own' : ''}`}>
                    <span className="chat-msg-name">{msg.user_name || msg.userName}</span>
                    <span className="chat-msg-text">{msg.message}</span>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form className="chat-input-form" onSubmit={sendChat}>
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onFocus={handleChatFocus} onBlur={handleChatBlur} placeholder="Escribe un mensaje..." className="chat-input" />
                <button type="submit" className="btn btn-primary btn-sm">Enviar</button>
              </form>
            </div>
          )}

          {/* Ranking panel */}
          {showRanking && !showChat && (
            <div className="sidebar-section">
              <h3 className="sidebar-title">Ranking de estados</h3>
              {users.length > 0 && (() => {
                const rankings = getRankings();
                return (
                  <div className="rankings">
                    <div className="ranking-group">
                      <h4>Mas feliz</h4>
                      {rankings.feliz.slice(0, 3).map((u, i) => (
                        <div key={u.id} className="ranking-item"><span className="ranking-pos">{i + 1}.</span> {u.name} <span className="ranking-val">{u.alegria || 5}/10</span></div>
                      ))}
                    </div>
                    <div className="ranking-group">
                      <h4>Mas energico</h4>
                      {rankings.energico.slice(0, 3).map((u, i) => (
                        <div key={u.id} className="ranking-item"><span className="ranking-pos">{i + 1}.</span> {u.name} <span className="ranking-val">{u.energia || 5}/10</span></div>
                      ))}
                    </div>
                    <div className="ranking-group">
                      <h4>Mas estresado</h4>
                      {rankings.estresado.slice(0, 3).map((u, i) => (
                        <div key={u.id} className="ranking-item"><span className="ranking-pos">{i + 1}.</span> {u.name} <span className="ranking-val">{u.estres || 5}/10</span></div>
                      ))}
                    </div>
                    <div className="ranking-group">
                      <h4>Mas frustrado</h4>
                      {rankings.frustrado.slice(0, 3).map((u, i) => (
                        <div key={u.id} className="ranking-item"><span className="ranking-pos">{i + 1}.</span> {u.name} <span className="ranking-val">{u.frustracion || 5}/10</span></div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Team list (default view) */}
          {!showRanking && !showChat && (
            <>
              <div className="sidebar-section">
                <h3 className="sidebar-title">Equipo ({users.length} conectados)</h3>
                <div className="team-list">
                  {users.map(u => (
                    <div key={u.id} className={`team-member ${selectedUser?.id === u.id ? 'selected' : ''}`} onClick={() => setSelectedUser(u)}>
                      <div className="team-member-dot" style={{ background: MOOD_COLORS[getDominantMood(u)] || '#6C6C8A' }} />
                      <div className="team-member-info">
                        <span className="team-member-name">{u.name}</span>
                        <span className="team-member-action">{ACTION_LABELS[u.current_action] || u.current_action || 'Sentado'}</span>
                        {u.current_representation && (
                          <span className="team-member-repr">{REPRESENTATION_LABELS[u.current_representation] || u.current_representation}</span>
                        )}
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
                    {Object.entries(MOOD_LABELS).map(([key, label]) => {
                      const val = selectedUser[key] || 5;
                      return (
                        <div key={key} className="mood-bar-row">
                          <span className="mood-label">{val <= 3 ? label.low : val >= 7 ? label.high : label.name}</span>
                          <div className="mood-bar-track">
                            <div className="mood-bar-fill" style={{ width: `${val * 10}%`, background: MOOD_COLORS[key] || '#6C6C8A' }} />
                          </div>
                          <span className="mood-value">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                  {selectedUser.current_representation && (
                    <div className="mood-representation">Expresion: <strong>{REPRESENTATION_LABELS[selectedUser.current_representation] || selectedUser.current_representation}</strong></div>
                  )}
                </div>
              )}

              {/* Event log */}
              <div className="sidebar-section">
                <h3 className="sidebar-title">Eventos Recientes</h3>
                <div className="event-log">
                  {events.length === 0 && <p className="event-empty">Esperando eventos...</p>}
                  {events.slice(0, 15).map((e, i) => (
                    <div key={i} className="event-item">
                      <span className="event-source">{e.source}</span>
                      <span className="event-desc">{e.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

      {/* Profile modal */}
      {showProfile && (
        <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowProfile(false); }}>
          <div className="modal">
            <button className="modal-close" onClick={() => setShowProfile(false)}>&times;</button>
            <h2 className="modal-title">Mi Perfil</h2>
            <div className="form-group">
              <label>Nombre</label>
              <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={profileEmail} onChange={e => setProfileEmail(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary btn-full" onClick={saveProfile}>Guardar</button>
              <button className="btn btn-ghost btn-full" onClick={onEditAvatar}>Cambiar Avatar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
