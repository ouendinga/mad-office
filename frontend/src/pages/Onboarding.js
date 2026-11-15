import React, { useState } from 'react';
import { capi, waitTurn } from '../api';
import Transformacion from '../components/Transformacion';
import Contratacion from '../components/Contratacion';
import '../styles/onboarding.css';

// La entrevista: casi todo de elegir, para que nadie se quede en blanco.
const QUESTIONS = [
  { q: '¿Qué haces en tu día a día? (de verdad o inventado)', free: 'Operaciones, Sistemas, Account manager, Finanzas, Recepción…' },
  { q: 'Cuando algo se tuerce en el trabajo…', options: ['Mantengo la calma (por fuera)', 'Convoco una reunión', 'Culpo a Mercurio retrógrado', 'Me voy a por café y ya veremos'] },
  { q: '¿Tu relación con la máquina de café?', options: ['Tóxica pero estable', 'Le hablo con cariño', 'Té, gracias', 'Le debo la vida'] },
  { q: '¿Qué manía tuya conoce toda la oficina?', free: 'Agenda de colores, silbar, 40 pestañas abiertas…' },
  { q: '¿Cómo saludas por la mañana?', options: ['¡Buenos días, equipo!', 'Un gruñido', 'Un meme en el chat', 'No saludo hasta el segundo café'] },
  { q: 'Tu frase de batalla', options: ['Esto lo saco yo', '¿Lo vemos en una call?', 'Según mi Excel…', 'Ahora mismo no te sabría decir'] },
  { q: '¿Qué quieres conseguir en la oficina?', options: ['Que nadie toque mi silla', 'Ser jefe sin hacer nada', 'Ganar la porra', 'Un viernes sin reuniones'] },
  { q: 'Tu superpoder secreto', free: 'Encontrar cualquier cosa en el Drive, calmar a un cliente furioso…' },
];

// Campo libre: lo que cada uno quiera que salga en su personaje.
const FREE_Q = 'Lo que quieras añadir';

const FIELDS_EMPTY = { puesto: '', personalidad: '', manias: ['', '', ''], objetivo: '', muletillas: [] };

function normalize(ficha) {
  const f = { ...FIELDS_EMPTY, ...(ficha || {}) };
  const manias = [...(f.manias || [])];
  while (manias.length < 3) manias.push('');
  return { ...f, manias: manias.slice(0, 3), muletillas: f.muletillas || [] };
}

export default function Onboarding({ user, character, company, onDone, onBack }) {
  const hasFicha = character && character.ficha && character.ficha.puesto;
  const [step, setStep] = useState(hasFicha ? 'ficha' : 'entrevista');
  const [answers, setAnswers] = useState(() => (character && character.interview) || {});
  const [ficha, setFicha] = useState(normalize(character && character.ficha));
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState('');
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [transforming, setTransforming] = useState(false); // la escena mientras escribe la IA
  const [pending, setPending] = useState(null); // la ficha ya llegada, esperando al final de la escena
  const [hired, setHired] = useState(null); // { company, position } tras aprobar la primera vez

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
    setPending(null);
    setTransforming(true);
    window.scrollTo(0, 0);
    try {
      const r = await capi('/me/interview', { method: 'POST', body: { answers } });
      setAttemptsLeft(r.attemptsLeft);
      const out = await waitTurn(r.turnId, { onSlow: () => setSlow(true) });
      setPending(normalize(out)); // la escena termina con su fogonazo y luego enseña la ficha
    } catch (e) {
      setTransforming(false);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const approve = async () => {
    setBusy(true);
    setError('');
    try {
      const r = await capi('/me/ficha', {
        method: 'PUT',
        body: { approve: true, ficha: { ...ficha, manias: ficha.manias.filter(Boolean) } },
      });
      if (r.hired) setHired(r.hired);
      else onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  const set = (k, v) => setFicha({ ...ficha, [k]: v });

  const endTransform = () => {
    setFicha(pending);
    setPending(null);
    setTransforming(false);
    setStep('ficha');
  };

  if (hired) {
    return <Contratacion avatar={user.avatar_config} name={(character && character.name) || user.name}
      company={hired.company} position={hired.position} onDone={onDone} />;
  }
  if (transforming) {
    return (
      <div className="onb">
        <div className="onb-card transfo-card">
          <Transformacion avatar={user.avatar_config} answers={answers} name={(character && character.name) || user.name}
            done={!!pending} onFinish={endTransform} />
          {slow && !pending && <div className="onb-hint">Tarda más de la cuenta… ¿está encendido el despertador?</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="onb">
      <div className="onb-card">
        {step === 'entrevista' ? (
          <>
            <h1 className="pixel-font onb-title">La entrevista</h1>
            <p className="onb-sub">
              Contesta lo que quieras (mínimo 3) o tira el dado. Con esto la IA hará una caricatura cariñosa de ti, {user.name}, para {company ? company.name : 'la oficina'}, sea cual sea tu trabajo.
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
            <div className="onb-q">
              <label>{FREE_Q} <span className="onb-optional">(opcional)</span></label>
              <textarea
                rows={3}
                maxLength={400}
                value={answers[FREE_Q] || ''}
                placeholder="Lo que te haga gracia que salga: tus aficiones, tu planta, tu archienemiga la impresora, ese cliente que siempre llama a las 17:59…"
                onChange={e => setAnswers({ ...answers, [FREE_Q]: e.target.value })}
              />
            </div>
            {error && <div className="modal-error">{error}</div>}
            {slow && <div className="onb-hint">Tarda más de la cuenta… ¿está encendido el despertador?</div>}
            <div className="onb-actions">
              {onBack && <button type="button" className="btn btn-ghost" onClick={onBack} disabled={busy}>← Avatar</button>}
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
              <label>Puesto <span className="muted">(cómo describe su cargo{company && company.position_title ? `: ${company.position_title}` : ''})</span></label>
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
