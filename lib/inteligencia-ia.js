// Helpers de servidor para "Inteligencia de Ventas": arman el contexto de
// negocio a partir de inteligencia_ventas_datos() y llaman a Claude para el
// análisis real (recomendaciones + chat). Solo se importan desde app/api/**.
import { METODOS_PAGO, CATEGORIAS } from './supabase';

const MODEL = process.env.INTELIGENCIA_MODEL || 'claude-sonnet-5';

function moneyTxt(n) {
  return `$${Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}

// Convierte el JSON de inteligencia_ventas_datos() en un bloque de texto
// legible para el prompt — Claude analiza sobre esto, no sobre JSON crudo.
export function resumenDatosTexto(datos, negocioNombre) {
  const diaTop = [...(datos.por_dia_semana || [])].sort((a, b) => b.total - a.total)[0];
  const horaTop = [...(datos.por_hora || [])].sort((a, b) => b.total - a.total)[0];

  const lineas = [
    `Negocio: ${negocioNombre} (taller de reparación de celulares y venta de accesorios/repuestos, Argentina).`,
    `Período analizado: últimos ${datos.periodo.dias} días (${datos.periodo.desde} a ${datos.periodo.hasta}).`,
    `Ingresos del período: ${moneyTxt(datos.ingresos.total)} en ${datos.ingresos.cantidad} ventas` +
      (datos.ingresos.variacion_pct != null ? ` (${datos.ingresos.variacion_pct >= 0 ? '+' : ''}${datos.ingresos.variacion_pct}% vs. el período anterior de igual duración)` : ' (sin datos del período anterior para comparar)') +
      '.',
    `Ticket promedio: ${moneyTxt(datos.ticket_promedio)}.`,
    `Productos activos en catálogo: ${datos.productos_activos}. Alertas de stock crítico: ${datos.alertas_activas}.`,
    diaTop ? `Día de la semana con más facturación: ${diaTop.dia} (${moneyTxt(diaTop.total)}).` : '',
    horaTop ? `Horario con más ventas: ${horaTop.hora}hs (${moneyTxt(horaTop.total)}).` : '',
  ];

  if ((datos.top_categorias || []).length) {
    lineas.push(
      'Ventas por categoría de producto (de mayor a menor facturación):\n' +
        datos.top_categorias
          .map((c) => `  - ${CATEGORIAS[c.categoria] || c.categoria}: ${moneyTxt(c.total)} (${c.cantidad} unidades)`)
          .join('\n')
    );
  }
  if ((datos.top_productos || []).length) {
    lineas.push(
      'Productos más vendidos:\n' +
        datos.top_productos.slice(0, 6).map((p) => `  - ${p.nombre}: ${p.unidades} un. — ${moneyTxt(p.total)}`).join('\n')
    );
  }
  if (Object.keys(datos.por_metodo || {}).length) {
    lineas.push(
      'Medios de pago:\n' +
        Object.entries(datos.por_metodo)
          .sort((a, b) => b[1] - a[1])
          .map(([m, t]) => `  - ${METODOS_PAGO[m] || m}: ${moneyTxt(t)}`)
          .join('\n')
    );
  }
  if ((datos.equipos_por_marca || []).length) {
    lineas.push(
      'Equipos ingresados a reparación por marca:\n' +
        datos.equipos_por_marca.map((e) => `  - ${e.marca}: ${e.cantidad} equipos`).join('\n')
    );
  }
  lineas.push(
    `Proyección del mes actual: lleva facturado ${moneyTxt(datos.proyeccion.facturado_mes)} al día ${datos.proyeccion.dia_actual} de ${datos.proyeccion.dias_mes}, promedio ${moneyTxt(datos.proyeccion.promedio_diario)}/día.`
  );

  return lineas.filter(Boolean).join('\n');
}

const TOOL_ESTRATEGIAS = {
  name: 'reportar_analisis',
  description: 'Reporta el análisis de inteligencia de ventas del negocio.',
  input_schema: {
    type: 'object',
    properties: {
      resumen: {
        type: 'string',
        description: '2-3 frases con el diagnóstico general del período, en español rioplatense, tono directo y útil.',
      },
      estrategias: {
        type: 'array',
        description: 'Entre 3 y 5 recomendaciones concretas y accionables, basadas en los datos reales provistos.',
        items: {
          type: 'object',
          properties: {
            icono: { type: 'string', description: 'Un solo emoji representativo.' },
            titulo: { type: 'string', description: 'Título corto (máx. 8 palabras).' },
            texto: { type: 'string', description: 'La recomendación en 1-2 frases, específica y accionable.' },
          },
          required: ['icono', 'titulo', 'texto'],
        },
      },
      categoria_recomendada: {
        type: 'object',
        description: 'La categoría de producto más recomendable para invertir/stockear más, según lo que más se vende y su margen. null si no hay datos suficientes.',
        properties: {
          categoria: { type: 'string' },
          motivo: { type: 'string', description: '1 frase explicando por qué conviene invertir ahí.' },
        },
      },
      alerta: {
        type: ['string', 'null'],
        description: 'Si hay algo preocupante (caída fuerte de ventas, stock crítico, etc.) describilo en 1 frase. null si no hay nada urgente.',
      },
    },
    required: ['resumen', 'estrategias'],
  },
};

// Le pide a Claude que analice los datos reales del negocio y devuelva
// recomendaciones estructuradas (no texto libre) para que el frontend las
// renderice sin parsear nada.
export async function generarEstrategias(datos, negocioNombre) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY');

  const contexto = resumenDatosTexto(datos, negocioNombre);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      system:
        'Sos un analista de inteligencia de negocio especializado en talleres de reparación de celulares y electrónica en Argentina. ' +
        'Analizás los datos reales que te pasan (no inventes cifras que no estén ahí) y das recomendaciones concretas, accionables y priorizadas por impacto. ' +
        'Español rioplatense, directo, sin relleno.',
      messages: [{ role: 'user', content: `Estos son los datos del negocio:\n\n${contexto}\n\nAnalizalos y reportá el análisis.` }],
      tools: [TOOL_ESTRATEGIAS],
      tool_choice: { type: 'tool', name: 'reportar_analisis' },
    }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Claude ${res.status}`);
  const bloque = (data?.content || []).find((b) => b.type === 'tool_use' && b.name === 'reportar_analisis');
  if (!bloque) throw new Error('Claude no devolvió el análisis esperado');
  return bloque.input;
}

