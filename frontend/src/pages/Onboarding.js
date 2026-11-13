import React, { useState } from 'react';
import { api, waitTurn } from '../api';
import '../styles/onboarding.css';

// La entrevista: casi todo de elegir, para que nadie se quede en blanco.
const QUESTIONS = [
  { q: '¿Tu puesto? (de verdad o inventado)', free: 'Backend, Product Owner, Señor de los Excels…' },
  { q: '¿Qué haces cuando se cae producción?', options: ['Echo la culpa a la caché', 'Reinicio todo y rezo', 'Me hago el muerto', 'Abro un ticket y me voy a por café'] },
  { q: '¿Tu relación con la máquina de café?', options: ['Tóxica pero estable', 'Le hablo con cariño', 'Té, gracias', 'Le debo la vida'] },
  { q: '¿Qué manía tuya conoce toda la oficina?', free: '40 pestañas abiertas, silbar al compilar…' },
  { q: '¿Cómo saludas por la mañana?', options: ['¡Buenos días, equipo!', 'Un gruñido', 'Un meme en el chat', 'No saludo hasta el segundo café'] },
  { q: '¿Qué quieres conseguir en la oficina?', options: ['Que nadie toque mi silla', 'Ser jefe sin hacer nada', 'Ganar la porra', 'Un viernes sin reuniones'] },
  { q: 'Tu superpoder secreto', free: 'Encontrar el bug con solo mirarlo…' },
];

const FIELDS_EMPTY = { puesto: '', personalidad: '', manias: ['', '', ''], objetivo: '', muletillas: [] };

function normalize(ficha) {
  const f = { ...FIELDS_EMPTY, ...(ficha || {}) };
  const manias = [...(f.manias || [])];
  while (manias.length < 3) manias.push('');
  return { ...f, manias: manias.slice(0, 3), muletillas: f.muletillas || [] };
}

export default function Onboarding({ user, character, onDone }) {
  const hasFicha = character && character.ficha && character.ficha.puesto;
  const [step, setStep] = useState(hasFicha ? 'ficha' : 'entrevista');
  const [answers, setAnswers] = useState(() => (character && character.interview) || {});
  const [ficha, setFicha] = useState(normalize(character && character.ficha));
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(null);

  const answered = Object.values(answers).filter(v => v && v.trim()).length;

  const randomFill = () => {
    const next = { ...answers };
    for (const it of QUESTIONS) {
      if (!next[it.q] && it.options) next[it.q] = it.options[Math.floor(Math.random() * it.options.length)];
    }
    setAnswers(next);
  };

  const generate = async () => {
    setBusy(true);
    setSlow(false);
    setError('');
    try {
      const r = await api('/me/interview', { method: 'POST', body: { answers } });
      setAttemptsLeft(r.attemptsLeft);
      const out = await waitTurn(r.turnId, { onSlow: () => setSlow(true) });
      setFicha(normalize(out));
      setStep('ficha');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    setBusy(true);
    setError('');
    try {
      await api('/me/ficha', {
        method: 'PUT',
        body: { approve: true, ficha: { ...ficha, manias: ficha.manias.filter(Boolean) } },
      });
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const set = (k, v) => setFicha({ ...ficha, [k]: v });

  return (
    <div className="onb">
      <div className="onb-card">
        {step === 'entrevista' ? (
          <>
            <h1 className="pixel-font onb-title">La entrevista</h1>
            <p className="onb-sub">
              Contesta como quieras (mínimo 3). Con esto la IA hará una caricatura cariñosa de ti, {user.name}.
              Luego la retocas tú.
            </p>
            {QUESTIONS.map(it => (
              <div className="onb-q" key={it.q}>
                <label>{it.q}</label>
                {it.options && (
                  <div className="onb-options">
                    {it.options.map(o => (
                      <button
                        type="button"
                        key={o}
                        className={`onb-chip ${answers[it.q] === o ? 'is-on' : ''}`}
                        onClick={() => setAnswers({ ...answers, [it.q]: answers[it.q] === o ? '' : o })}
                      >{o}</button>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  maxLength={160}
                  value={answers[it.q] && (!it.options || !it.options.includes(answers[it.q])) ? answers[it.q] : ''}
                  placeholder={it.free || 'O escribe la tuya…'}
                  onChange={e => setAnswers({ ...answers, [it.q]: e.target.value })}
                />
              </div>
            ))}
            {error && <div className="modal-error">{error}</div>}
            {slow && <div className="onb-hint">Tarda más de la cuenta… ¿está encendido el despertador?</div>}
            <div className="onb-actions">
              <button type="button" className="btn btn-ghost" onClick={randomFill} disabled={busy}>No sé qué poner 🎲</button>
              <button type="button" className="btn btn-primary" onClick={generate} disabled={busy || answered < 3}>
                {busy ? 'La IA te está caricaturizando…' : 'Crear mi personaje'}
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="pixel-font onb-title">Tu personaje</h1>
            <p className="onb-sub">Así vivirá en la oficina. Cambia lo que quieras: es tu caricatura y mandas tú.</p>
            <div className="onb-q">
              <label>Puesto</label>
              <input maxLength={60} value={ficha.puesto} onChange={e => set('puesto', e.target.value)} />
            </div>
            <div className="onb-q">
              <label>Personalidad</label>
              <textarea maxLength={300} rows={3} value={ficha.personalidad} onChange={e => set('personalidad', e.target.value)} />
            </div>
            <div className="onb-q">
              <label>Manías</label>
              {ficha.manias.map((m, i) => (
                <input key={i} maxLength={120} value={m}
                  onChange={e => set('manias', ficha.manias.map((x, j) => (j === i ? e.target.value : x)))} />
              ))}
            </div>
            <div className="onb-q">
              <label>Objetivo en la oficina</label>
              <input maxLength={150} value={ficha.objetivo} onChange={e => set('objetivo', e.target.value)} />
            </div>
            <div className="onb-q">
              <label>Muletillas (una por línea)</label>
              <textarea rows={5} value={ficha.muletillas.join('\n')}
                onChange={e => set('muletillas', e.target.value.split('\n').map(x => x.slice(0, 60)).slice(0, 8))} />
            </div>
            {error && <div className="modal-error">{error}</div>}
            <div className="onb-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setStep('entrevista')} disabled={busy}>
                Otra versión{attemptsLeft != null ? ` (${attemptsLeft})` : ''}
              </button>
              <button type="button" className="btn btn-primary" onClick={approve} disabled={busy}>¡Que viva! 🎉</button>
            </div>
            <p className="onb-foot">Se despierta en la oficina el próximo día laborable a las 9:00 (o ya mismo, si es horario de oficina).</p>
          </>
        )}
      </div>
    </div>
  );
}
