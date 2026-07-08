'use client';

import './pantallas.css';
import { useRef, useState } from 'react';

const WHATSAPP = '5491124771444';
const DIRECCION = 'Zonda 1617, Gobernador Costa, Florencio Varela';
const HORARIO = 'Lunes a Sábados · 9:30 – 19:30';

function waLink(msg) {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

const SIGNALS = [
  {
    n: '01 · NEGROS',
    t: 'Negro real vs gris contaminado',
    b: 'En módulos OEM el píxel apagado no emite. En genéricos hay retroiluminación filtrada — el "negro" queda gris.',
    swatch: ['#1a1a1d', '#000000'],
  },
  {
    n: '02 · BRILLO MÁXIMO',
    t: 'Bajo sol directo, una se ve. La otra no.',
    b: 'Diferencia 2.5x medible. El uso al aire libre es el primer test que se nota.',
    swatch: null,
  },
  {
    n: '03 · ÁNGULO DE VISIÓN',
    t: '178° sin shift vs blanqueo desde 30°',
    b: 'Inclinás el teléfono de costado. Si los colores se lavan, no es OEM. Punto.',
    swatch: null,
  },
  {
    n: '04 · RESPUESTA AL TOUCH',
    t: 'Cuatro veces más rápida al dedo',
    b: 'Tocás un botón y la diferencia se siente sin verla. Latencia de digitizer medida en ms.',
    swatch: null,
  },
];

const SPECS = [
  ['Brillo pico', '400–500 nits', '1200–1750 nits'],
  ['Gamut sRGB', '~72%', '100%'],
  ['Refresh rate', '60 Hz', '90–120 Hz'],
  ['Latencia touch', '30–40 ms', '8–12 ms'],
  ['Vida útil estimada', '8–14 meses', '36+ meses'],
  ['Vidrio', 'Templado genérico', 'Gorilla Glass Victus / equiv.'],
  ['Capa oleofóbica', 'Ausente o débil', 'De fábrica'],
];

const REASONS = [
  {
    t: 'Panel real del fabricante',
    b: 'No es "compatible". Es el mismo módulo AMOLED que sale de la fábrica de Samsung Display o LG Display. Mismo proveedor, mismo lote.',
    tag: 'SERIAL CHECK · CADENA OEM',
  },
  {
    t: 'Calibración de fábrica',
    b: 'Cada panel sale con su perfil de color cargado. Delta-E < 2. Eso es lo que vuelve a hacer que tu equipo se vea como cuando salió de la caja.',
    tag: 'ΔE < 2 · PERFIL ICC OEM',
  },
  {
    t: 'Vidrio premium',
    b: 'Gorilla Glass Victus o equivalente OEM. Endurecimiento iónico, capa oleofóbica de fábrica. El dedo se desliza distinto. Las huellas duran menos.',
    tag: 'ION-STRENGTHENED · ANTIHUELLAS',
  },
];

const CATALOGO = [
  {
    marca: 'Samsung',
    sub: 'PANEL AMOLED · OEM',
    lineas: [
      ['FLAGSHIP', ['S24 Ultra', 'S24+', 'S24', 'S23 Ultra', 'S23+', 'S23', 'S22 Ultra', 'S22+', 'S22', 'Note 20', 'Note 10']],
      ['LÍNEA A', ['A55', 'A54', 'A53', 'A34', 'A33', 'A24', 'A14', '+ otros']],
    ],
  },
  {
    marca: 'Motorola',
    sub: 'pOLED / IPS · OEM',
    lineas: [
      ['EDGE', ['Edge 50 Pro', 'Edge 50', 'Edge 40 Pro', 'Edge 40', 'Edge 30', 'Edge 20']],
      ['MOTO G', ['G84', 'G73', 'G54', 'G53', 'G34', 'G24', 'G14']],
      ['RAZR / OTROS', ['Razr 40 Ultra', 'Razr 40', '+ otros']],
    ],
  },
];

const TESTIMONIOS = [
  { t: 'Pedí presupuesto en tres lugares. Acá me mostraron las dos pantallas prendidas al lado. No hizo falta más explicación.', nombre: 'Mariano D.', loc: 'Caballito · S22' },
  { t: 'Tenía una genérica hace 4 meses. La cambié por original y mi celu se ve como cuando lo compré. Otra cosa.', nombre: 'Florencia R.', loc: 'Almagro · A54' },
  { t: 'El comparador que tienen en el local es lo que me convenció. Ver la diferencia en vivo es otra cosa. Pagué la original sin dudar.', nombre: 'Damián P.', loc: 'Villa Crespo · Edge 40' },
];

const FAQS = [
  { q: '¿Cómo distingo un módulo original de uno genérico?', a: 'Brillo máximo bajo sol, fidelidad de color en rojos y verdes, ángulo de visión y respuesta al touch. Si te interesa, lo mostramos en vivo en el local con el comparador antes del cambio.' },
  { q: '¿Y si mi modelo es viejo o discontinuado?', a: 'Trabajamos con módulos originales NOS (stock nuevo de fábrica) o cosechados de equipos del mismo lote. Te avisamos antes de cobrar nada, con foto y origen.' },
  { q: '¿En cuánto tiempo está listo?', a: 'La mayoría de los modelos se cambian el mismo día, entre 45 minutos y 2 horas según el equipo. Modelos puntuales pueden requerir 24–48hs si el módulo viene a pedido.' },
  { q: '¿Y si el problema no es la pantalla?', a: 'Diagnóstico sin cargo. Si la falla viene de placa, batería, conector o flex, te lo decimos y cotizamos por separado. Nunca cambiamos un módulo si no era necesario.' },
  { q: '¿Aceptan el equipo viejo como parte de pago?', a: 'Sí, si el equipo enciende y el módulo viejo está sano (sin trizadura ni manchas). Cotización al momento, en mano.' },
  { q: '¿Dónde están y cómo coordino?', a: 'Buenos Aires. Coordinamos día, hora y dirección exacta por WhatsApp. Atención con turno previo.' },
];

function Comparador() {
  const trackRef = useRef(null);
  const [pct, setPct] = useState(50);
  const dragging = useRef(false);

  function aplicar(clientX) {
    const rect = trackRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    setPct(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  }

  function onPointerDown(e) {
    dragging.current = true;
    aplicar(e.clientX);
  }
  function onPointerMove(e) {
    if (!dragging.current) return;
    aplicar(e.clientX);
  }
  function onPointerUp() {
    dragging.current = false;
  }
  function onKeyDown(e) {
    if (e.key === 'ArrowLeft') setPct((p) => Math.max(0, p - 4));
    else if (e.key === 'ArrowRight') setPct((p) => Math.min(100, p + 4));
    else if (e.key === 'Home') setPct(0);
    else if (e.key === 'End') setPct(100);
  }

  return (
    <div className="pv1-comp-box">
      <div className="pv1-comp-labels">
        <span className="lado"><span className="ring" /> GENÉRICA · COMPATIBLE</span>
        <span className="lado original">ORIGINAL · OEM <span className="dot" /></span>
      </div>
      <div
        ref={trackRef}
        className="pv1-phone"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <div className="pv1-phone-screen">
          <div className="pv1-phone-photo" />
          <span className="pv1-phone-original-tag">ORIGINAL</span>
          <div className="pv1-phone-generica" style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }} />
          <div
            className="pv1-handle"
            style={{ left: `${pct}%` }}
            tabIndex={0}
            role="slider"
            aria-label="Comparar pantalla genérica vs original"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            onKeyDown={onKeyDown}
          >
            <span className="pv1-handle-grip"><span /><span /></span>
          </div>
        </div>
      </div>
      <p className="pv1-comp-caption">
        Simulación basada en mediciones de laboratorio. La comparación física se hace en el local, sobre tu equipo,
        antes de cobrarte.
      </p>
    </div>
  );
}

