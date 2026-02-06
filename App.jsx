import React, { useState, useEffect, useMemo, useRef, Component } from "react";

/** =========================================================
 *  DATACELL STORE PRO — v7.8 (Diagnóstico + Admin Delete + Inventario PRO)
 *  Archivo único (App.jsx)
 *  ========================================================= */

// --- CONFIGURACIÓN ---
const VERSION = "7.8.PRO_DIAGNOSTICO_ADMIN_DELETE_INVENTARIO_PRO";
const LS_PREFIX = "datacell_pro_v78";
const KEYS = {
  INV: `${LS_PREFIX}_inv`,
  ORD: `${LS_PREFIX}_ord`,
  CLI: `${LS_PREFIX}_cli`,
  ADMIN_PIN: `${LS_PREFIX}_admin_pin`,
  DIA: (f) => `${LS_PREFIX}_dia_${f}`,
};

// --- CONSTANTES ---
const ESTADOS_OT = ["Recibido", "Diagnóstico", "Espera Aprobación", "En Reparación", "Listo", "Entregado", "Anulado"];
const METODOS = ["Efectivo", "Yape/Plin", "Transferencia", "Tarjeta"];
const CATEGORIAS_EQ = ["Celular", "Laptop", "TV", "Scooter", "Bicicleta", "Otro"];

const INV_CATEGORIAS = ["Pantalla", "Batería", "Flex", "IC/Chip", "Herramienta", "Consumible", "Accesorio", "Otro"];
const CALIDADES = ["Original", "OEM", "Genérico", "Copy", "Premium"];
const TECNICOS = ["Joao", "Juanita"]; // ajusta si quieres

const money = (n) => `S/ ${Number(n || 0).toFixed(2)}`;
const getHoy = () => new Date().toISOString().split("T")[0];

// --- ERROR BOUNDARY GLOBAL ---
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "40px",
            textAlign: "center",
            background: "#fee2e2",
            color: "#b91c1c",
            borderRadius: "12px",
            margin: "20px",
          }}
        >
          <h2>⚠️ Algo salió mal en la interfaz</h2>
          <p>{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 20px",
              cursor: "pointer",
              background: "#b91c1c",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "bold",
            }}
          >
            Recargar Aplicación
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- APP PRINCIPAL ---
export default function App() {
  return (
    <ErrorBoundary>
      <DatacellApp />
    </ErrorBoundary>
  );
}