function historialAMensajes(historial = []) {
  const msgs = [];
  for (const m of historial) {
    const role = m.rol === 'usuario' ? 'user' : 'assistant';
    const texto = m.texto || '';
    if (!texto) continue;
    if (msgs.length && msgs[msgs.length - 1].role === role) {
      msgs[msgs.length - 1].content += `\n${texto}`;
    } else {
      msgs.push({ role, content: texto });
    }
  }
  while (msgs.length && msgs[0].role !== 'user') msgs.shift();
  return msgs;
}

// Chat conversacional para que el dueño pregunte lo que quiera sobre su
// negocio, con los mismos datos reales como contexto.
export async function responderChatInteligencia({ datos, negocioNombre, historial }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY');
  const mensajes = historialAMensajes(historial);
  if (!mensajes.length) throw new Error('Sin mensajes');

  const contexto = resumenDatosTexto(datos, negocioNombre);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 700,
      system:
        `Sos el Asistente IA de Inteligencia de Ventas de "${negocioNombre}", un taller de reparación de celulares en Argentina. ` +
        'Respondé preguntas del dueño sobre su negocio usando SOLO los datos reales de abajo — si te preguntan algo que no podés responder con estos datos, decilo claramente en vez de inventar. ' +
        'Español rioplatense, conciso, sin markdown pesado (podés usar guiones para listas cortas).\n\n' +
        `Datos del negocio:\n${contexto}`,
      messages: mensajes,
    }),
    cache: 'no-store',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Claude ${res.status}`);
  return (data?.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}
