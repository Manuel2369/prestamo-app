"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

interface Payment {
  id: string;
  loan_id: string | null;
  client_name?: string;
  amount: number;
  payment_date: string;
  loan_deleted_at?: string | null;
}

interface NonPayment {
  id: string;
  loan_id: string | null;
  client_name: string;
  reason: string;
  collector_username?: string;
  created_at: string;
}

interface AuditLog {
  id: string;
  action_type: string;
  client_name: string;
  details: string;
  created_at: string;
}

interface Loan {
  id: string;
  client_name: string;
  principal: number;
  interest_rate: number;
  interest_amount: number;
  total_amount: number;
  daily_payment: number;
  days: number;
  status: string;
  created_at: string;
  payments?: Payment[];
}

export default function Home() {
  // Estado de usuario y perfil
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Formulario de Auth
  const [isRegistering, setIsRegistering] = useState(false);
  const [authFullName, setAuthFullName] = useState("");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Formulario de Préstamos
  const [clientName, setClientName] = useState("");
  const [principal, setPrincipal] = useState<number | "">(100);
  const [interestRate, setInterestRate] = useState<number | "">(20);
  const [days, setDays] = useState<number | "">(24);

  // Listas de datos
  const [loading, setLoading] = useState(false);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [nonPayments, setNonPayments] = useState<NonPayment[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [collectors, setCollectors] = useState<Profile[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");

  // Buscadores
  const [searchTerm, setSearchTerm] = useState("");
  const [auditSearchTerm, setAuditSearchTerm] = useState("");

  // Pestañas del Administrador
  const [adminTab, setAdminTab] = useState<"operativo" | "auditoria" | "cobradores">("operativo");

  // Modales
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [customAmount, setCustomAmount] = useState<string>("");

  const [noPayLoan, setNoPayLoan] = useState<Loan | null>(null);
  const [noPayReason, setNoPayReason] = useState<string>("");

  // Cálculos dinámicos seguros
  const safePrincipal = principal === "" ? 0 : Number(principal);
  const safeInterestRate = interestRate === "" ? 0 : Number(interestRate);
  const safeDays = days === "" ? 0 : Number(days);

  const interestAmount = (safePrincipal * safeInterestRate) / 100;
  const totalAmount = safePrincipal + interestAmount;
  const dailyPayment = safeDays > 0 ? Number((totalAmount / safeDays).toFixed(2)) : 0;

  function toInternalEmail(username: string): string {
    const clean = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    return `${clean}@sistema.com`;
  }

  // 1. Escuchar sesión
  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    }

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setUserProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (data) {
      setUserProfile(data as Profile);
    }
  }

  // 2. Cargar datos
  useEffect(() => {
    if (user && userProfile?.status === "approved") {
      fetchLoans();
      fetchPaymentsHistory();
      fetchNonPayments();
      fetchAuditLogs();
      if (userProfile?.role === "admin") {
        fetchCollectors();
      }
    }
  }, [user, userProfile]);

  async function fetchLoans() {
    const { data, error } = await supabase
      .from("loans")
      .select("*, payments(*)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLoans(data as Loan[]);
    }
  }

  async function fetchPaymentsHistory() {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .order("payment_date", { ascending: false });

    if (!error && data) {
      setAllPayments(data as Payment[]);
    }
  }

  async function fetchNonPayments() {
    const { data, error } = await supabase
      .from("non_payments")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setNonPayments(data as NonPayment[]);
    }
  }

  async function fetchAuditLogs() {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAuditLogs(data as AuditLog[]);
    }
  }

  async function fetchCollectors() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) {
      setCollectors(data as Profile[]);
    }
  }

  // Auth Handler
  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthError("");
    setLoading(true);

    const cleanUsername = authUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");

    if (!cleanUsername) {
      setAuthError("El nombre de usuario solo puede contener letras y números sin espacios");
      setLoading(false);
      return;
    }

    const internalEmail = toInternalEmail(cleanUsername);

    if (isRegistering) {
      if (!authFullName.trim()) {
        setAuthError("Ingresa el nombre completo");
        setLoading(false);
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: internalEmail,
        password: authPassword,
        options: {
          data: {
            username: cleanUsername,
            full_name: authFullName,
          },
        },
      });

      if (error) {
        setAuthError(error.message);
      } else {
        alert("Solicitud enviada. El administrador debe verificarla antes de que puedas ingresar.");
        setIsRegistering(false);
        setAuthPassword("");
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password: authPassword,
      });

      if (error) {
        setAuthError("Usuario o contraseña incorrectos.");
      } else if (data?.user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("status")
          .eq("id", data.user.id)
          .single();

        if (prof && prof.status === "pending") {
          await supabase.auth.signOut();
          setAuthError("Tu cuenta está pendiente de verificación por el administrador.");
        } else if (prof && prof.status === "rejected") {
          await supabase.auth.signOut();
          setAuthError("Tu solicitud de acceso ha sido rechazada por el administrador.");
        } else {
          setAuthPassword("");
        }
      }
    }

    setLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
    setLoans([]);
    setAllPayments([]);
    setNonPayments([]);
    setAuditLogs([]);
    setCollectors([]);
    setAuthPassword("");
    setAuthUsername("");
    setAuthFullName("");
    setAuthError("");
  }

  // Gestión de Cobradores
  async function handleApproveCollector(collectorId: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ status: "approved" })
      .eq("id", collectorId);

    if (error) {
      alert("Error al verificar: " + error.message);
    } else {
      fetchCollectors();
    }
  }

  async function handleDeleteCollector(collectorId: string, username: string) {
    if (!confirm(`¿Eliminar la cuenta de @${username}?`)) return;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", collectorId);

    if (error) {
      alert("Error al eliminar cuenta: " + error.message);
    } else {
      fetchCollectors();
    }
  }

  // Préstamos
  async function handleCreateLoan() {
    if (!clientName.trim()) {
      alert("Ingresa el nombre del cliente");
      return;
    }

    if (safePrincipal <= 0 || safeDays <= 0) {
      alert("Ingresa monto y plazo válidos");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("loans").insert([
      {
        client_name: clientName,
        principal: safePrincipal,
        interest_rate: safeInterestRate,
        interest_amount: interestAmount,
        total_amount: totalAmount,
        days: safeDays,
        daily_payment: dailyPayment,
      },
    ]);

    setLoading(false);

    if (error) {
      alert("Error: " + error.message);
    } else {
      setClientName("");
      setPrincipal(100);
      setInterestRate(20);
      setDays(24);
      fetchLoans();
    }
  }

  // Cobro
  async function handleCollectPayment(loan: Loan, amount: number) {
    if (amount <= 0 || isNaN(amount)) {
      alert("Monto inválido");
      return;
    }

    const { error } = await supabase.from("payments").insert([
      {
        loan_id: loan.id,
        client_name: loan.client_name,
        amount: amount,
      },
    ]);

    if (error) {
      alert("Error al registrar pago: " + error.message);
    } else {
      setSelectedLoan(null);
      setCustomAmount("");
      fetchLoans();
      fetchPaymentsHistory();
    }
  }

  // REGISTRO DE NO ABONO / JUSTIFICACIÓN
  async function handleRegisterNoPay() {
    if (!noPayLoan) return;
    if (!noPayReason.trim()) {
      alert("Por favor escribe el motivo del no abono");
      return;
    }

    const { error } = await supabase.from("non_payments").insert([
      {
        loan_id: noPayLoan.id,
        client_name: noPayLoan.client_name,
        reason: noPayReason.trim(),
        collector_username: userProfile?.username || user?.email,
      },
    ]);

    if (error) {
      alert("Error al registrar novedad: " + error.message);
    } else {
      alert(`Novedad registrada para ${noPayLoan.client_name}`);
      setNoPayLoan(null);
      setNoPayReason("");
      fetchNonPayments();
    }
  }

  // Eliminación de Préstamo con Auditoría
  async function handleDeleteLoan(loan: Loan) {
    const confirmDelete = confirm(
      `¿Seguro que deseas eliminar el préstamo de ${loan.client_name}? Se generará una alerta de auditoría con la fecha y hora de eliminación.`
    );
    if (!confirmDelete) return;

    const deletionTimestamp = new Date().toISOString();

    await supabase.from("audit_logs").insert([
      {
        action_type: "loan_deleted",
        client_name: loan.client_name,
        details: `Préstamo por $${loan.total_amount} (${loan.days} días) eliminado del sistema.`,
      },
    ]);

    await supabase
      .from("payments")
      .update({ loan_deleted_at: deletionTimestamp })
      .eq("loan_id", loan.id);

    const { error } = await supabase.from("loans").delete().eq("id", loan.id);

    if (error) {
      alert("Error al eliminar préstamo: " + error.message);
    } else {
      alert(
        `Préstamo de ${loan.client_name} eliminado. Quedó registrado en Auditoría el ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}.`
      );
      fetchLoans();
      fetchPaymentsHistory();
      fetchAuditLogs();
    }
  }

  function sendWhatsAppReceipt(loan: Loan, lastPayment: number, balance: number, totalPaid: number) {
    const message =
      `*COMPROBANTE DE PAGO*%0A` +
      `------------------------------%0A` +
      `*Cliente:* ${loan.client_name}%0A` +
      `*Abono realizado:* $${lastPayment.toFixed(2)}%0A` +
      `*Total abonado:* $${totalPaid.toFixed(2)}%0A` +
      `*Saldo restante:* $${Math.max(0, balance).toFixed(2)}%0A` +
      `------------------------------%0A` +
      `¡Gracias por su puntualidad!`;

    window.open(`https://wa.me/?text=${message}`, "_blank");
  }

  // Métricas
  const todayDateString = new Date().toISOString().split("T")[0];

  const todayPayments = allPayments.filter(
    (p) => p.payment_date && p.payment_date.startsWith(todayDateString)
  );

  const todayCollectedTotal = todayPayments.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalCapitalLent = loans.reduce((acc, l) => acc + Number(l.principal), 0);
  const totalInterestExpected = loans.reduce((acc, l) => acc + Number(l.interest_amount), 0);
  const totalCollectedAllTime = allPayments.reduce((acc, p) => acc + Number(p.amount), 0);
  const totalExpectedAllTime = loans.reduce((acc, l) => acc + Number(l.total_amount), 0);
  const totalOutstandingBalance = Math.max(0, totalExpectedAllTime - totalCollectedAllTime);

  // Filtro de ruta
  const filteredLoans = loans.filter((loan) => {
    const matchesSearch = loan.client_name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    const totalPaid = loan.payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0;
    const isCompleted = totalPaid >= loan.total_amount;

    if (!matchesSearch) return false;
    if (filter === "active") return !isCompleted;
    if (filter === "completed") return isCompleted;
    return true;
  });

  // --- FILTROS SINCRONIZADOS DE AUDITORÍA CON UNA SOLA BARRA DE BÚSQUEDA ---
  const query = auditSearchTerm.toLowerCase().trim();

  // 1. Filtrar Transacciones por nombre de cliente
  const filteredPaymentsHistory = allPayments.filter((p) =>
    (p.client_name || "").toLowerCase().includes(query)
  );

  // 2. Filtrar Clientes que No Abonaron por nombre de cliente o motivo
  const filteredNonPayments = nonPayments.filter((np) =>
    np.client_name.toLowerCase().includes(query) ||
    np.reason.toLowerCase().includes(query)
  );

  // 3. Filtrar Préstamos Eliminados por nombre de cliente o detalle
  const filteredAuditLogs = auditLogs.filter((log) =>
    log.client_name.toLowerCase().includes(query) ||
    log.details.toLowerCase().includes(query)
  );

  const pendingRequestsCount = collectors.filter((c) => c.status === "pending").length;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-500 font-semibold">
        Cargando sesión...
      </div>
    );
  }

  // PANTALLA DE ACCESO
  if (!user || userProfile?.status !== "approved") {
    return (
      <main className="min-h-screen bg-slate-100 p-4 flex items-center justify-center">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-800">
              {isRegistering ? "Registro de Cobrador" : "Acceso al Sistema"}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {isRegistering
                ? "Solicita tu cuenta para salir a ruta"
                : "Ingresa tu usuario y contraseña"}
            </p>
          </div>

          {authError && (
            <div className="bg-red-50 text-red-700 text-xs p-3 rounded-lg border border-red-200">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {isRegistering && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Carlos Gómez"
                  value={authFullName}
                  onChange={(e) => setAuthFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                Usuario
              </label>
              <input
                type="text"
                required
                placeholder="Ej: carlos10 o admin"
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Solo letras y números (sin @ ni espacios)
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                Contraseña
              </label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-xl transition duration-150 shadow-sm text-sm disabled:opacity-50"
            >
              {loading
                ? "Procesando..."
                : isRegistering
                ? "Solicitar Cuenta"
                : "Entrar al Sistema"}
            </button>
          </form>

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setAuthError("");
                setAuthPassword("");
              }}
              className="text-xs text-blue-600 hover:underline font-semibold"
            >
              {isRegistering
                ? "¿Ya tienes usuario? Inicia sesión aquí"
                : "¿Eres un nuevo cobrador? Regístrate aquí"}
            </button>
          </div>
        </div>
      </main>
    );
  }

  const isAdmin = userProfile?.role === "admin";
  const displayUsername = userProfile?.username || userProfile?.full_name || "Usuario";

  // VISTA PRINCIPAL
  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8 flex flex-col items-center gap-6 pb-20">
      {/* BARRA SUPERIOR DE PERFIL */}
      <div className="w-full max-w-md flex justify-between items-center bg-white px-4 py-3 rounded-2xl border border-slate-200 text-xs shadow-sm">
        <div className="flex flex-col">
          <span className="font-bold text-slate-800 text-sm">
            👤 {displayUsername}
          </span>
          <span className="text-[10px] text-slate-400">
            {userProfile?.full_name && `${userProfile.full_name} • `}
            <span
              className={`font-bold uppercase ${
                isAdmin ? "text-purple-600" : "text-blue-600"
              }`}
            >
              {isAdmin ? "Administrador" : "Cobrador"}
            </span>
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="text-red-600 hover:text-red-700 font-bold hover:underline"
        >
          Cerrar Sesión
        </button>
      </div>

      {/* PESTAÑAS PARA EL ADMINISTRADOR */}
      {isAdmin && (
        <div className="w-full max-w-md flex bg-slate-200 p-1 rounded-xl text-xs font-bold gap-1">
          <button
            type="button"
            onClick={() => setAdminTab("operativo")}
            className={`flex-1 py-2 rounded-lg transition ${
              adminTab === "operativo"
                ? "bg-white text-slate-800 shadow-sm"
                : "text-slate-600"
            }`}
          >
            Ruta
          </button>
          <button
            type="button"
            onClick={() => setAdminTab("auditoria")}
            className={`flex-1 py-2 rounded-lg transition ${
              adminTab === "auditoria"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-600"
            }`}
          >
            Auditoría 📊
          </button>
          <button
            type="button"
            onClick={() => setAdminTab("cobradores")}
            className={`flex-1 py-2 rounded-lg transition relative ${
              adminTab === "cobradores"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600"
            }`}
          >
            Equipo 👥
            {pendingRequestsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.2 rounded-full animate-pulse">
                {pendingRequestsCount}
              </span>
            )}
          </button>
        </div>
      )}

      {/* VISTA 1: GESTIÓN DE EQUIPO */}
      {isAdmin && adminTab === "cobradores" ? (
        <div className="w-full max-w-md space-y-4">
          {pendingRequestsCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <h3 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                🔔 Solicitudes por Verificar ({pendingRequestsCount})
              </h3>
              <p className="text-xs text-amber-700">
                Estos usuarios no pueden ingresar hasta que los apruebes.
              </p>

              <div className="space-y-2">
                {collectors
                  .filter((c) => c.status === "pending")
                  .map((c) => (
                    <div
                      key={c.id}
                      className="bg-white p-3 rounded-xl border border-amber-200 flex justify-between items-center shadow-sm"
                    >
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">{c.full_name}</h4>
                        <p className="text-xs text-blue-600 font-semibold">@{c.username}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleApproveCollector(c.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                        >
                          Aprobar ✓
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCollector(c.id, c.username)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-2 py-1.5 rounded-lg border border-red-200 transition"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-base">Cuentas Registradas</h3>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                {collectors.filter((c) => c.status === "approved").length} activas
              </span>
            </div>

            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {collectors
                .filter((c) => c.status === "approved")
                .map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center"
                  >
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{c.full_name}</h4>
                      <p className="text-xs text-blue-600 font-semibold">@{c.username}</p>
                      <span className="text-[10px] text-slate-400">
                        {c.role === "admin" ? "Administrador" : "Cobrador"} •{" "}
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase ${
                          c.role === "admin"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {c.role}
                      </span>
                      {c.role !== "admin" && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCollector(c.id, c.username)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-2 py-1 rounded-lg border border-red-200 transition"
                          title="Eliminar cobrador"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : isAdmin && adminTab === "auditoria" ? (
        /* VISTA 2: AUDITORÍA FINANCIERA CON BÚSQUEDA GLOBAL UNIFICADA */
        <div className="w-full max-w-md space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                Capital Prestado Activo
              </span>
              <span className="text-xl font-bold text-slate-800">
                ${totalCapitalLent.toFixed(2)}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                Interés Proyectado
              </span>
              <span className="text-xl font-bold text-emerald-600">
                +${totalInterestExpected.toFixed(2)}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                Total Recaudado Histórico
              </span>
              <span className="text-xl font-bold text-blue-600">
                ${totalCollectedAllTime.toFixed(2)}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                Saldo en Calle
              </span>
              <span className="text-xl font-bold text-amber-600">
                ${totalOutstandingBalance.toFixed(2)}
              </span>
            </div>
          </div>

          {/* BARRA DE BÚSQUEDA UNIFICADA PARA TODO EL PANEL DE AUDITORÍA */}
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Buscar cliente en Auditoría (cobros, no abonos, eliminados)..."
              value={auditSearchTerm}
              onChange={(e) => setAuditSearchTerm(e.target.value)}
              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-sm"
            />
            {auditSearchTerm && (
              <button
                type="button"
                onClick={() => setAuditSearchTerm("")}
                className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold bg-slate-100 rounded-full w-5 h-5 flex items-center justify-center transition"
              >
                ✕
              </button>
            )}
          </div>

          {/* 1. SECCIÓN DE NO ABONOS / JUSTIFICACIONES (FILTRADA) */}
          <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-amber-900 text-sm flex items-center gap-1.5">
                ⚠️ Clientes que No Abonaron
              </h3>
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                {filteredNonPayments.length} registros
              </span>
            </div>

            {filteredNonPayments.length === 0 ? (
              <p className="text-xs text-slate-400">
                {auditSearchTerm ? "No hay registros de no abono con ese nombre." : "No hay registros de no abono aún."}
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {filteredNonPayments.map((np) => (
                  <div
                    key={np.id}
                    className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs space-y-1"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-800 text-sm">
                        {np.client_name}
                      </span>
                      <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                        Sin Abono
                      </span>
                    </div>
                    <p className="text-slate-700 text-xs font-medium bg-white/70 p-2 rounded-lg border border-amber-100">
                      💬 Motivo: "{np.reason}"
                    </p>
                    <div className="text-[10px] text-slate-400 flex justify-between pt-0.5">
                      <span>Registrado por: @{np.collector_username || "cobrador"}</span>
                      <span>{new Date(np.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. SECCIÓN DE PRÉSTAMOS ELIMINADOS (FILTRADA) */}
          <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-red-900 text-sm flex items-center gap-1.5">
                🚨 Registro de Préstamos Eliminados
              </h3>
              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-bold">
                {filteredAuditLogs.length} registros
              </span>
            </div>

            {filteredAuditLogs.length === 0 ? (
              <p className="text-xs text-slate-400">
                {auditSearchTerm ? "No hay préstamos eliminados con ese nombre." : "No hay préstamos eliminados aún."}
              </p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {filteredAuditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 bg-red-50/80 rounded-xl border border-red-200 text-xs space-y-1"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-red-800 text-sm">
                        {log.client_name}
                      </span>
                      <span className="text-[10px] bg-red-200/80 text-red-900 font-extrabold px-2 py-0.5 rounded-full">
                        Eliminado
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px]">{log.details}</p>
                    <div className="text-[10px] text-red-700 font-semibold pt-1 border-t border-red-200/60 flex justify-between">
                      <span>Fecha y hora de baja:</span>
                      <span>
                        {new Date(log.created_at).toLocaleDateString()} a las{" "}
                        {new Date(log.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. HISTORIAL COMPLETO DE COBROS (FILTRADO) */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">
                Historial de Transacciones
              </h3>
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                {filteredPaymentsHistory.length} cobros
              </span>
            </div>

            {filteredPaymentsHistory.length === 0 ? (
              <p className="text-xs text-slate-400">
                {auditSearchTerm ? "No se encontraron transacciones con ese nombre." : "No hay cobros registrados aún."}
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2.5 pr-1 text-xs">
                {filteredPaymentsHistory.map((p) => {
                  const isDeleted = !p.loan_id || p.loan_deleted_at;

                  return (
                    <div
                      key={p.id}
                      className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-start"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 text-sm">
                            {p.client_name || "Cliente histórico"}
                          </span>
                          {isDeleted && (
                            <span className="text-[9px] bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded">
                              Préstamo Eliminado
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          Cobrado: {new Date(p.payment_date).toLocaleString()}
                        </span>
                      </div>
                      <span className="font-bold text-emerald-600 text-sm">
                        +${Number(p.amount).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VISTA 3: MODO OPERATIVO DE COBRANZA */
        <>
          {/* CAJA DIARIA */}
          <div className="w-full max-w-md bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-5 shadow-md flex justify-between items-center">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold block">
                Caja Recaudada Hoy
              </span>
              <span className="text-2xl font-black text-emerald-400">
                ${todayCollectedTotal.toFixed(2)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 block font-semibold">Cobros hoy</span>
              <span className="text-lg font-bold text-white bg-slate-700/60 px-2.5 py-0.5 rounded-lg inline-block">
                {todayPayments.length} pagos
              </span>
            </div>
          </div>

          {/* FORMULARIO DE NUEVO PRÉSTAMO */}
          <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h1 className="text-xl font-bold text-slate-800 mb-1">Nuevo Préstamo</h1>
            <p className="text-sm text-slate-500 mb-5">Calcula y genera un préstamo al instante</p>

            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                  Nombre del Cliente
                </label>
                <input
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                  Monto a Prestar ($)
                </label>
                <input
                  type="number"
                  placeholder="0"
                  value={principal}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPrincipal(val === "" ? "" : Number(val));
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Interés (%)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={interestRate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setInterestRate(val === "" ? "" : Number(val));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                    Plazo (Días)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={days}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDays(val === "" ? "" : Number(val));
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-4 space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Ganancia (Interés):</span>
                  <span className="font-semibold text-slate-800">${interestAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Total a Devolver:</span>
                  <span className="font-semibold text-slate-800">${totalAmount.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-700">Cuota Diaria:</span>
                  <span className="text-lg font-extrabold text-blue-600">
                    ${dailyPayment} / día
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateLoan}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition duration-150 shadow-sm mt-4 disabled:opacity-50"
              >
                {loading ? "Guardando..." : "Crear Préstamo"}
              </button>
            </form>
          </div>

          {/* RUTA DE COBRO */}
          <div className="w-full max-w-md space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Ruta de Cobro</h2>

              <div className="flex bg-slate-200 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setFilter("active")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    filter === "active" ? "bg-white text-slate-800 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Activos
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("completed")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    filter === "completed" ? "bg-white text-slate-800 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Completados
                </button>
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    filter === "all" ? "bg-white text-slate-800 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Todos
                </button>
              </div>
            </div>

            {/* BUSCADOR EN RUTA */}
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Buscar cliente por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold bg-slate-100 hover:bg-slate-200 rounded-full w-5 h-5 flex items-center justify-center transition"
                >
                  ✕
                </button>
              )}
            </div>

            {/* TARJETAS DE PRÉSTAMOS */}
            {filteredLoans.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
                No se encontraron préstamos.
              </div>
            ) : (
              filteredLoans.map((loan) => {
                const totalPaid = loan.payments?.reduce((acc, p) => acc + Number(p.amount), 0) || 0;
                const balance = Math.max(0, loan.total_amount - totalPaid);
                const isCompleted = balance <= 0;
                const paymentsCount = loan.payments?.length || 0;

                const hasPaidToday = loan.payments?.some(
                  (p) => p.payment_date && p.payment_date.startsWith(todayDateString)
                );

                return (
                  <div
                    key={loan.id}
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-800 text-base">{loan.client_name}</h3>
                          {hasPaidToday && (
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                              Pagó hoy ✓
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">
                          Total: ${loan.total_amount} ({paymentsCount} pagos realizados)
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-500 block">Saldo restante</span>
                        <span
                          className={`text-base font-extrabold ${
                            isCompleted ? "text-green-600" : "text-slate-800"
                          }`}
                        >
                          ${balance.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Barra de progreso */}
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, (totalPaid / loan.total_amount) * 100)}%` }}
                      />
                    </div>

                    {/* BOTONES DE ACCIÓN: CUOTA | ABONO | NO ABONÓ */}
                    <div className="flex flex-wrap gap-2 pt-1">
                      {!isCompleted ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCollectPayment(loan, loan.daily_payment)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold py-2.5 px-3 rounded-lg transition"
                          >
                            Cuota ${loan.daily_payment}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedLoan(loan);
                              setCustomAmount("");
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 px-3 rounded-lg border border-slate-300 transition"
                          >
                            Abono
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setNoPayLoan(loan);
                              setNoPayReason("");
                            }}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-semibold py-2.5 px-3 rounded-lg border border-amber-300 transition"
                            title="Registrar que no abonó hoy"
                          >
                            No Abonó
                          </button>
                        </>
                      ) : (
                        <div className="flex-1 bg-green-50 text-green-700 text-xs font-bold py-2 text-center rounded-lg border border-green-200">
                          Préstamo Liquidado 🎉
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          sendWhatsAppReceipt(
                            loan,
                            loan.payments?.[loan.payments.length - 1]?.amount || loan.daily_payment,
                            balance,
                            totalPaid
                          )
                        }
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2.5 px-3 rounded-lg transition border border-slate-300"
                      >
                        WhatsApp
                      </button>

                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLoan(loan)}
                          className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-2.5 rounded-lg border border-red-200 transition"
                          title="Eliminar préstamo"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* MODAL 1: REGISTRAR ABONO PARCIAL */}
      {selectedLoan && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <h3 className="font-bold text-slate-800 text-lg">
              Registrar Abono: {selectedLoan.client_name}
            </h3>
            <p className="text-xs text-slate-500">
              Ingresa cualquier monto abonado por el cliente hoy.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                Monto a recibir ($)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="Ej: 3.50"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSelectedLoan(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleCollectPayment(selectedLoan, Number(customAmount))}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-lg transition"
              >
                Confirmar Abono
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: REGISTRAR MOTIVO DE NO ABONO */}
      {noPayLoan && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <div>
                <h3 className="font-bold text-slate-800 text-base">
                  No Abonó: {noPayLoan.client_name}
                </h3>
                <p className="text-xs text-slate-500">
                  Registra la justificación para auditoría
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1 uppercase tracking-wider">
                Motivo / Justificación
              </label>
              <textarea
                rows={3}
                placeholder="Ej: No estaba en el negocio, pidió prórroga para mañana a las 3pm, o no tuvo venta."
                value={noPayReason}
                onChange={(e) => setNoPayReason(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                autoFocus
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setNoPayLoan(null);
                  setNoPayReason("");
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-lg transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRegisterNoPay}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2.5 rounded-lg transition"
              >
                Guardar Novedad
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}