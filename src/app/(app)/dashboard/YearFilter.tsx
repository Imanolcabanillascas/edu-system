"use client";
import { useRouter } from "next/navigation";

interface YearFilterProps {
  anos: number[];
  anoActual: number | null;
}

// Filtro liviano: solo cambia el query param ?ano=YYYY y deja que el Server Component
// vuelva a consultar — no hay estado de cliente ni fetch adicional aquí.
export default function YearFilter({ anos, anoActual }: YearFilterProps) {
  const router = useRouter();

  if (anos.length === 0) return null;

  return (
    <div className="toolbar" style={{ marginBottom: 24 }}>
      <div style={{ flex: 1 }} />
      <select
        className="year-filter"
        value={anoActual ?? "todos"}
        onChange={(e) => {
          const value = e.target.value;
          router.push(value === "todos" ? "/dashboard" : `/dashboard?ano=${value}`);
        }}
      >
        <option value="todos">Todos los años</option>
        {anos.map((a) => <option key={a} value={a}>Año {a}</option>)}
      </select>
    </div>
  );
}