function DatacellApp() {
  const [fecha, setFecha] = useState(getHoy());
  const [tab, setTab] = useState("pos");
  const [movDetalle, setMovDetalle] = useState(null);

  // PRINT
  const [printData, setPrintData] = useState(null); // { type: 'OSPDF', data: order } | { type: 'REPORT', data: {fecha, dataDia} }

  // ADMIN
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPin, setAdminPin] = useState(() => {
    try {
      const p = localStorage.getItem(KEYS.ADMIN_PIN);
      if (!p) {
        localStorage.setItem(KEYS.ADMIN_PIN, "1234");
        return "1234";
      }
      return p;
    } catch {
      return "1234";
    }
  });

  // --- PERSISTENCIA BLINDADA ---
  const [inventario, setInventario] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEYS.INV)) || [];
    } catch {
      return [];
    }
  });
  const [ordenes, setOrdenes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEYS.ORD)) || [];
    } catch {
      return [];
    }
  });
  const [clientes, setClientes] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(KEYS.CLI)) || [];
    } catch {
      return [];
    }
  });
  const [dataDia, setDataDia] = useState({ movimientos: [] });
  const [cuadreReal, setCuadreReal] = useState({ Efectivo: "", "Yape/Plin": "", Transferencia: "", Tarjeta: "" });

  useEffect(() => localStorage.setItem(KEYS.INV, JSON.stringify(inventario)), [inventario]);
  useEffect(() => localStorage.setItem(KEYS.ORD, JSON.stringify(ordenes)), [ordenes]);
  useEffect(() => localStorage.setItem(KEYS.CLI, JSON.stringify(clientes)), [clientes]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEYS.DIA(fecha));
      setDataDia(saved ? JSON.parse(saved) : { movimientos: [] });
    } catch {
      setDataDia({ movimientos: [] });
    }
    setCuadreReal({ Efectivo: "", "Yape/Plin": "", Transferencia: "", Tarjeta: "" });
  }, [fecha]);

  useEffect(() => localStorage.setItem(KEYS.DIA(fecha), JSON.stringify(dataDia)), [dataDia, fecha]);

  // --- LÓGICA CORE ---
  const registrarMovimiento = (mov) => {
    const nuevo = {
      id: Date.now().toString(),
      hora: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      fecha: fecha,
      ...mov,
    };
    setDataDia((prev) => ({ movimientos: [nuevo, ...(prev.movimientos || [])] }));
  };

  const descontarStock = (items) => {
    setInventario((prev) =>
      (prev || []).map((inv) => {
        const match = (items || []).find((u) => String(u.id) === String(inv.id) || String(u.invId) === String(inv.id));
        return match ? { ...inv, stock: Math.max(0, Number(inv.stock) - Number(match.cantidad || 1)) } : inv;
      })
    );
  };

  const ajustarStock = ({ invId, delta, motivo }) => {
    const d = Number(delta || 0);
    if (!d) return;
    setInventario((prev) =>
      (prev || []).map((i) => {
        if (String(i.id) !== String(invId)) return i;
        const nuevo = Math.max(0, Number(i.stock || 0) + d);
        return { ...i, stock: nuevo };
      })
    );
    registrarMovimiento({
      tipo: "INVENTARIO",
      metodoPago: "—",
      monto: 0,
      descripcion: `Ajuste stock (${d > 0 ? "+" : ""}${d}) — ${motivo || "sin motivo"} — Item ${invId}`,
      detalle: { invId, delta: d, motivo },
    });
  };

  // ADMIN: borrar movimiento (historial)
  const deleteMovimiento = (movId) => {
    if (!isAdmin) return alert("Solo admin.");
    if (!window.confirm("¿Borrar este movimiento? (No se puede deshacer)")) return;
    setDataDia((prev) => ({ ...prev, movimientos: (prev.movimientos || []).filter((m) => String(m.id) !== String(movId)) }));
  };

  const handleBackup = () => {
    const backup = { version: VERSION, inventario, ordenes, clientes, historico: {}, adminPin: adminPin ? "SET" : "N/A" };
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith(`${LS_PREFIX}_dia_`)) {
        try {
          backup.historico[k] = JSON.parse(localStorage.getItem(k));
        } catch {}
      }
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `BACKUP_DATACELL_PRO_${fecha}.json`;
    a.click();
  };

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file || !window.confirm("¿Restaurar sistema? Se filtrarán solo datos de Datacell.")) return;
    const reader = new FileReader();
    reader.onload = (re) => {
      try {
        const b = JSON.parse(re.target.result);
        if (b.inventario) setInventario(b.inventario);
        if (b.ordenes) setOrdenes(b.ordenes);
        if (b.clientes) setClientes(b.clientes);
        if (b.historico) Object.entries(b.historico).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
        alert("Restauración completada.");
        window.location.reload();
      } catch {
        alert("Archivo inválido.");
      }
    };
    reader.readAsText(file);
  };

  const handlePrint = (type, data) => {
    setPrintData({ type, data });
    setTimeout(() => window.print(), 250);
  };

  const adminLogin = () => {
    const pin = prompt("PIN ADMIN:");
    if (pin === null) return;
    const stored = localStorage.getItem(KEYS.ADMIN_PIN) || "1234";
    if (String(pin) === String(stored)) {
      setIsAdmin(true);
      alert("Modo ADMIN activado.");
    } else {
      alert("PIN incorrecto.");
    }
  };

  const adminLogout = () => setIsAdmin(false);

  const adminChangePin = () => {
    if (!isAdmin) return alert("Solo admin.");
    const n1 = prompt("Nuevo PIN (solo números recomendado):");
    if (n1 === null) return;
    if (!String(n1).trim()) return alert("PIN inválido.");
    const n2 = prompt("Repite el nuevo PIN:");
    if (n2 === null) return;
    if (String(n1) !== String(n2)) return alert("No coincide.");
    localStorage.setItem(KEYS.ADMIN_PIN, String(n1));
    setAdminPin(String(n1));
    alert("PIN actualizado.");
  };

  const theme = { primary: "#22c55e", dark: "#15803d", bg: "#f1f5f9", card: "#fff", border: "#e2e8f0" };

  const tabs = ["pos", "ordenes", "servicios", "inventario", "clientes", "gastos", "caja", "historial"];

  return (
    <div style={{ fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", backgroundColor: theme.bg, minHeight: "100vh", padding: "15px" }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white !important; padding: 0 !important; }
          #printable { width: 100%; }
        }
        .print-only { display: none; }
      `}</style>

      <header
        className="no-print"
        style={{
          background: theme.card,
          padding: "15px 20px",
          borderRadius: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderLeft: `6px solid ${theme.primary}`,
          marginBottom: "15px",
          boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, color: theme.dark, fontSize: "20px" }}>DATACELL STORE PRO v7.8</h1>
          <small style={{ color: "#64748b" }}>{VERSION}</small>
          <div style={{ marginTop: "4px" }}>
            <span
              style={{
                fontSize: "11px",
                padding: "2px 6px",
                borderRadius: "8px",
                background: isAdmin ? "#dcfce7" : "#fee2e2",
                color: isAdmin ? "#166534" : "#991b1b",
                fontWeight: "bold",
              }}
            >
              {isAdmin ? "ADMIN ON" : "ADMIN OFF"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={handleBackup} style={s_btn("#3b82f6")}>
            📦 Backup
          </button>
          <label style={{ ...s_btn("#fff"), color: "#3b82f6", border: "1px solid #3b82f6", cursor: "pointer" }}>
            📥 Importar <input type="file" style={{ display: "none" }} onChange={handleImport} />
          </label>

          {!isAdmin ? (
            <button onClick={adminLogin} style={s_btn("#111827")}>
              🔒 Admin
            </button>
          ) : (
            <>
              <button onClick={adminChangePin} style={s_btn("#0ea5e9")}>
                🔑 Cambiar PIN
              </button>
              <button onClick={adminLogout} style={s_btn("#ef4444")}>
                🔓 Salir
              </button>
            </>
          )}

          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={{ padding: "6px", borderRadius: "8px", border: "1px solid #ddd" }} />
        </div>
      </header>

      <nav className="no-print" style={{ display: "flex", gap: "5px", marginBottom: "15px", overflowX: "auto", paddingBottom: "5px" }}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ ...s_btn(tab === t ? theme.primary : "#fff"), color: tab === t ? "#fff" : "#64748b", fontSize: "12px" }}>
            {t.toUpperCase()}
          </button>
        ))}
      </nav>

      <main className="no-print">
        {tab === "pos" && <ViewPOS inventario={inventario} clientes={clientes} descontar={descontarStock} registrarMovimiento={registrarMovimiento} />}
        {tab === "ordenes" && (
          <ViewOrdenes
            ordenes={ordenes}
            setOrdenes={setOrdenes}
            clientes={clientes}
            inventario={inventario}
            descontar={descontarStock}
            registrarMovimiento={registrarMovimiento}
            onPrint={handlePrint}
            isAdmin={isAdmin}
            ajustarStock={ajustarStock}
          />
        )}
        {tab === "servicios" && <ViewServicioRapido clientes={clientes} registrarMovimiento={registrarMovimiento} />}
        {tab === "inventario" && (
          <ViewInventario inventario={inventario} setInventario={setInventario} isAdmin={isAdmin} ajustarStock={ajustarStock} />
        )}
        {tab === "clientes" && <ViewClientes clientes={clientes} setClientes={setClientes} isAdmin={isAdmin} />}
        {tab === "gastos" && <ViewGastos registrarMovimiento={registrarMovimiento} />}
        {tab === "caja" && <ViewCaja data={dataDia} cuadreReal={cuadreReal} setCuadreReal={setCuadreReal} />}
        {tab === "historial" && (
          <ViewHistorial data={dataDia} setVerDetalle={setMovDetalle} fecha={fecha} onPrint={handlePrint} isAdmin={isAdmin} onDeleteMov={deleteMovimiento} />
        )}
      </main>

      {/* ÁREA DE IMPRESIÓN */}
      <div id="printable" className="print-only">
        {printData?.type === "OSPDF" && <PrintOSPlusConsent order={printData.data} />}
        {printData?.type === "REPORT" && <PrintDayReport fecha={printData.data.fecha} data={printData.data.dataDia} />}
      </div>

      {movDetalle && <ModalDetalle mov={movDetalle} onClose={() => setMovDetalle(null)} />}
    </div>
  );
}

/** =========================
 *  VISTAS
 *  ========================= */

function ViewPOS({ inventario, clientes, descontar, registrarMovimiento }) {
  const [carrito, setCarrito] = useState([]);
  const [filtro, setFiltro] = useState("");
  const [cliId, setCliId] = useState("");
  const [metodo, setMetodo] = useState("Efectivo");

  const filtrados = (inventario || []).filter((i) =>
    (String(i.nombre || "") + " " + String(i.sku || "") + " " + String(i.compatibilidad || "")).toLowerCase().includes((filtro || "").toLowerCase())
  );
  const total = carrito.reduce((a, b) => a + Number(b.precioVenta || 0) * Number(b.cantidad || 0), 0);

  const add = (p) => {
    const exist = carrito.find((x) => String(x.id) === String(p.id));
    if (exist) {
      if (exist.cantidad >= Number(p.stock || 0)) return alert("Stock insuficiente.");
      setCarrito(carrito.map((x) => (String(x.id) === String(p.id) ? { ...x, cantidad: x.cantidad + 1 } : x)));
    } else {
      if (Number(p.stock || 0) < 1) return alert("Sin stock.");
      setCarrito([...carrito, { ...p, cantidad: 1 }]);
    }
  };

  const cobrar = () => {
    if (carrito.length === 0) return;
    const cli = (clientes || []).find((c) => String(c.id) === String(cliId));
    registrarMovimiento({
      tipo: "VENTA",
      metodoPago: metodo,
      monto: total,
      descripcion: `Venta POS (${carrito.length} items)`,
      cliente: cli ? { id: cli.id, nombre: cli.nombre, dni: cli.dni, telefono: cli.telefono } : { nombre: "Público General" },
      detalle: { items: carrito },
    });
    descontar(carrito);
    setCarrito([]);
    alert("Venta guardada.");
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "15px" }}>
      <div style={s_card}>
        <input style={s_inp} placeholder="🔍 Buscar Producto / SKU / Compatibilidad..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "8px", maxHeight: "65vh", overflowY: "auto" }}>
          {filtrados.map((p) => (
            <div
              key={p.id}
              onClick={() => add(p)}
              style={{
                padding: "10px",
                border: "1px solid #eee",
                borderRadius: "8px",
                cursor: "pointer",
                textAlign: "center",
                background: Number(p.stock) < 1 ? "#f9f9f9" : "#fff",
                opacity: Number(p.stock) < 1 ? 0.6 : 1,
              }}
              title={p.compatibilidad || ""}
            >
              <small style={{ color: "#999" }}>{p.sku}</small>
              <br />
              <b>{p.nombre}</b>
              <br />
              <span style={{ color: "#22c55e", fontWeight: "bold" }}>{money(p.precioVenta)}</span>
              <br />
              <small>Stock: {p.stock}</small>
              {!!String(p.compatibilidad || "").trim() && (
                <div style={{ marginTop: "6px", fontSize: "11px", color: "#64748b" }}>{p.compatibilidad}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...s_card, border: "2px solid #22c55e" }}>
        <h3 style={{ marginTop: 0 }}>Carrito</h3>
        <div style={{ minHeight: "200px" }}>
          {carrito.map((c) => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f1f5f9", fontSize: "13px" }}>
              <span>
                {c.nombre} x{c.cantidad}
              </span>
              <b>{money(Number(c.precioVenta) * Number(c.cantidad))}</b>
            </div>
          ))}
        </div>
        <h2 style={{ textAlign: "right", margin: "15px 0" }}>{money(total)}</h2>

        <select style={s_inp} value={cliId} onChange={(e) => setCliId(e.target.value)}>
          <option value="">Público General</option>
          {(clientes || []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>

        <select style={s_inp} value={metodo} onChange={(e) => setMetodo(e.target.value)}>
          {METODOS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <button onClick={cobrar} disabled={carrito.length === 0} style={{ ...s_btn_std, width: "100%", background: "#22c55e", padding: "12px" }}>
          COBRAR VENTA
        </button>
      </div>
    </div>
  );
}

function ViewOrdenes({ ordenes, setOrdenes, clientes, inventario, descontar, registrarMovimiento, onPrint, isAdmin, ajustarStock }) {
  const [modo, setModo] = useState("lista");
  const [busq, setBusq] = useState("");

  const [f, setF] = useState({
    cliId: "",
    tecnico: TECNICOS[0] || "",
    equipo: { tipo: "Celular", marca: "", modelo: "", imei: "", color: "", accesorios: "" },
    servicio: { falla: "", diagnostico: "", trabajo: "", garantia: 30, manoObra: "" },
    logistica: { modalidad: "en tienda", direccion: "", referencia: "", costo: 0 },
    adelanto: 0,
    metodoAdelanto: "Efectivo",
    repuestos: [],
    acceso: {
      tipoBloqueo: "Ninguno", // Ninguno | PIN | Patron
      autorizaBackup: false,
      gmail: "",
      icloud: "",
      codigo: "", // PIN / PASSCODE (alfa-numérico)
      password: "",
      patronSeq: "",
      guardarCredenciales: false,
    },
    diagnostico: {
      aplica: false,
      monto: 50,
      cobrado: false,
      metodo: "Efectivo",
      cobradoEn: "",
    },
    consent: {
      requiere: true,
      acepta: false,
      firmanteNombre: "",
      firmanteDni: "",
      condicionIngreso: "No evaluado",
      observaciones: "",
      firmaDataUrl: "",
      firmadoEn: "",
    },
  });

  const totalRep = (f.repuestos || []).reduce((a, b) => a + Number(b.precioVenta || 0) * Number(b.cantidad || 1), 0);
  const totalGral = Number(f.servicio.manoObra || 0) + totalRep + Number(f.logistica.costo || 0);

  const validarConsent = () => {
    if (!f.consent?.requiere) return true;
    if (!f.consent?.acepta) return false;
    if (!String(f.consent?.firmanteNombre || "").trim()) return false;
    if (!String(f.consent?.firmanteDni || "").trim()) return false;
    if (!String(f.consent?.firmaDataUrl || "").trim()) return false;
    return true;
  };

  const guardar = (e) => {
    e.preventDefault();
    if (!f.cliId || !f.equipo.imei || !f.servicio.falla) return alert("Faltan campos (Cliente, IMEI/Serie y Falla).");
    if (!validarConsent()) return alert("Falta Declaración Jurada: debe ACEPTAR, llenar Nombre/DNI y FIRMAR.");

    const cli = (clientes || []).find((c) => String(c.id) === String(f.cliId));

    const accesoGuardado = f.acceso?.guardarCredenciales
      ? { ...f.acceso }
      : {
          tipoBloqueo: f.acceso?.tipoBloqueo || "Ninguno",
          autorizaBackup: !!f.acceso?.autorizaBackup,
          guardarCredenciales: false,
          nota: "Credenciales brindadas solo para atención (NO guardadas).",
        };

    const consentGuardado = {
      ...f.consent,
      firmadoEn: new Date().toISOString(),
    };

    const diagnosticoGuardado = {
      ...f.diagnostico,
      monto: Number(f.diagnostico?.monto || 50),
      aplica: !!f.diagnostico?.aplica,
      cobrado: !!f.diagnostico?.cobrado,
      metodo: f.diagnostico?.metodo || "Efectivo",
    };

    const nueva = {
      ...f,
      id: `OS-${Math.floor(100000 + Math.random() * 900000)}`,
      fecha: getHoy(),
      cliente: cli,
      acceso: accesoGuardado,
      consent: consentGuardado,
      diagnostico: diagnosticoGuardado,
      total: totalGral,
      saldo: totalGral - Number(f.adelanto || 0),
      estado: "Recibido",
    };

    setOrdenes([nueva, ...(ordenes || [])]);

    if (Number(f.adelanto || 0) > 0) {
      registrarMovimiento({ tipo: "SERVICIO", metodoPago: f.metodoAdelanto, monto: Number(f.adelanto), descripcion: `Adelanto OS: ${nueva.id}`, cliente: cli });
    }

    setModo("lista");
    setF({
      cliId: "",
      tecnico: TECNICOS[0] || "",
      equipo: { tipo: "Celular", marca: "", modelo: "", imei: "", color: "", accesorios: "" },
      servicio: { falla: "", diagnostico: "", trabajo: "", garantia: 30, manoObra: "" },
      logistica: { modalidad: "en tienda", direccion: "", referencia: "", costo: 0 },
      adelanto: 0,
      metodoAdelanto: "Efectivo",
      repuestos: [],
      acceso: { tipoBloqueo: "Ninguno", autorizaBackup: false, gmail: "", icloud: "", codigo: "", password: "", patronSeq: "", guardarCredenciales: false },
      diagnostico: { aplica: false, monto: 50, cobrado: false, metodo: "Efectivo", cobradoEn: "" },
      consent: { requiere: true, acepta: false, firmanteNombre: "", firmanteDni: "", condicionIngreso: "No evaluado", observaciones: "", firmaDataUrl: "", firmadoEn: "" },
    });
  };

  const cobrarDiagnostico = (id) => {
    const o = (ordenes || []).find((x) => x.id === id);
    if (!o) return;
    if (!o.diagnostico?.aplica) return alert("Esta OS no tiene diagnóstico aplicado.");
    if (o.diagnostico?.cobrado) return alert("Diagnóstico ya cobrado.");

    const monto = Number(o.diagnostico?.monto || 50);
    const met = prompt(`Método Pago (${METODOS.join("/")})`, o.diagnostico?.metodo || "Efectivo");
    if (met === null) return;

    registrarMovimiento({
      tipo: "SERVICIO",
      metodoPago: met || "Efectivo",
      monto,
      descripcion: `Diagnóstico OS: ${id}`,
      cliente: o.cliente,
      detalle: { subTipo: "DIAGNOSTICO" },
    });

    setOrdenes((prev) =>
      (prev || []).map((x) => {
        if (x.id !== id) return x;
        const adel = Number(x.adelanto || 0) + monto;
        const total = Number(x.total || 0);
        return {
          ...x,
          adelanto: adel,
          metodoAdelanto: x.metodoAdelanto || (met || "Efectivo"),
          saldo: Math.max(0, total - adel),
          diagnostico: { ...(x.diagnostico || {}), cobrado: true, metodo: met || "Efectivo", cobradoEn: new Date().toISOString() },
        };
      })
    );

    alert("Diagnóstico cobrado y registrado como adelanto (se descuenta del servicio si se aprueba).");
  };

  const cerrarComoDiagnostico = (id) => {
    const o = (ordenes || []).find((x) => x.id === id);
    if (!o) return;

    if (!window.confirm("¿Cerrar esta OS como SOLO DIAGNÓSTICO (no aprobó reparación)?")) return;

    if (o.diagnostico?.aplica && !o.diagnostico?.cobrado) {
      const ok = window.confirm("Esta OS tiene diagnóstico aplicado y NO está cobrado. ¿Deseas cobrarlo ahora?");
      if (ok) cobrarDiagnostico(id);
    }

    const diagMonto = o.diagnostico?.aplica ? Number(o.diagnostico?.monto || 50) : 0;
    const adel = Number(o.adelanto || 0);
    const totalFinal = Math.max(diagMonto, adel);
    const saldoFinal = Math.max(0, totalFinal - adel);

    setOrdenes((prev) =>
      (prev || []).map((x) =>
        x.id === id
          ? {
              ...x,
              estado: "Anulado",
              total: totalFinal,
              saldo: saldoFinal,
              servicio: {
                ...(x.servicio || {}),
                diagnostico: (x.servicio?.diagnostico || "").trim() ? x.servicio.diagnostico : "Diagnóstico realizado. Cliente no aprobó reparación.",
              },
            }
          : x
      )
    );

    alert("OS cerrada como diagnóstico.");
  };

  const deleteOrden = (id) => {
    if (!isAdmin) return alert("Solo admin.");
    const o = (ordenes || []).find((x) => x.id === id);
    if (!o) return;
    if (!window.confirm(`¿Borrar DEFINITIVAMENTE la OS ${id}? (No se puede deshacer)`)) return;
    setOrdenes((prev) => (prev || []).filter((x) => x.id !== id));
  };

  const changeStatus = (id, nStatus) => {
    const o = (ordenes || []).find((x) => x.id === id);
    if (!o) return;

    if (nStatus === "Entregado") {
      const mFinal = prompt(`Monto a cobrar (Saldo pendiente: ${money(o.saldo)})`, String(o.saldo || 0));
      if (mFinal === null) return;
      const met = prompt(`Método Pago (${METODOS.join("/")})`, "Efectivo");
      if (met === null) return;

      descontar(o.repuestos);
      registrarMovimiento({ tipo: "SERVICIO", metodoPago: met || "Efectivo", monto: Number(mFinal || 0), descripcion: `Cobro Final OS: ${id}`, cliente: o.cliente });

      setOrdenes((prev) => (prev || []).map((x) => (x.id === id ? { ...x, estado: "Entregado", saldo: 0 } : x)));
    } else {
      setOrdenes((prev) => (prev || []).map((x) => (x.id === id ? { ...x, estado: nStatus } : x)));
    }
  };

  if (modo === "nueva")
    return (
      <form onSubmit={guardar} style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: "15px" }}>
        <div style={s_card}>
          <h3 style={{ marginTop: 0 }}>Nueva Orden de Servicio</h3>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px" }}>
            <div>
              <label style={s_lbl}>Cliente</label>
              <select style={s_inp} value={f.cliId} onChange={(e) => setF({ ...f, cliId: e.target.value })}>
                <option value="">-- Seleccionar --</option>
                {(clientes || []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.dni || "S/D"})
                  </option>
                ))}
              </select>

              <label style={s_lbl}>Técnico Encargado</label>
              <select style={s_inp} value={f.tecnico} onChange={(e) => setF({ ...f, tecnico: e.target.value })}>
                {TECNICOS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>

              <label style={s_lbl}>Equipo</label>
              <select style={s_inp} value={f.equipo.tipo} onChange={(e) => setF({ ...f, equipo: { ...f.equipo, tipo: e.target.value } })}>
                {CATEGORIAS_EQ.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <input style={s_inp} placeholder="Marca" value={f.equipo.marca} onChange={(e) => setF({ ...f, equipo: { ...f.equipo, marca: e.target.value } })} />
              <input style={s_inp} placeholder="Modelo" value={f.equipo.modelo} onChange={(e) => setF({ ...f, equipo: { ...f.equipo, modelo: e.target.value } })} />
              <input
                style={{ ...s_inp, border: "2px solid #22c55e" }}
                placeholder="IMEI / Serie (Obligatorio)"
                required
                value={f.equipo.imei}
                onChange={(e) => setF({ ...f, equipo: { ...f.equipo, imei: e.target.value } })}
              />
              <input style={s_inp} placeholder="Color (opcional)" value={f.equipo.color} onChange={(e) => setF({ ...f, equipo: { ...f.equipo, color: e.target.value } })} />
              <input style={s_inp} placeholder="Accesorios (cargador, cable, etc.)" value={f.equipo.accesorios} onChange={(e) => setF({ ...f, equipo: { ...f.equipo, accesorios: e.target.value } })} />
            </div>

            <div>
              <label style={s_lbl}>Logística</label>
              <select style={s_inp} value={f.logistica.modalidad} onChange={(e) => setF({ ...f, logistica: { ...f.logistica, modalidad: e.target.value } })}>
                <option value="en tienda">En tienda</option>
                <option value="recojo y entrega">Recojo y entrega</option>
                <option value="visita a domicilio">Visita a domicilio</option>
              </select>

              {f.logistica.modalidad !== "en tienda" && (
                <>
                  <input style={s_inp} placeholder="Dirección" value={f.logistica.direccion} onChange={(e) => setF({ ...f, logistica: { ...f.logistica, direccion: e.target.value } })} />
                  <input style={s_inp} placeholder="Referencia" value={f.logistica.referencia} onChange={(e) => setF({ ...f, logistica: { ...f.logistica, referencia: e.target.value } })} />
                </>
              )}

              <label style={s_lbl}>Servicio</label>
              <textarea style={{ ...s_inp, height: "70px" }} placeholder="Falla reportada..." required value={f.servicio.falla} onChange={(e) => setF({ ...f, servicio: { ...f.servicio, falla: e.target.value } })} />
              <textarea style={{ ...s_inp, height: "70px" }} placeholder="Diagnóstico (opcional)..." value={f.servicio.diagnostico} onChange={(e) => setF({ ...f, servicio: { ...f.servicio, diagnostico: e.target.value } })} />
              <textarea style={{ ...s_inp, height: "70px" }} placeholder="Trabajo a realizar..." value={f.servicio.trabajo} onChange={(e) => setF({ ...f, servicio: { ...f.servicio, trabajo: e.target.value } })} />
              <input style={s_inp} type="number" placeholder="Garantía (días)" value={f.servicio.garantia} onChange={(e) => setF({ ...f, servicio: { ...f.servicio, garantia: e.target.value } })} />
            </div>
          </div>

          {/* ACCESO / BACKUP */}
          <div style={{ marginTop: "12px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h4 style={{ margin: 0 }}>🔐 Acceso / Backup</h4>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input type="checkbox" checked={!!f.acceso.autorizaBackup} onChange={(e) => setF({ ...f, acceso: { ...f.acceso, autorizaBackup: e.target.checked } })} />
                <span style={{ fontSize: "12px" }}>Autoriza backup / pruebas</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "10px" }}>
              <div>
                <label style={s_lbl}>Tipo de bloqueo</label>
                <select
                  style={s_inp}
                  value={f.acceso.tipoBloqueo}
                  onChange={(e) =>
                    setF({
                      ...f,
                      acceso: { ...f.acceso, tipoBloqueo: e.target.value, codigo: "", patronSeq: "" },
                    })
                  }
                >
                  <option value="Ninguno">Ninguno</option>
                  <option value="PIN">PIN</option>
                  <option value="Patron">Patrón</option>
                </select>

                <label style={s_lbl}>Gmail (opcional)</label>
                <input style={s_inp} placeholder="correo@gmail.com" value={f.acceso.gmail} onChange={(e) => setF({ ...f, acceso: { ...f.acceso, gmail: e.target.value } })} />

                <label style={s_lbl}>iCloud (opcional)</label>
                <input style={s_inp} placeholder="correo@icloud.com" value={f.acceso.icloud} onChange={(e) => setF({ ...f, acceso: { ...f.acceso, icloud: e.target.value } })} />

                {f.acceso.tipoBloqueo === "PIN" && (
                  <>
                    <label style={s_lbl}>PIN / Passcode (acepta letras y números)</label>
                    <input style={s_inp} placeholder="Ej: 1234 o Ab12" value={f.acceso.codigo} onChange={(e) => setF({ ...f, acceso: { ...f.acceso, codigo: e.target.value } })} />
                    <small style={{ color: "#64748b" }}>Puedes escribir letras aquí (ej: Ab12). Abajo tienes keypad numérico opcional.</small>
                    <div style={{ marginTop: "8px" }}>
                      <PinPad value={f.acceso.codigo} onChange={(val) => setF({ ...f, acceso: { ...f.acceso, codigo: val } })} maxLen={32} />
                    </div>
                  </>
                )}

                <label style={s_lbl}>Password (opcional)</label>
                <input style={s_inp} placeholder="(si se requiere para backup)" value={f.acceso.password} onChange={(e) => setF({ ...f, acceso: { ...f.acceso, password: e.target.value } })} />

                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                  <input type="checkbox" checked={!!f.acceso.guardarCredenciales} onChange={(e) => setF({ ...f, acceso: { ...f.acceso, guardarCredenciales: e.target.checked } })} />
                  <span style={{ fontSize: "12px", color: "#b91c1c" }}>Guardar credenciales en el sistema (NO recomendado)</span>
                </div>

                <small style={{ color: "#64748b" }}>Recomendado: si el cliente da password/código, úsalo solo para la atención y no lo guardes.</small>
              </div>

              <div>
                {f.acceso.tipoBloqueo === "Patron" ? (
                  <>
                    <label style={s_lbl}>Patrón (dibujar)</label>
                    <PatternLock value={f.acceso.patronSeq} onChange={(seq) => setF({ ...f, acceso: { ...f.acceso, patronSeq: seq } })} allowRepeat={true} />
                    <div style={{ fontSize: "12px", marginTop: "8px" }}>
                      <b>Secuencia:</b> {f.acceso.patronSeq || "—"}
                    </div>
                    <small style={{ color: "#64748b" }}>Permite repetir puntos (ej: 1-2-3-5-7-8-5-6).</small>
                  </>
                ) : (
                  <div style={{ padding: "14px", background: "#f8fafc", borderRadius: "10px", border: "1px dashed #e2e8f0" }}>
                    <b>Panel de dibujo</b>
                    <div style={{ color: "#64748b", fontSize: "12px", marginTop: "6px" }}>
                      Se habilita solo cuando selecciones <b>Patrón</b>.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DECLARACIÓN JURADA / CONSENTIMIENTO */}
          <div style={{ marginTop: "12px", borderTop: "1px solid #e5e7eb", paddingTop: "12px" }}>
            <h4 style={{ margin: "0 0 8px 0" }}>🧾 Declaración Jurada / Consentimiento (Firma Digital)</h4>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={s_lbl}>Condición del equipo al ingreso</label>
                <select style={s_inp} value={f.consent.condicionIngreso} onChange={(e) => setF({ ...f, consent: { ...f.consent, condicionIngreso: e.target.value } })}>
                  {["No evaluado", "Apagado", "Muerto (no enciende)", "Enciende"].map((x) => (
                    <option key={x} value={x}>
                      {x}
                    </option>
                  ))}
                </select>

                <label style={s_lbl}>Observaciones (opcional)</label>
                <textarea
                  style={{ ...s_inp, height: "70px" }}
                  placeholder="Ej: vino sin carga, mojado, golpe, etc."
                  value={f.consent.observaciones}
                  onChange={(e) => setF({ ...f, consent: { ...f.consent, observaciones: e.target.value } })}
                />

                <div style={{ padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                  <div style={{ fontSize: "12px", color: "#0f172a", fontWeight: "bold", marginBottom: "6px" }}>Texto de Declaración (se imprimirá en el PDF)</div>
                  <div style={{ fontSize: "12px", color: "#334155", lineHeight: 1.35, maxHeight: "180px", overflow: "auto", whiteSpace: "pre-wrap" }}>{CONSENT_TEXT}</div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px" }}>
                  <input type="checkbox" checked={!!f.consent.acepta} onChange={(e) => setF({ ...f, consent: { ...f.consent, acepta: e.target.checked } })} />
                  <span style={{ fontSize: "12px" }}>Acepto y firmo la Declaración Jurada / Consentimiento</span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
                  <div>
                    <label style={s_lbl}>Nombre del firmante</label>
                    <input style={s_inp} placeholder="Nombres y apellidos" value={f.consent.firmanteNombre} onChange={(e) => setF({ ...f, consent: { ...f.consent, firmanteNombre: e.target.value } })} />
                  </div>
                  <div>
                    <label style={s_lbl}>DNI / RUC</label>
                    <input style={s_inp} placeholder="Documento" value={f.consent.firmanteDni} onChange={(e) => setF({ ...f, consent: { ...f.consent, firmanteDni: e.target.value } })} />
                  </div>
                </div>

                {!validarConsent() && (
                  <div style={{ marginTop: "6px", fontSize: "12px", color: "#b91c1c" }}>⚠️ Para guardar la OS: debe aceptar, llenar Nombre/DNI y firmar.</div>
                )}
              </div>

              <div>
                <label style={s_lbl}>Firma (dibujar con dedo / lápiz / mouse)</label>
                <SignaturePad value={f.consent.firmaDataUrl} onChange={(dataUrl) => setF({ ...f, consent: { ...f.consent, firmaDataUrl: dataUrl } })} disabled={!f.consent.acepta} />
                <small style={{ color: "#64748b" }}>Tip: en tablet, firma con el dedo. En Wacom también funciona.</small>
              </div>
            </div>
          </div>
        </div>

        {/* COSTOS */}
        <div style={{ ...s_card, background: "#f8fafc" }}>
          <h3 style={{ marginTop: 0 }}>Costos</h3>

          {/* ✅ DIAGNÓSTICO */}
          <div style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "10px", background: "#fff", marginBottom: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <input
                  type="checkbox"
                  checked={!!f.diagnostico.aplica}
                  onChange={(e) =>
                    setF({
                      ...f,
                      diagnostico: {
                        ...f.diagnostico,
                        aplica: e.target.checked,
                        monto: Number(f.diagnostico?.monto || 50),
                      },
                    })
                  }
                />
                <div>
                  <div style={{ fontWeight: "bold", fontSize: "12px" }}>Diagnóstico (si NO aprueba reparación)</div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>Se cobra si el cliente solo quiere revisión. Si aprueba reparación, se descuenta del servicio.</div>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px" }}>S/</span>
                <input
                  style={{ ...s_inp, marginBottom: 0, width: "110px" }}
                  type="number"
                  disabled={!f.diagnostico.aplica}
                  value={f.diagnostico.monto}
                  onChange={(e) => setF({ ...f, diagnostico: { ...f.diagnostico, monto: e.target.value } })}
                />
              </div>
            </div>
          </div>

          <label style={s_lbl}>Repuestos</label>
          <select
            style={s_inp}
            onChange={(e) => {
              const p = (inventario || []).find((i) => String(i.id) === String(e.target.value));
              if (p) setF({ ...f, repuestos: [...(f.repuestos || []), { ...p, cantidad: 1, invId: p.id }] });
            }}
          >
            <option value="">+ Agregar Repuesto</option>
            {(inventario || []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} — {i.sku} ({money(i.precioVenta)}) [STK:{i.stock}]
              </option>
            ))}
          </select>

          <div style={{ fontSize: "11px", marginBottom: "10px" }}>
            {(f.repuestos || []).map((r, i) => (
              <div key={i}>
                • {r.nombre} ({money(r.precioVenta)}) x{r.cantidad || 1}
              </div>
            ))}
          </div>

          <input style={s_inp} type="number" placeholder="Mano de Obra" value={f.servicio.manoObra} onChange={(e) => setF({ ...f, servicio: { ...f.servicio, manoObra: e.target.value } })} />

          <div style={{ display: "flex", gap: "5px" }}>
            <input style={s_inp} type="number" placeholder="Adelanto" value={f.adelanto} onChange={(e) => setF({ ...f, adelanto: e.target.value })} />
            <select style={{ ...s_inp, width: "140px" }} value={f.metodoAdelanto} onChange={(e) => setF({ ...f, metodoAdelanto: e.target.value })}>
              {METODOS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>

          <div style={{ padding: "12px", background: "#dcfce7", borderRadius: "8px", marginTop: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Total:</span>
              <b>{money(totalGral)}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#b91c1c" }}>
              <span>Saldo:</span>
              <b>{money(totalGral - Number(f.adelanto || 0))}</b>
            </div>
          </div>

          <button type="submit" style={{ ...s_btn_std, width: "100%", padding: "12px", background: "#22c55e", marginTop: "10px" }}>
            GUARDAR ORDEN
          </button>
          <button type="button" onClick={() => setModo("lista")} style={{ ...s_btn_std, width: "100%", background: "#64748b", marginTop: "5px" }}>
            CANCELAR
          </button>
        </div>
      </form>
    );

  // LISTA
  return (
    <div style={s_card}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
        <input style={{ ...s_inp, width: "380px", marginBottom: 0 }} placeholder="🔍 Buscar ID, Cliente o IMEI..." onChange={(e) => setBusq(e.target.value)} />
        <button onClick={() => setModo("nueva")} style={{ ...s_btn_std, background: "#22c55e" }}>
          + NUEVA ORDEN
        </button>
      </div>

      <table style={s_tabl}>
        <thead style={{ background: "#f8fafc", textAlign: "left" }}>
          <tr>
            <th style={s_th}>ID / Fecha</th>
            <th style={s_th}>Cliente</th>
            <th style={s_th}>Equipo / IMEI</th>
            <th style={s_th}>Estado</th>
            <th style={s_th}>Total</th>
            <th style={s_th}>Saldo</th>
            <th style={s_th}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {(ordenes || [])
            .filter((o) => (String(o.id) + String(o.cliente?.nombre || "") + String(o.equipo?.imei || "")).toLowerCase().includes((busq || "").toLowerCase()))
            .map((o) => {
              const diagAplica = !!o.diagnostico?.aplica;
              const diagCobrado = !!o.diagnostico?.cobrado;

              return (
                <tr key={o.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={s_td}>
                    <b>{o.id}</b>
                    <br />
                    <small>{o.fecha}</small>
                    {diagAplica && (
                      <div style={{ marginTop: "6px" }}>
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "2px 6px",
                            borderRadius: "8px",
                            background: diagCobrado ? "#dcfce7" : "#fee2e2",
                            color: diagCobrado ? "#166534" : "#991b1b",
                            fontWeight: "bold",
                          }}
                        >
                          DIAG {diagCobrado ? "COBRADO" : "PENDIENTE"}
                        </span>
                      </div>
                    )}
                  </td>
                  <td style={s_td}>
                    {o.cliente?.nombre}
                    <br />
                    <small>{o.cliente?.telefono}</small>
                  </td>
                  <td style={s_td}>
                    {o.equipo?.marca} {o.equipo?.modelo}
                    <br />
                    <small>{o.equipo?.imei}</small>
                  </td>
                  <td style={s_td}>
                    <select value={o.estado} onChange={(e) => changeStatus(o.id, e.target.value)} style={{ padding: "4px", borderRadius: "5px", background: o.estado === "Entregado" ? "#dcfce7" : "#fef3c7" }}>
                      {ESTADOS_OT.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={s_td}>{money(o.total)}</td>
                  <td style={{ ...s_td, color: Number(o.saldo) > 0 ? "red" : "green" }}>{money(o.saldo)}</td>
                  <td style={s_td}>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => onPrint?.("OSPDF", o)}
                        style={{ border: "none", background: "#0ea5e9", color: "white", padding: "6px 10px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
                      >
                        🖨️ PDF
                      </button>

                      {diagAplica && !diagCobrado && (
                        <button
                          type="button"
                          onClick={() => cobrarDiagnostico(o.id)}
                          style={{ border: "none", background: "#111827", color: "white", padding: "6px 10px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
                        >
                          💳 Cobrar Diagnóstico
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => cerrarComoDiagnostico(o.id)}
                        style={{ border: "none", background: "#6b7280", color: "white", padding: "6px 10px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
                      >
                        🧾 Cerrar como Diagnóstico
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => deleteOrden(o.id)}
                          style={{ border: "none", background: "#ef4444", color: "white", padding: "6px 10px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
                        >
                          🗑️ Borrar OS
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>

      <div style={{ marginTop: "12px", fontSize: "12px", color: "#64748b" }}>
        Tip PRO: si necesitas aumentar stock por compra/ingreso, ve a <b>INVENTARIO</b> y usa <b>Ajuste + / -</b> (queda registrado en historial).
      </div>
    </div>
  );
}

function ViewInventario({ inventario, setInventario, isAdmin, ajustarStock }) {
  const [f, setF] = useState({
    sku: "",
    nombre: "",
    categoria: "Pantalla",
    calidad: "Original",
    costoCompra: "",
    precioVenta: "",
    stock: "",
    stockMin: 2,
    ubicacion: "",
    compatibilidad: "",
    proveedor: "",
    nota: "",
  });
  const [filtro, setFiltro] = useState("");
  const [edit, setEdit] = useState(null); // item
  const [aj, setAj] = useState({ invId: "", delta: "", motivo: "" });

  const filtrados = useMemo(() => {
    return (inventario || []).filter((i) =>
      (String(i.nombre || "") + " " + String(i.sku || "") + " " + String(i.compatibilidad || "") + " " + String(i.ubicacion || "") + " " + String(i.proveedor || ""))
        .toLowerCase()
        .includes((filtro || "").toLowerCase())
    );
  }, [inventario, filtro]);

  const add = () => {
    if (!f.sku || !f.nombre) return alert("SKU y Nombre obligatorios.");
    if ((inventario || []).find((i) => String(i.sku).trim().toLowerCase() === String(f.sku).trim().toLowerCase())) return alert("SKU duplicado.");
    setInventario([{ ...f, id: Date.now().toString(), stock: Number(f.stock || 0), stockMin: Number(f.stockMin || 0) }, ...(inventario || [])]);
    setF({
      sku: "",
      nombre: "",
      categoria: "Pantalla",
      calidad: "Original",
      costoCompra: "",
      precioVenta: "",
      stock: "",
      stockMin: 2,
      ubicacion: "",
      compatibilidad: "",
      proveedor: "",
      nota: "",
    });
  };

  const del = (id) => {
    if (!isAdmin) return alert("Solo admin puede borrar items de inventario.");
    if (!window.confirm("¿Borrar item del inventario? (No se puede deshacer)")) return;
    setInventario((inventario || []).filter((x) => x.id !== id));
  };

  const openEdit = (item) => {
    if (!isAdmin) return alert("Solo admin puede editar inventario.");
    setEdit({ ...item });
  };

  const saveEdit = () => {
    if (!edit?.id) return;
    if (!String(edit.sku || "").trim() || !String(edit.nombre || "").trim()) return alert("SKU y Nombre obligatorios.");
    // SKU duplicado (otro id)
    const dup = (inventario || []).find((x) => String(x.id) !== String(edit.id) && String(x.sku || "").trim().toLowerCase() === String(edit.sku || "").trim().toLowerCase());
    if (dup) return alert("SKU duplicado (otro item).");
    setInventario((prev) =>
      (prev || []).map((x) =>
        String(x.id) === String(edit.id)
          ? {
              ...edit,
              stock: Number(edit.stock || 0),
              stockMin: Number(edit.stockMin || 0),
              costoCompra: edit.costoCompra === "" ? "" : Number(edit.costoCompra || 0),
              precioVenta: edit.precioVenta === "" ? "" : Number(edit.precioVenta || 0),
            }
          : x
      )
    );
    setEdit(null);
  };

  const doAjuste = () => {
    if (!isAdmin) return alert("Solo admin puede ajustar stock.");
    if (!aj.invId) return alert("Selecciona un item.");
    const d = Number(aj.delta);
    if (!d || !Number.isFinite(d)) return alert("Delta inválido. Ej: 5 o -2");
    ajustarStock({ invId: aj.invId, delta: d, motivo: aj.motivo || "Ajuste manual" });
    setAj({ invId: "", delta: "", motivo: "" });
    alert("Stock ajustado y registrado en historial.");
  };

  return (
    <div style={s_card}>
      <h3 style={{ marginTop: 0 }}>Inventario PRO</h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr) auto", gap: "8px", background: "#f8fafc", padding: "12px", borderRadius: "10px", marginBottom: "12px" }}>
        <input style={s_inp} placeholder="SKU" value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} />
        <input style={s_inp} placeholder="Nombre Item" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        <select style={s_inp} value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
          {INV_CATEGORIAS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <select style={s_inp} value={f.calidad} onChange={(e) => setF({ ...f, calidad: e.target.value })}>
          {CALIDADES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input style={s_inp} type="number" placeholder="Costo Compra" value={f.costoCompra} onChange={(e) => setF({ ...f, costoCompra: e.target.value })} />
        <input style={s_inp} type="number" placeholder="Precio Venta" value={f.precioVenta} onChange={(e) => setF({ ...f, precioVenta: e.target.value })} />
        <input style={s_inp} type="number" placeholder="Stock" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} />
        <input style={s_inp} type="number" placeholder="Stock Min" value={f.stockMin} onChange={(e) => setF({ ...f, stockMin: e.target.value })} />
        <input style={s_inp} placeholder="Ubicación" value={f.ubicacion} onChange={(e) => setF({ ...f, ubicacion: e.target.value })} />
        <input style={s_inp} placeholder="Compatibilidad (iPhone 11 / XR...)" value={f.compatibilidad} onChange={(e) => setF({ ...f, compatibilidad: e.target.value })} />
        <input style={s_inp} placeholder="Proveedor (opcional)" value={f.proveedor} onChange={(e) => setF({ ...f, proveedor: e.target.value })} />
        <button onClick={add} style={{ ...s_btn_std, background: "#22c55e", height: "38px" }}>
          + AÑADIR
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 520px", gap: "12px", alignItems: "start" }}>
        <div>
          <input style={{ ...s_inp, width: "100%", padding: "10px" }} placeholder="🔍 Buscar por nombre / SKU / compatibilidad / ubicación / proveedor..." value={filtro} onChange={(e) => setFiltro(e.target.value)} />

          <table style={s_tabl}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                <th style={s_th}>SKU</th>
                <th style={s_th}>ITEM</th>
                <th style={s_th}>CAT</th>
                <th style={s_th}>COMPRA</th>
                <th style={s_th}>VENTA</th>
                <th style={s_th}>STOCK</th>
                <th style={s_th}>UBIC</th>
                <th style={s_th}>ACC</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((i) => {
                const low = Number(i.stock || 0) <= Number(i.stockMin || 0);
                return (
                  <tr key={i.id} style={{ borderBottom: "1px solid #eee", background: low ? "#fff7ed" : "#fff" }}>
                    <td style={s_td}>{i.sku}</td>
                    <td style={s_td}>
                      <b>{i.nombre}</b>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>
                        {i.calidad} · {i.compatibilidad || "—"}
                      </div>
                    </td>
                    <td style={s_td}>{i.categoria}</td>
                    <td style={s_td}>{money(i.costoCompra)}</td>
                    <td style={s_td}>
                      <b>{money(i.precioVenta)}</b>
                    </td>
                    <td style={{ ...s_td, color: low ? "#b91c1c" : "inherit", fontWeight: "bold" }}>
                      {i.stock} <span style={{ fontSize: "11px", color: "#64748b" }}>(min {i.stockMin || 0})</span>
                    </td>
                    <td style={s_td}>{i.ubicacion || "—"}</td>
                    <td style={s_td}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => openEdit(i)} style={{ border: "none", background: "none", cursor: "pointer" }} title="Editar (admin)">
                          ✏️
                        </button>
                        <button onClick={() => del(i.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "red" }} title="Borrar (admin)">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtrados.length === 0 && (
                <tr>
                  <td style={s_td} colSpan={8}>
                    <span style={{ color: "#64748b" }}>No hay resultados.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* AJUSTE STOCK */}
        <div style={{ padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "#fff" }}>
          <h4 style={{ margin: 0 }}>🔧 Ajuste de Stock (Admin)</h4>
          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>Ejemplos: +10 por compra, -2 por merma. Queda registrado en Historial.</div>

          <label style={{ ...s_lbl, marginTop: "10px" }}>Item</label>
          <select style={s_inp} value={aj.invId} onChange={(e) => setAj({ ...aj, invId: e.target.value })}>
            <option value="">-- Seleccionar --</option>
            {(inventario || []).map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre} — {i.sku} [STK:{i.stock}]
              </option>
            ))}
          </select>

          <label style={s_lbl}>Delta (positivo o negativo)</label>
          <input style={s_inp} placeholder="Ej: 5 o -3" value={aj.delta} onChange={(e) => setAj({ ...aj, delta: e.target.value })} />

          <label style={s_lbl}>Motivo</label>
          <input style={s_inp} placeholder="Compra, ajuste, merma, etc." value={aj.motivo} onChange={(e) => setAj({ ...aj, motivo: e.target.value })} />

          <button onClick={doAjuste} style={{ ...s_btn_std, background: "#111827", width: "100%" }}>
            Aplicar Ajuste
          </button>

          <div style={{ marginTop: "10px", fontSize: "12px", color: isAdmin ? "#166534" : "#991b1b", background: isAdmin ? "#dcfce7" : "#fee2e2", padding: "10px", borderRadius: "10px" }}>
            {isAdmin ? "Admin activo: puedes editar/borrar/ajustar stock." : "Admin OFF: inventario solo lectura (no se puede editar/borrar/ajustar)."}
          </div>
        </div>
      </div>

      {/* MODAL EDIT */}
      {edit && (
        <Modal onClose={() => setEdit(null)} title="Editar item (Admin)">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={s_lbl}>SKU</label>
              <input style={s_inp} value={edit.sku || ""} onChange={(e) => setEdit({ ...edit, sku: e.target.value })} />
            </div>
            <div>
              <label style={s_lbl}>Nombre</label>
              <input style={s_inp} value={edit.nombre || ""} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} />
            </div>
            <div>
              <label style={s_lbl}>Categoría</label>
              <select style={s_inp} value={edit.categoria || "Otro"} onChange={(e) => setEdit({ ...edit, categoria: e.target.value })}>
                {INV_CATEGORIAS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={s_lbl}>Calidad</label>
              <select style={s_inp} value={edit.calidad || "Genérico"} onChange={(e) => setEdit({ ...edit, calidad: e.target.value })}>
                {CALIDADES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={s_lbl}>Costo compra</label>
              <input style={s_inp} type="number" value={edit.costoCompra ?? ""} onChange={(e) => setEdit({ ...edit, costoCompra: e.target.value })} />
            </div>
            <div>
              <label style={s_lbl}>Precio venta</label>
              <input style={s_inp} type="number" value={edit.precioVenta ?? ""} onChange={(e) => setEdit({ ...edit, precioVenta: e.target.value })} />
            </div>
            <div>
              <label style={s_lbl}>Stock</label>
              <input style={s_inp} type="number" value={edit.stock ?? 0} onChange={(e) => setEdit({ ...edit, stock: e.target.value })} />
            </div>
            <div>
              <label style={s_lbl}>Stock min</label>
              <input style={s_inp} type="number" value={edit.stockMin ?? 0} onChange={(e) => setEdit({ ...edit, stockMin: e.target.value })} />
            </div>
            <div>
              <label style={s_lbl}>Ubicación</label>
              <input style={s_inp} value={edit.ubicacion || ""} onChange={(e) => setEdit({ ...edit, ubicacion: e.target.value })} />
            </div>
            <div>
              <label style={s_lbl}>Compatibilidad</label>
              <input style={s_inp} value={edit.compatibilidad || ""} onChange={(e) => setEdit({ ...edit, compatibilidad: e.target.value })} />
            </div>
            <div>
              <label style={s_lbl}>Proveedor</label>
              <input style={s_inp} value={edit.proveedor || ""} onChange={(e) => setEdit({ ...edit, proveedor: e.target.value })} />
            </div>
            <div>
              <label style={s_lbl}>Nota</label>
              <input style={s_inp} value={edit.nota || ""} onChange={(e) => setEdit({ ...edit, nota: e.target.value })} />
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button onClick={saveEdit} style={{ ...s_btn_std, background: "#22c55e", width: "100%" }}>
              Guardar
            </button>
            <button onClick={() => setEdit(null)} style={{ ...s_btn_std, background: "#64748b", width: "100%" }}>
              Cancelar
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ViewClientes({ clientes, setClientes, isAdmin }) {
  const [f, setF] = useState({ nombre: "", dni: "", telefono: "", direccion: "", tipo: "particular" });

  const add = () => {
    if (!f.nombre || !f.telefono) return alert("Nombre y Teléfono obligatorios.");
    setClientes([{ ...f, id: Date.now().toString() }, ...(clientes || [])]);
    setF({ nombre: "", dni: "", telefono: "", direccion: "", tipo: "particular" });
  };

  const del = (id) => {
    if (!isAdmin) return alert("Solo admin puede borrar clientes.");
    if (!window.confirm("¿Borrar cliente? (No se puede deshacer)")) return;
    setClientes((prev) => (prev || []).filter((c) => String(c.id) !== String(id)));
  };

  return (
    <div style={s_card}>
      <h3 style={{ marginTop: 0 }}>👥 Clientes</h3>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr) auto", gap: "8px", marginBottom: "15px" }}>
        <input style={s_inp} placeholder="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        <input style={s_inp} placeholder="DNI/RUC" value={f.dni} onChange={(e) => setF({ ...f, dni: e.target.value })} />
        <input style={s_inp} placeholder="Telf" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
        <input style={s_inp} placeholder="Dirección" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} />
        <button onClick={add} style={{ ...s_btn_std, background: "#22c55e" }}>
          + REGISTRAR
        </button>
      </div>

      <table style={s_tabl}>
        <thead style={{ textAlign: "left" }}>
          <tr>
            <th style={s_th}>NOMBRE</th>
            <th style={s_th}>DNI</th>
            <th style={s_th}>TELF</th>
            <th style={s_th}>DIRECCIÓN</th>
            <th style={s_th}>ACC</th>
          </tr>
        </thead>
        <tbody>
          {(clientes || []).map((c) => (
            <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={s_td}>
                <b>{c.nombre}</b>
              </td>
              <td style={s_td}>{c.dni}</td>
              <td style={s_td}>{c.telefono}</td>
              <td style={s_td}>{c.direccion}</td>
              <td style={s_td}>
                <button onClick={() => del(c.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "red" }} title="Borrar (admin)">
                  🗑️
                </button>
              </td>
            </tr>
          ))}
          {(clientes || []).length === 0 && (
            <tr>
              <td style={s_td} colSpan={5}>
                <span style={{ color: "#64748b" }}>Sin clientes registrados.</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ViewServicioRapido({ clientes, registrarMovimiento }) {
  const [f, setF] = useState({ desc: "", monto: 0, metodo: "Efectivo", cliId: "" });

  const guardar = () => {
    if (!String(f.desc || "").trim()) return alert("Ingresa descripción.");
    const cli = (clientes || []).find((c) => String(c.id) === String(f.cliId));
    registrarMovimiento({
      tipo: "SERVICIO",
      monto: Number(f.monto || 0),
      descripcion: f.desc,
      metodoPago: f.metodo || "Efectivo",
      cliente: cli ? { id: cli.id, nombre: cli.nombre, dni: cli.dni, telefono: cli.telefono } : { nombre: "Público General" },
    });
    setF({ desc: "", monto: 0, metodo: "Efectivo", cliId: "" });
    alert("Servicio guardado.");
  };

  return (
    <div style={{ ...s_card, maxWidth: "520px" }}>
      <h3 style={{ marginTop: 0 }}>⚡ Servicio Rápido</h3>

      <select style={s_inp} value={f.cliId} onChange={(e) => setF({ ...f, cliId: e.target.value })}>
        <option value="">Público General</option>
        {(clientes || []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </select>

      <input style={s_inp} placeholder="Descripción..." value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />
      <div style={{ display: "flex", gap: "8px" }}>
        <input style={s_inp} type="number" placeholder="Monto S/" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} />
        <select style={{ ...s_inp, width: "180px" }} value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value })}>
          {METODOS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>

      <button onClick={guardar} style={{ ...s_btn_std, width: "100%", background: "#22c55e" }}>
        GUARDAR
      </button>
    </div>
  );
}

function ViewGastos({ registrarMovimiento }) {
  const [f, setF] = useState({ desc: "", monto: 0, metodo: "Efectivo" });

  const guardar = () => {
    if (!String(f.desc || "").trim()) return alert("Motivo requerido.");
    registrarMovimiento({ tipo: "GASTO", monto: Number(f.monto || 0), descripcion: `Gasto: ${f.desc}`, metodoPago: f.metodo || "Efectivo" });
    setF({ desc: "", monto: 0, metodo: "Efectivo" });
    alert("Gasto registrado.");
  };

  return (
    <div style={{ ...s_card, maxWidth: "520px" }}>
      <h3 style={{ marginTop: 0 }}>🧾 Gasto</h3>
      <input style={s_inp} placeholder="Motivo..." value={f.desc} onChange={(e) => setF({ ...f, desc: e.target.value })} />
      <div style={{ display: "flex", gap: "8px" }}>
        <input style={s_inp} type="number" placeholder="Monto S/" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} />
        <select style={{ ...s_inp, width: "180px" }} value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value })}>
          {METODOS.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>
      <button onClick={guardar} style={{ ...s_btn_std, width: "100%", background: "#ef4444" }}>
        REGISTRAR
      </button>
    </div>
  );
}

function ViewCaja({ data, cuadreReal, setCuadreReal }) {
  const movs = data?.movimientos || [];
  const ing = movs.filter((m) => m.tipo !== "GASTO").reduce((a, b) => a + Number(b.monto || 0), 0);
  const egr = movs.filter((m) => m.tipo === "GASTO").reduce((a, b) => a + Number(b.monto || 0), 0);
  const neto = ing - egr;

  const real = Object.values(cuadreReal).reduce((a, b) => a + Number(b || 0), 0);
  const diff = real - neto;

  const porMetodo = useMemo(() => {
    const agg = { Efectivo: 0, "Yape/Plin": 0, Transferencia: 0, Tarjeta: 0, "—": 0 };
    for (const m of movs) {
      const key = m.metodoPago || "—";
      const val = Number(m.monto || 0);
      if (m.tipo === "GASTO") {
        // egreso: restar del método si vino con método
        agg[key] = (agg[key] || 0) - val;
      } else {
        agg[key] = (agg[key] || 0) + val;
      }
    }
    return agg;
  }, [movs]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
      <div style={s_card}>
        <h3 style={{ marginTop: 0 }}>💰 Caja Sistema</h3>
        <div style={{ padding: "15px", background: "#f0fdf4", borderRadius: "10px", marginBottom: "10px" }}>Ingresos: {money(ing)}</div>
        <div style={{ padding: "15px", background: "#fef2f2", borderRadius: "10px", marginBottom: "10px" }}>Egresos: {money(egr)}</div>
        <h2 style={{ color: "#22c55e" }}>Neto: {money(neto)}</h2>

        <div style={{ marginTop: "12px", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0", background: "#fff" }}>
          <div style={{ fontWeight: "bold", marginBottom: "8px" }}>Desglose por método (neto)</div>
          {Object.entries(porMetodo).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
              <span>{k}</span>
              <b>{money(v)}</b>
            </div>
          ))}
        </div>
      </div>

      <div style={s_card}>
        <h3 style={{ marginTop: 0 }}>Cuadre Real</h3>
        {METODOS.map((m) => (
          <div key={m} style={{ marginBottom: "8px" }}>
            <label style={s_lbl}>{m}</label>
            <input style={s_inp} type="number" value={cuadreReal[m]} onChange={(e) => setCuadreReal({ ...cuadreReal, [m]: e.target.value })} />
          </div>
        ))}
        <div style={{ padding: "15px", background: Math.abs(diff) < 1 ? "#dcfce7" : "#fee2e2", borderRadius: "10px", fontWeight: "bold", textAlign: "center" }}>
          {Math.abs(diff) < 1 ? "✅ CAJA CUADRADA" : `❌ DIFERENCIA: ${money(diff)}`}
        </div>
      </div>
    </div>
  );
}

function ViewHistorial({ data, setVerDetalle, fecha, onPrint, isAdmin, onDeleteMov }) {
  const [filtro, setFiltro] = useState("TODOS");
  const movs = useMemo(() => {
    const all = data?.movimientos || [];
    return all.filter((m) => filtro === "TODOS" || m.tipo === filtro);
  }, [data, filtro]);

  return (
    <div style={s_card}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
        <h3 style={{ margin: 0 }}>📜 Historial</h3>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <select style={{ ...s_inp, marginBottom: 0, width: "180px" }} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            <option value="TODOS">Todos</option>
            <option value="VENTA">Ventas</option>
            <option value="SERVICIO">Servicios</option>
            <option value="GASTO">Gastos</option>
            <option value="INVENTARIO">Inventario</option>
          </select>
          <button onClick={() => onPrint?.("REPORT", { fecha, dataDia: data })} style={{ ...s_btn_std, background: "#0ea5e9" }}>
            🖨️ PDF Día
          </button>
        </div>
      </div>

      <table style={s_tabl}>
        <thead>
          <tr style={{ textAlign: "left" }}>
            <th style={s_th}>Hora</th>
            <th style={s_th}>Tipo</th>
            <th style={s_th}>Método</th>
            <th style={s_th}>Cliente</th>
            <th style={s_th}>Descripción</th>
            <th style={s_th}>Monto</th>
            <th style={s_th}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {movs.map((m) => (
            <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={s_td}>{m.hora}</td>
              <td style={s_td}>
                <span style={{ fontSize: "10px", padding: "2px 6px", borderRadius: "999px", background: m.tipo === "GASTO" ? "#fee2e2" : "#f0fdf4" }}>{m.tipo}</span>
              </td>
              <td style={s_td}>{m.metodoPago || "—"}</td>
              <td style={s_td}>{m.cliente?.nombre || "---"}</td>
              <td style={s_td}>{m.descripcion}</td>
              <td style={{ ...s_td, fontWeight: "bold", color: m.tipo === "GASTO" ? "red" : m.tipo === "INVENTARIO" ? "#0f172a" : "green" }}>{money(m.monto)}</td>
              <td style={s_td}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button onClick={() => setVerDetalle(m)} style={{ border: "none", background: "none", cursor: "pointer" }} title="Ver detalle">
                    👁️
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => onDeleteMov?.(m.id)}
                      style={{ border: "none", background: "#ef4444", color: "white", padding: "4px 8px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
                      title="Borrar movimiento (admin)"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {movs.length === 0 && (
            <tr>
              <td style={s_td} colSpan={7}>
                <span style={{ color: "#64748b" }}>Sin movimientos para este filtro.</span>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ModalDetalle({ mov, onClose }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }}>
      <div style={{ background: "#fff", padding: "25px", borderRadius: "15px", maxWidth: "720px", width: "92%", maxHeight: "80vh", overflowY: "auto" }}>
        <h3>Detalle del Movimiento</h3>
        <pre style={{ background: "#f8fafc", padding: "10px", fontSize: "12px", borderRadius: "8px", overflowX: "auto" }}>{JSON.stringify(mov, null, 2)}</pre>
        <button onClick={onClose} style={{ ...s_btn_std, width: "100%", background: "#64748b", marginTop: "10px" }}>
          CERRAR
        </button>
      </div>
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
      <div style={{ width: "92%", maxWidth: "820px", background: "#fff", borderRadius: "16px", padding: "16px", maxHeight: "86vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={{ border: "none", background: "#111827", color: "white", borderRadius: "10px", padding: "8px 12px", cursor: "pointer", fontWeight: "bold" }}>
            Cerrar ✕
          </button>
        </div>
        <div style={{ marginTop: "12px" }}>{children}</div>
      </div>
    </div>
  );
}

/** =========================
 *  PRINT: OS + CONSENT
 *  ========================= */
function PrintOSPlusConsent({ order }) {
  const c = order?.cliente || {};
  const eq = order?.equipo || {};
  const sv = order?.servicio || {};
  const consent = order?.consent || {};
  const diag = order?.diagnostico || {};
  return (
    <div style={{ padding: "26px", color: "black", background: "white", fontFamily: "Arial, sans-serif" }}>
      <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "10px" }}>
        <h1 style={{ margin: 0 }}>DATACELL STORE</h1>
        <p style={{ margin: 0, fontSize: "12px" }}>Servicio Técnico Especializado</p>
        <p style={{ margin: 0, fontSize: "12px" }}>RUC: ____________  |  WhatsApp: ____________</p>
      </div>

      <div style={{ marginTop: "16px" }}>
        <h2 style={{ textAlign: "center", margin: "6px 0" }}>ORDEN DE SERVICIO: {order.id}</h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "12px", fontSize: "12px" }}>
          <div>
            <b>CLIENTE:</b> {c.nombre || "—"}
            <br />
            <b>DNI/RUC:</b> {c.dni || "—"}
            <br />
            <b>TELÉFONO:</b> {c.telefono || "—"}
            <br />
            <b>FECHA:</b> {order.fecha || "—"}
          </div>
          <div>
            <b>EQUIPO:</b> {eq.marca || ""} {eq.modelo || ""} ({eq.tipo || "—"})
            <br />
            <b>IMEI/SERIE:</b> {eq.imei || "—"}
            <br />
            <b>TÉCNICO:</b> {order.tecnico || "—"}
            <br />
            <b>CONDICIÓN INGRESO:</b> {consent.condicionIngreso || "—"}
          </div>
        </div>

        {diag?.aplica && (
          <div style={{ marginTop: "10px", border: "1px solid #000", padding: "10px", fontSize: "12px", background: "#f8fafc" }}>
            <b>DIAGNÓSTICO:</b> Aplicado ({money(diag.monto || 50)}) — Estado: {diag.cobrado ? "COBRADO" : "PENDIENTE"}.
            <div style={{ fontSize: "11px", marginTop: "4px" }}>Si el cliente no aprueba reparación, se cobra el diagnóstico. Si aprueba, se descuenta del servicio.</div>
          </div>
        )}

        <div style={{ marginTop: "10px", border: "1px solid #000", padding: "10px", fontSize: "12px" }}>
          <b>FALLA REPORTADA:</b>
          <br /> {sv.falla || "—"}
        </div>
        <div style={{ marginTop: "10px", border: "1px solid #000", padding: "10px", fontSize: "12px" }}>
          <b>DIAGNÓSTICO (opcional):</b>
          <br /> {sv.diagnostico || "—"}
        </div>
        <div style={{ marginTop: "10px", border: "1px solid #000", padding: "10px", fontSize: "12px" }}>
          <b>TRABAJO A REALIZAR:</b>
          <br /> {sv.trabajo || "—"}
        </div>

        <div style={{ marginTop: "12px", textAlign: "right", fontSize: "12px" }}>
          <div>MANO DE OBRA: {money(sv.manoObra)}</div>
          <div>
            TOTAL: <b>{money(order.total)}</b>
          </div>
          <div>ADELANTO: {money(order.adelanto)}</div>
          <div style={{ color: "red" }}>
            SALDO: <b>{money(order.saldo)}</b>
          </div>
          <div>GARANTÍA: {sv.garantia || "—"} días</div>
        </div>
      </div>

      <div style={{ marginTop: "18px", borderTop: "2px solid #000", paddingTop: "10px" }}>
        <h3 style={{ margin: "0 0 6px 0" }}>DECLARACIÓN JURADA / CONSENTIMIENTO</h3>
        <div style={{ fontSize: "11px", lineHeight: 1.35, whiteSpace: "pre-wrap" }}>{CONSENT_TEXT}</div>

        {String(consent.observaciones || "").trim() && (
          <div style={{ marginTop: "8px", fontSize: "11px" }}>
            <b>OBSERVACIONES:</b> {consent.observaciones}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "14px", alignItems: "end" }}>
          <div>
            <div style={{ fontSize: "12px" }}>
              <b>FIRMANTE:</b> {consent.firmanteNombre || "—"}
            </div>
            <div style={{ fontSize: "12px" }}>
              <b>DNI/RUC:</b> {consent.firmanteDni || "—"}
            </div>
            <div style={{ fontSize: "11px", color: "#334155" }}>
              <b>FECHA FIRMA:</b> {consent.firmadoEn ? new Date(consent.firmadoEn).toLocaleString() : "—"}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "12px", marginBottom: "6px" }}>
              <b>FIRMA:</b>
            </div>
            {consent.firmaDataUrl ? (
              <img src={consent.firmaDataUrl} alt="firma" style={{ width: "260px", height: "90px", objectFit: "contain", border: "1px solid #000" }} />
            ) : (
              <div style={{ width: "260px", height: "90px", border: "1px solid #000" }} />
            )}
          </div>
        </div>
      </div>

      <div style={{ marginTop: "18px", display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
        <div style={{ borderTop: "1px solid #000", width: "220px", textAlign: "center" }}>Firma Cliente</div>
        <div style={{ borderTop: "1px solid #000", width: "220px", textAlign: "center" }}>Firma Datacell</div>
      </div>
    </div>
  );
}

function PrintDayReport({ fecha, data }) {
  const movs = data?.movimientos || [];
  const ing = movs.filter((m) => m.tipo !== "GASTO").reduce((a, b) => a + Number(b.monto || 0), 0);
  const egr = movs.filter((m) => m.tipo === "GASTO").reduce((a, b) => a + Number(b.monto || 0), 0);

  const byTipo = useMemo(() => {
    const agg = {};
    for (const m of movs) agg[m.tipo] = (agg[m.tipo] || 0) + Number(m.monto || 0);
    return agg;
  }, [movs]);

  const byMetodo = useMemo(() => {
    const agg = {};
    for (const m of movs) {
      const k = m.metodoPago || "—";
      const val = Number(m.monto || 0);
      if (m.tipo === "GASTO") agg[k] = (agg[k] || 0) - val;
      else agg[k] = (agg[k] || 0) + val;
    }
    return agg;
  }, [movs]);

  return (
    <div style={{ padding: "30px", color: "black", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>REPORTE DIARIO - DATACELL</h1>
      <h3 style={{ textAlign: "center" }}>FECHA: {fecha}</h3>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid black" }}>
            <th style={{ textAlign: "left" }}>Hora</th>
            <th style={{ textAlign: "left" }}>Tipo</th>
            <th style={{ textAlign: "left" }}>Método</th>
            <th style={{ textAlign: "left" }}>Descripción</th>
            <th style={{ textAlign: "right" }}>Monto</th>
          </tr>
        </thead>
        <tbody>
          {movs.map((m) => (
            <tr key={m.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{m.hora}</td>
              <td>{m.tipo}</td>
              <td>{m.metodoPago || "—"}</td>
              <td>{m.descripcion}</td>
              <td style={{ textAlign: "right" }}>{money(m.monto)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div>
          <h3>Resumen por tipo</h3>
          {Object.entries(byTipo).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #eee", padding: "6px 0" }}>
              <span>{k}</span>
              <b>{money(v)}</b>
            </div>
          ))}
        </div>
        <div>
          <h3>Resumen por método (neto)</h3>
          {Object.entries(byMetodo).map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #eee", padding: "6px 0" }}>
              <span>{k}</span>
              <b>{money(v)}</b>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "30px", textAlign: "right" }}>
        <p>TOTAL INGRESOS: {money(ing)}</p>
        <p>TOTAL EGRESOS: {money(egr)}</p>
        <h2 style={{ margin: 0 }}>NETO EN CAJA: {money(ing - egr)}</h2>
      </div>
    </div>
  );
}

/** =========================
 *  COMPONENTES: PIN PAD
 *  ========================= */
function PinPad({ value, onChange, maxLen = 32 }) {
  const safeVal = String(value || "");
  const push = (ch) => {
    if (safeVal.length >= maxLen) return;
    onChange(safeVal + ch);
  };
  const back = () => onChange(safeVal.slice(0, -1));
  const clear = () => onChange("");

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px", background: "#fff" }}>
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        <input style={{ ...s_inp, marginBottom: 0 }} value={safeVal} placeholder="Escribe aquí (letras y números)" onChange={(e) => onChange(e.target.value.slice(0, maxLen))} />
        <button type="button" onClick={back} style={{ ...s_btn_std, background: "#64748b" }}>
          ⌫
        </button>
        <button type="button" onClick={clear} style={{ ...s_btn_std, background: "#ef4444" }}>
          Limpiar
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((d) => (
          <button key={d} type="button" onClick={() => push(d)} style={{ padding: "10px", borderRadius: "10px", border: "1px solid #e2e8f0", cursor: "pointer", background: "#f8fafc", fontWeight: "bold" }}>
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

/** =========================
 *  COMPONENTES: PATTERN LOCK (con repetición)
 *  ========================= */
function PatternLock({ value, onChange, allowRepeat = true }) {
  const wrapRef = useRef(null);
  const [seq, setSeq] = useState(() => parseSeq(value));
  const [dragging, setDragging] = useState(false);
  const [pointer, setPointer] = useState(null);

  useEffect(() => {
    setSeq(parseSeq(value));
  }, [value]);

  const nodes = useMemo(() => Array.from({ length: 9 }, (_, i) => i + 1), []);

  const getCenters = () => {
    const el = wrapRef.current;
    if (!el) return {};
    const rect = el.getBoundingClientRect();
    const centers = {};
    const dots = el.querySelectorAll("[data-dot='1']");
    dots.forEach((dot) => {
      const idx = Number(dot.getAttribute("data-idx"));
      const r = dot.getBoundingClientRect();
      centers[idx] = { x: r.left - rect.left + r.width / 2, y: r.top - rect.top + r.height / 2 };
    });
    return centers;
  };

  const nearestNode = (x, y) => {
    const centers = getCenters();
    let best = null,
      bestD = Infinity;
    for (const k of Object.keys(centers)) {
      const c = centers[k];
      const dx = c.x - x,
        dy = c.y - y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) {
        bestD = d;
        best = Number(k);
      }
    }
    return bestD <= 26 ? best : null;
  };

  const commit = (newSeq) => {
    setSeq(newSeq);
    onChange?.(newSeq.length ? newSeq.join("-") : "");
  };

  const addNode = (idx) => {
    if (!idx) return;
    const last = seq[seq.length - 1];
    if (last === idx) return; // evita duplicado inmediato
    if (!allowRepeat && seq.includes(idx)) return;
    commit([...seq, idx]);
  };

  const onPointerDown = (e) => {
    e.preventDefault();
    const rect = wrapRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    setDragging(true);
    setPointer({ x, y });
    const n = nearestNode(x, y);
    if (n) addNode(n);
  };

  const onPointerMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    const rect = wrapRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    setPointer({ x, y });
    const n = nearestNode(x, y);
    if (n) addNode(n);
  };

  const onPointerUp = (e) => {
    e.preventDefault();
    setDragging(false);
    setPointer(null);
  };

  const lines = useMemo(() => {
    const pts = [];
    const c = getCenters();
    for (const idx of seq) if (c[idx]) pts.push(c[idx]);
    return pts;
  }, [seq]);

  const reset = () => commit([]);

  return (
    <div>
      <div
        ref={wrapRef}
        style={{ width: "260px", height: "260px", position: "relative", borderRadius: "12px", border: "1px solid #e2e8f0", background: "#fff", touchAction: "none", userSelect: "none", overflow: "hidden" }}
        onMouseDown={onPointerDown}
        onMouseMove={onPointerMove}
        onMouseUp={onPointerUp}
        onMouseLeave={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      >
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
          {lines.length > 1 && <polyline points={lines.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#16a34a" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />}
          {dragging && pointer && lines.length > 0 && (
            <line x1={lines[lines.length - 1].x} y1={lines[lines.length - 1].y} x2={pointer.x} y2={pointer.y} stroke="#16a34a" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
          )}
        </svg>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "22px", padding: "26px", position: "relative" }}>
          {nodes.map((idx) => {
            const active = seq.includes(idx);
            return (
              <div
                key={idx}
                data-dot="1"
                data-idx={idx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  addNode(idx);
                }}
                style={{
                  width: "46px",
                  height: "46px",
                  borderRadius: "50%",
                  border: "2px solid #94a3b8",
                  background: active ? "#16a34a" : "#e2e8f0",
                  boxShadow: active ? "0 0 0 6px rgba(22,163,74,0.25)" : "none",
                  margin: "0 auto",
                  cursor: "pointer",
                }}
                title={String(idx)}
              />
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
        <button type="button" onClick={reset} style={{ ...s_btn_std, background: "#64748b" }}>
          Limpiar
        </button>
      </div>
    </div>
  );
}

function parseSeq(str) {
  if (!str) return [];
  return String(str)
    .split("-")
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 9);
}

/** =========================
 *  COMPONENTE: SIGNATURE PAD
 *  ========================= */
function SignaturePad({ value, onChange, disabled = false }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastRef = useRef({ x: 0, y: 0 });

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const drawLine = (from, to) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const start = (e) => {
    if (disabled) return;
    e.preventDefault();
    drawingRef.current = true;
    lastRef.current = getPos(e);
  };

  const move = (e) => {
    if (disabled) return;
    if (!drawingRef.current) return;
    e.preventDefault();
    const pos = getPos(e);
    drawLine(lastRef.current, pos);
    lastRef.current = pos;
  };

  const end = (e) => {
    if (disabled) return;
    e.preventDefault();
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onChange?.(dataUrl);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange?.("");
  };

  useEffect(() => {
    if (!value) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = value;
  }, [value]);

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px", background: "#fff" }}>
      <canvas
        ref={canvasRef}
        width={520}
        height={180}
        style={{
          width: "100%",
          height: "180px",
          border: "1px dashed #94a3b8",
          borderRadius: "10px",
          background: disabled ? "#f8fafc" : "white",
          touchAction: "none",
        }}
        onMouseDown={start}
        onMouseMove={move}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={move}
        onTouchEnd={end}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
        <div style={{ fontSize: "12px", color: "#64748b" }}>{disabled ? "Activa 'Acepto y firmo' para habilitar firma." : "Firma aquí."}</div>
        <button type="button" onClick={clear} style={{ ...s_btn_std, background: "#64748b" }}>
          Limpiar
        </button>
      </div>
    </div>
  );
}

/** =========================
 *  TEXTO CONSENT (MEJORADO)
 *  ========================= */
const CONSENT_TEXT = `1) DECLARACIÓN DEL CLIENTE:
Declaro bajo juramento ser titular del equipo o contar con autorización del titular para dejarlo en DATACELL STORE para diagnóstico, reparación, pruebas y/o backup (si lo autorizo).

2) ESTADO DEL EQUIPO AL INGRESO (IMPORTANTE):
Reconozco que el equipo puede ingresar APAGADO, SIN CARGA, “MUERTO” (no enciende), con fallas intermitentes, con daños previos, humedad/oxidación, golpes, reparaciones anteriores o fallas ocultas que NO siempre son detectables al momento de recepción.
Si el equipo ingresa apagado/muerto y luego de la reparación enciende, ello NO significa que todos los módulos (Wi-Fi, señal, baseband, audio, cámaras, Face ID/Touch ID, carga, sensores, etc.) estuvieran funcionando antes; por tanto, solo se garantiza el trabajo realizado y las piezas reemplazadas.

