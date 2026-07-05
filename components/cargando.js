// Pantallas de carga tipo skeleton: la app "dibuja" su estructura
// mientras llegan los datos, en lugar de mostrar un spinner pelado.

export function PantallaCarga() {
  return (
    <main aria-busy="true">
      <div className="sk-line" style={{ width: '38%', height: 26, marginBottom: 22 }} />
      <div className="stats">
        {[0, 1, 2, 3].map((i) => (
          <div className="stat" key={i}>
            <div className="sk-line" style={{ width: '55%' }} />
            <div className="sk-line" style={{ width: '75%', height: 20, marginTop: 10 }} />
          </div>
        ))}
      </div>
      <div className="card">
        {[0, 1, 2, 3].map((i) => (
          <div className="sk-row" key={i}>
            <div className="sk-circle" />
            <div style={{ flex: 1 }}>
              <div className="sk-line" style={{ width: '62%' }} />
              <div className="sk-line" style={{ width: '38%', marginTop: 8 }} />
            </div>
            <div className="sk-line" style={{ width: 64 }} />
          </div>
        ))}
      </div>
    </main>
  );
}

export function CargaTarjeta({ lineas = 3 }) {
  return (
    <div className="card" aria-busy="true">
      {Array.from({ length: lineas }).map((_, i) => (
        <div
          className="sk-line"
          key={i}
          style={{ width: `${78 - i * 14}%`, marginBottom: 12 }}
        />
      ))}
    </div>
  );
}
