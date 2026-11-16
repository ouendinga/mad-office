import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SKIN_TONES, HAIR_STYLES, HAIR_COLORS, CLOTHES, ACCESSORIES, characterSprite } from '../engine/Character';
import { ChevronLeft, ChevronRight, Dices, LogOut } from 'lucide-react';
import '../styles/avatar-generator.css';
import { api } from '../api';


// first: es la primera vez (luego viene elegir empresa y cargo). onLogout solo entonces: la única
// salida es cerrar la sesión, y va pequeña para que no compita con «Guardar».
export default function AvatarGenerator({ user, onAvatarSaved, onCancel, onLogout, first }) {
  const canvasRef = useRef(null);
  const [config, setConfig] = useState(user.avatar_config && Object.keys(user.avatar_config).length ? user.avatar_config : {
    skinTone: 0,
    hairStyle: 0,
    hairColor: 0,
    clothes: 0,
    accessory: 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updatePreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(characterSprite(config), 0, 0, 128, 128);
  }, [config]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await api('/me/avatar', { method: 'PUT', body: { avatar_config: config } });
      onAvatarSaved(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const changeOption = (key, delta, max) => {
    setConfig(prev => ({
      ...prev,
      [key]: (prev[key] + delta + max) % max,
    }));
  };

  // 🎲 Uno al azar (distinto del actual).
  const randomize = () => {
    const r = n => Math.floor(Math.random() * n);
    setConfig(prev => {
      let next;
      do {
        next = { skinTone: r(SKIN_TONES.length), hairStyle: r(HAIR_STYLES.length), hairColor: r(HAIR_COLORS.length), clothes: r(CLOTHES.length), accessory: r(ACCESSORIES.length) };
      } while (JSON.stringify(next) === JSON.stringify(prev));
      return next;
    });
  };

  return (
    <div className="avatar-gen">
      <div className="avatar-gen-container">
        <h1 className="avatar-gen-title">Tu avatar</h1>
        <p className="avatar-gen-subtitle">
          {first ? 'Así te verán en la oficina. Es el mismo en todas tus empresas y lo puedes cambiar cuando quieras.' : 'Así te verán en todas tus empresas.'}
        </p>

        <div className="avatar-gen-content">
          <div className="avatar-preview-section">
            <canvas ref={canvasRef} width={128} height={128} className="avatar-canvas" />
            <p className="avatar-name">{user.name}</p>
            <button type="button" className="btn btn-secondary btn-sm avatar-random" onClick={randomize}><Dices size={16} aria-hidden /> Al azar</button>
          </div>

          <div className="avatar-options">
            <Swatches label="Tono de piel" colors={SKIN_TONES} value={config.skinTone}
              onPick={i => setConfig(prev => ({ ...prev, skinTone: i }))} />
            <OptionSelector
              label="Estilo de pelo"
              value={config.hairStyle}
              max={HAIR_STYLES.length}
              displayValue={HAIR_STYLES[config.hairStyle]}
              onChange={(delta) => changeOption('hairStyle', delta, HAIR_STYLES.length)}
            />
            <Swatches label="Color de pelo" colors={HAIR_COLORS} value={config.hairColor}
              onPick={i => setConfig(prev => ({ ...prev, hairColor: i }))} />
            <OptionSelector
              label="Ropa"
              value={config.clothes}
              max={CLOTHES.length}
              displayValue={CLOTHES[config.clothes]}
              onChange={(delta) => changeOption('clothes', delta, CLOTHES.length)}
            />
            <OptionSelector
              label="Accesorios"
              value={config.accessory}
              max={ACCESSORIES.length}
              displayValue={ACCESSORIES[config.accessory]}
              onChange={(delta) => changeOption('accessory', delta, ACCESSORIES.length)}
            />
          </div>
        </div>

        {error && <div className="modal-error">{error}</div>}
        <div className="avatar-gen-actions">
          {onCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>Volver sin cambiar</button>
          )}
          <button type="button" className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
        {onLogout && (
          <button type="button" className="link-btn avatar-logout" onClick={onLogout} disabled={saving}>
            <LogOut size={14} aria-hidden /> No soy yo: cerrar sesión
          </button>
        )}
      </div>
    </div>
  );
}

// Muestras de color: se ve el color y se elige de un toque (antes era «1 / 4» con flechas).
const COLOR_NAMES = {
  'Tono de piel': ['Muy clara', 'Clara', 'Morena', 'Oscura'],
  'Color de pelo': ['Negro', 'Castaño', 'Rubio oscuro', 'Rubio', 'Pelirrojo', 'Canoso'],
};
function Swatches({ label, colors, value, onPick }) {
  const names = COLOR_NAMES[label] || [];
  return (
    <div className="option-selector">
      <span className="option-label" id={`sw-${label}`}>{label}</span>
      <div className="option-swatches" role="radiogroup" aria-labelledby={`sw-${label}`}>
        {colors.map((c, i) => (
          <button key={c} type="button" role="radio" aria-checked={value === i} aria-label={names[i] || `${label} ${i + 1}`}
            title={names[i]} className={`swatch ${value === i ? 'is-on' : ''}`} style={{ background: c }} onClick={() => onPick(i)} />
        ))}
      </div>
    </div>
  );
}

function OptionSelector({ label, displayValue, onChange }) {
  return (
    <div className="option-selector">
      <span className="option-label">{label}</span>
      <div className="option-controls">
        <button type="button" className="option-btn" aria-label={`${label}: anterior`} onClick={() => onChange(-1)}><ChevronLeft size={18} aria-hidden /></button>
        <span className="option-value">{displayValue}</span>
        <button type="button" className="option-btn" aria-label={`${label}: siguiente`} onClick={() => onChange(1)}><ChevronRight size={18} aria-hidden /></button>
      </div>
    </div>
  );
}