3) ALCANCE DE GARANTÍA:
La garantía cubre ÚNICAMENTE la reparación efectuada y/o el repuesto instalado, por el plazo indicado en la Orden de Servicio, y se limita a fallas directamente relacionadas con el trabajo ejecutado.
No cubre: fallas preexistentes, fallas no reportadas al ingreso, fallas ocasionadas por golpes, humedad, manipulación de terceros, software, actualizaciones, bloqueos, cuentas (iCloud/Google), ni componentes ajenos a la reparación realizada.

4) DATOS Y PRIVACIDAD:
Comprendo que existe riesgo de pérdida de información en procesos técnicos (restauración, actualización, cambios de componentes, pruebas). Me responsabilizo de mis datos.
Si entrego códigos/credenciales, autorizo su uso solo para la atención. DATACELL STORE recomienda NO guardar credenciales.

5) DIAGNÓSTICO:
Si el servicio solicitado es SOLO diagnóstico/revisión y el cliente no aprueba la reparación, se aplicará el cobro por diagnóstico indicado en el sistema/orden (ej. S/ 50.00). Si el cliente aprueba la reparación, este monto podrá descontarse del costo final, según lo registrado como adelanto.`;

// --- ESTILOS AUXILIARES ---
const s_card = { background: "#fff", padding: "18px", borderRadius: "12px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)", marginBottom: "15px" };
const s_inp = { padding: "9px", borderRadius: "8px", border: "1px solid #e2e8f0", width: "100%", marginBottom: "8px", outline: "none", boxSizing: "border-box", fontSize: "13px" };
const s_lbl = { fontSize: "11px", fontWeight: "bold", color: "#64748b", display: "block", marginBottom: "2px" };
const s_btn_std = { color: "#fff", border: "none", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const s_btn = (bg) => ({ backgroundColor: bg, color: "#fff", border: "none", padding: "10px 14px", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" });
const s_tabl = { width: "100%", borderCollapse: "collapse" };
const s_th = { textAlign: "left", padding: "10px", background: "#f9fafb", color: "#64748b", borderBottom: "1px solid #e2e8f0", fontSize: "11px", textTransform: "uppercase" };
const s_td = { padding: "10px", borderBottom: "1px solid #f1f5f9", fontSize: "13px" };
