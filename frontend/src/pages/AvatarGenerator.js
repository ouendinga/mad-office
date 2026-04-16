import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SKIN_TONES, HAIR_STYLES, HAIR_COLORS, CLOTHES, ACCESSORIES, drawAvatar } from '../canvas/avatarSprites';
import '../styles/avatar-generator.css';

const API_URL = process.env.REACT_APP_API_URL || '';

export default function AvatarGenerator({ user, token, onAvatarSaved }) {
  const canvasRef = useRef(null);
  const [config, setConfig] = useState({
    skinTone: 0,
    hairStyle: 0,
    hairColor: 0,
    clothes: 0,
    accessory: 0,
  });
  const [saving, setSaving] = useState(false);

  const updatePreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.imageSmoothingEnabled = false;
    drawAvatar(ctx, config, 0, 0, 4);
  }, [config]);

  useEffect(() => {
    updatePreview();
  }, [updatePreview]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${user.id}/avatar`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ avatar_config: config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onAvatarSaved(data);
    } catch (err) {
      alert('Error saving avatar: ' + err.message);
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

  return (
    <div className="avatar-gen">
      <div className="avatar-gen-container">
        <h1 className="pixel-font avatar-gen-title">Crea tu Avatar</h1>
        <p className="avatar-gen-subtitle">Personaliza tu avatar pixel art para la oficina</p>

        <div className="avatar-gen-content">
          <div className="avatar-preview-section">
            <canvas ref={canvasRef} width={64} height={64} className="avatar-canvas" />
            <p className="avatar-name">{user.name}</p>
          </div>

          <div className="avatar-options">
            <OptionSelector
              label="Tono de piel"
              value={config.skinTone}
              max={SKIN_TONES.length}
              displayValue={`${config.skinTone + 1} / ${SKIN_TONES.length}`}
              onChange={(delta) => changeOption('skinTone', delta, SKIN_TONES.length)}
            />
            <OptionSelector
              label="Estilo de pelo"
              value={config.hairStyle}
              max={HAIR_STYLES.length}
              displayValue={HAIR_STYLES[config.hairStyle]}
              onChange={(delta) => changeOption('hairStyle', delta, HAIR_STYLES.length)}
            />
            <OptionSelector
              label="Color de pelo"
              value={config.hairColor}
              max={HAIR_COLORS.length}
              displayValue={`${config.hairColor + 1} / ${HAIR_COLORS.length}`}
              onChange={(delta) => changeOption('hairColor', delta, HAIR_COLORS.length)}
            />
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

        <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar y Entrar a la Oficina'}
        </button>
      </div>
    </div>
  );
}

function OptionSelector({ label, displayValue, onChange }) {
  return (
    <div className="option-selector">
      <label>{label}</label>
      <div className="option-controls">
        <button className="option-btn" onClick={() => onChange(-1)}>&lt;</button>
        <span className="option-value">{displayValue}</span>
        <button className="option-btn" onClick={() => onChange(1)}>&gt;</button>
      </div>
    </div>
  );
}