export default function PantallasPage() {
  const [faqOpen, setFaqOpen] = useState(null);

  return (
    <div className="pv1">
      {/* NAV */}
      <nav className="pv1-nav">
        <div className="wrap">
          <a href="/" className="pv1-nav-back">← Soporte Móvil</a>
          <a href={waLink('Hola, quiero presupuesto para pantalla original')} target="_blank" rel="noreferrer" className="pv1-nav-cta">
            <span className="pv1-dot" /> Presupuesto
          </a>
        </div>
      </nav>

      {/* HERO */}
      <section className="pv1-hero wrap">
        <div className="pv1-tag"><span className="pv1-dot" /> LAB-01 / CAMBIO DE PANTALLA / BUENOS AIRES</div>
        <h1 className="pv1-h1 disp">
          Ver para creer.<br /><span>Después no se discute.</span>
        </h1>
        <p className="pv1-lead">
          Cambio de pantalla Samsung y Motorola con módulos originales. Lado a lado, prendidas, misma foto. La
          diferencia se mide. Y se ve.
        </p>
        <div className="pv1-hero-cta">
          <a href={waLink('Hola, quiero presupuesto para pantalla original')} target="_blank" rel="noreferrer" className="pv1-btn">
            Pedir presupuesto por WhatsApp →
          </a>
          <span className="pv1-hint mono">RESPUESTA &lt; 10 MIN · {HORARIO.toUpperCase()}</span>
        </div>
      </section>

      {/* COMPARADOR */}
      <section className="pv1-sec wrap">
        <div className="pv1-sec-head">
          <div>
            <div className="pv1-sec-tag mono">COMPARADOR / 01</div>
            <div className="pv1-sec-title disp">Misma foto. Mismo equipo. Solo cambia el módulo.</div>
          </div>
          <div className="pv1-sec-hint mono">ARRASTRÁ ⇄</div>
        </div>
        <Comparador />
      </section>

      {/* SIGNALS */}
      <section className="pv1-sec wrap">
        <div className="pv1-sec-head">
          <div>
            <div className="pv1-sec-tag mono">02 / SIGNALS</div>
            <div className="pv1-sec-title disp">Lo que el ojo entrenado nota primero.</div>
          </div>
        </div>
        <p className="pv1-lead" style={{ marginBottom: 24 }}>
          Cuatro pruebas rápidas. Tres segundos cada una. Después no hace falta hablar de marcas.
        </p>
        <div className="pv1-signals">
          {SIGNALS.map((s) => (
            <div className="pv1-signal" key={s.n}>
              {s.swatch && (
                <div className="pv1-signal-swatch">
                  {s.swatch.map((c) => (
                    <span key={c} style={{ background: c }}>{c}</span>
                  ))}
                </div>
              )}
              <div className="pv1-signal-num mono">{s.n}</div>
              <div className="pv1-signal-title">{s.t}</div>
              <div className="pv1-signal-body">{s.b}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TABLA TÉCNICA */}
      <section className="pv1-sec wrap">
        <div className="pv1-sec-head">
          <div>
            <div className="pv1-sec-tag mono">03 / SPECS</div>
            <div className="pv1-sec-title disp">Especificaciones, lado a lado.</div>
          </div>
        </div>
        <div className="pv1-specs">
          <table>
            <thead>
              <tr>
                <th>Especificación</th>
                <th>Genérica</th>
                <th>Original</th>
              </tr>
            </thead>
            <tbody>
              {SPECS.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, i) => <td key={i}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="pv1-specs-note">
          Rangos típicos sobre módulos AMOLED de Samsung Galaxy S22–S24 y Motorola Edge / pOLED. Valores varían según
          modelo específico.
        </p>
      </section>

      {/* RAZONES */}
      <section className="pv1-sec wrap">
        <div className="pv1-sec-head">
          <div>
            <div className="pv1-sec-tag mono">04 / RAZONES</div>
            <div className="pv1-sec-title disp">Por qué se nota.</div>
          </div>
        </div>
        <div className="pv1-reasons">
          {REASONS.map((r, i) => (
            <div className="pv1-reason" key={r.t}>
              <div className="pv1-reason-num">{String(i + 1).padStart(2, '0')}</div>
              <div className="pv1-reason-title">{r.t}</div>
              <div className="pv1-reason-body">{r.b}</div>
              <div className="pv1-reason-tag mono">{r.tag}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CATÁLOGO */}
      <section className="pv1-sec wrap">
        <div className="pv1-sec-head">
          <div>
            <div className="pv1-sec-tag mono">05 / CATÁLOGO</div>
            <div className="pv1-sec-title disp">Samsung y Motorola. Originales.</div>
          </div>
        </div>
        <div className="pv1-catalogo">
          {CATALOGO.map((m) => (
            <div className="pv1-marca" key={m.marca}>
              <div className="pv1-marca-head">
                <span className="pv1-marca-nombre">{m.marca}</span>
                <span className="pv1-marca-sub mono">{m.sub}</span>
              </div>
              {m.lineas.map(([tag, modelos]) => (
                <div key={tag}>
                  <div className="pv1-linea-tag mono">{tag}</div>
                  <div className="pv1-chips">
                    {modelos.map((mo) => <span className="pv1-chip" key={mo}>{mo}</span>)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="pv1-catalogo-nota">
          ¿Tu modelo no aparece? Mandanos foto del equipo por WhatsApp y confirmamos disponibilidad en menos de 10
          minutos.
        </p>
      </section>

      {/* GARANTÍA */}
      <section className="pv1-sec wrap">
        <div className="pv1-sec-head">
          <div>
            <div className="pv1-sec-tag mono">06 / GARANTÍA</div>
          </div>
        </div>
        <div className="pv1-garantia">
          <div className="pv1-garantia-num disp">6 meses</div>
          <div>
            <p className="pv1-garantia-body">
              Sobre el módulo. Cubre defectos de panel, fallas de touch, líneas, manchas o píxeles muertos. Cambio sin
              cargo.
            </p>
            <div className="pv1-garantia-list">
              <span className="si">✓ Defecto de panel</span>
              <span className="si">✓ Fallas de touch o digitizer</span>
              <span className="si">✓ Líneas, manchas, píxeles muertos</span>
              <span className="no">✕ No cubre golpes o caídas</span>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIOS */}
      <section className="pv1-sec wrap">
        <div className="pv1-sec-head">
          <div>
            <div className="pv1-sec-tag mono">07 / TESTIMONIOS</div>
            <div className="pv1-sec-title disp">"No lo iba a creer hasta verlo."</div>
          </div>
        </div>
        <div className="pv1-testis">
          {TESTIMONIOS.map((t) => (
            <div className="pv1-testi" key={t.nombre}>
              <p>“{t.t}”</p>
              <div className="pv1-testi-autor">
                <span className="pv1-testi-av">{t.nombre[0]}</span>
                <div>
                  <div className="pv1-testi-nom">{t.nombre}</div>
                  <div className="pv1-testi-loc mono">{t.loc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="pv1-sec wrap">
        <div className="pv1-sec-head">
          <div>
            <div className="pv1-sec-tag mono">08 / FAQ</div>
            <div className="pv1-sec-title disp">Preguntas técnicas.</div>
          </div>
        </div>
        <div className="pv1-faq">
          {FAQS.map((f, i) => (
            <div className={`pv1-faq-item${faqOpen === i ? ' open' : ''}`} key={f.q}>
              <button className="pv1-faq-q" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                <span>{f.q}</span>
                <span className="signo">+</span>
              </button>
              <div className="pv1-faq-a"><p>{f.a}</p></div>
            </div>
          ))}
        </div>
      </section>

      {/* VISITANOS */}
      <section className="pv1-sec wrap">
        <div className="pv1-sec-head">
          <div>
            <div className="pv1-sec-tag mono">09 / VISITANOS</div>
            <div className="pv1-sec-title disp">Local físico en Florencio Varela.</div>
          </div>
        </div>
        <div className="pv1-visita">
          <div>
            <p className="pv1-visita-body">
              Acá hacemos el cambio frente tuyo. Te mostramos el módulo original sellado antes de abrir tu equipo.
            </p>
            <div className="pv1-visita-datos">
              <div>
                <div className="pv1-visita-lbl mono">DIRECCIÓN</div>
                <div className="pv1-visita-val">{DIRECCION}</div>
              </div>
              <div>
                <div className="pv1-visita-lbl mono">HORARIO</div>
                <div className="pv1-visita-val">{HORARIO}</div>
              </div>
            </div>
          </div>
          <div className="pv1-mapa-card">
            <div className="rating"><strong>★★★★★ 4.7</strong> · valoración Google</div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(DIRECCION)}`}
              target="_blank"
              rel="noreferrer"
              className="abrir"
            >
              Ver en Google Maps →
            </a>
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="pv1-cta-final wrap">
        <div className="pv1-sec-tag mono" style={{ justifyContent: 'center', display: 'flex', marginBottom: 10 }}>09 / SIGUIENTE PASO</div>
        <h2 className="disp">Presupuesto en 2 minutos. Sin obligación.</h2>
        <p>Mandanos modelo + foto del equipo. Te confirmamos disponibilidad de módulo original y precio cerrado.</p>
        <a href={waLink('Hola, quiero presupuesto para pantalla original')} target="_blank" rel="noreferrer" className="pv1-btn">
          Pedir presupuesto por WhatsApp →
        </a>
        <div className="pv1-hint mono" style={{ marginTop: 18 }}>
          {DIRECCION.toUpperCase()} · +{WHATSAPP.replace(/^54/, '54 ')}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="pv1-footer wrap">
        <div className="pv1-footer-grid">
          <div>
            <div className="pv1-footer-brand">SOPORTE MÓVIL</div>
            <p className="pv1-footer-desc">Cambio de pantalla Samsung y Motorola con módulos originales. Buenos Aires.</p>
          </div>
          <div className="pv1-footer-col">
            <div className="pv1-footer-col-tit mono">CONTACTO</div>
            <a href={waLink('Hola, quiero presupuesto para pantalla original')} target="_blank" rel="noreferrer">
              +{WHATSAPP.replace(/^54/, '54 ')}
            </a>
            <div>{HORARIO}</div>
            <div>{DIRECCION}</div>
          </div>
          <div className="pv1-footer-col">
            <div className="pv1-footer-col-tit mono">SERVICIOS</div>
            <div>Cambio de pantalla Samsung</div>
            <div>Cambio de pantalla Motorola</div>
            <div>Diagnóstico sin cargo</div>
          </div>
        </div>
        <div className="pv1-footer-bottom">
          <span>© {new Date().getFullYear()} Soporte Móvil · Todos los derechos reservados</span>
          <span className="mono">LAB-01 · BUENOS AIRES</span>
        </div>
      </footer>

      <a href={waLink('Hola, quiero presupuesto para pantalla original')} target="_blank" rel="noreferrer" className="pv1-fab" aria-label="WhatsApp">
        💬
      </a>
    </div>
  );
}
