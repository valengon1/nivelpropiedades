import type { Solicitud, FichaPersona } from "@/types/solicitud";
import { ESTADO_CIVIL_LABELS } from "@/types/solicitud";
import { formatFecha } from "./solicitudes";

// ── Utilidades ────────────────────────────────────────────────

async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function getEstadoCivilLabel(ec: string): string {
  return ESTADO_CIVIL_LABELS[ec as keyof typeof ESTADO_CIVIL_LABELS] || ec || "-";
}

function val(v: string | null | undefined): string {
  return v?.trim() || "-";
}

// ── PDF Generator ─────────────────────────────────────────────

export async function generateSolicitudPdf(
  solicitud: Solicitud,
  fichas: FichaPersona[]
): Promise<Blob> {
  const { default: jsPDF } = await import("jspdf");

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageW = 210;
  const pageH = 297;
  const margin = 20;
  const contentW = pageW - margin * 2;

  // Paleta de colores
  const NEGRO = [10, 10, 10] as const;
  const GRIS_CLARO = [200, 200, 200] as const;
  const GRIS_TEXTO = [100, 100, 100] as const;
  const VERDE = [34, 197, 94] as const;

  // ─── Función helpers ──────────────────────────────────────────
  function setFont(size: number, style: "normal" | "bold" = "normal") {
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
  }

  function drawHRule(y: number, color = GRIS_CLARO) {
    doc.setDrawColor(...color);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
  }

  function sectionHeader(y: number, title: string): number {
    doc.setFillColor(245, 245, 244);
    doc.rect(margin, y, contentW, 7, "F");
    doc.setTextColor(...NEGRO);
    setFont(7, "bold");
    doc.text(title.toUpperCase(), margin + 3, y + 4.8);
    return y + 9;
  }

  function dataRow(y: number, label: string, value: string, col2 = false): number {
    const x1 = col2 ? margin + contentW / 2 + 2 : margin;
    const xLabel = x1;
    const xValue = x1 + 38;
    doc.setTextColor(...GRIS_TEXTO);
    setFont(7.5, "bold");
    doc.text(label, xLabel, y);
    doc.setTextColor(...NEGRO);
    setFont(8.5, "normal");
    const lines = doc.splitTextToSize(value, col2 ? contentW / 2 - 42 : contentW - 42);
    doc.text(lines, xValue, y);
    return y + Math.max(lines.length * 4.5, 5.5);
  }

  function dataGrid(y: number, pairs: Array<[string, string]>): number {
    let maxY = y;
    for (let i = 0; i < pairs.length; i += 2) {
      const leftY = dataRow(y, pairs[i][0], pairs[i][1], false);
      let rightY = y;
      if (pairs[i + 1]) {
        rightY = dataRow(y, pairs[i + 1][0], pairs[i + 1][1], true);
      }
      y = Math.max(leftY, rightY);
      maxY = y;
    }
    return maxY;
  }

  function checkPageBreak(y: number, needed = 40): number {
    if (y + needed > pageH - margin) {
      doc.addPage();
      return margin + 5;
    }
    return y;
  }

  // ─── PORTADA ──────────────────────────────────────────────────
  // Logo
  const logoUrl = "/logo-header.png";
  const logoData = await fetchImageAsDataUrl(logoUrl);
  if (logoData) {
    doc.addImage(logoData, "PNG", margin, margin, 45, 15);
  } else {
    setFont(14, "bold");
    doc.setTextColor(...NEGRO);
    doc.text("NIVEL PROPIEDADES", margin, margin + 10);
  }

  // Línea decorativa
  doc.setFillColor(...NEGRO);
  doc.rect(margin, margin + 20, contentW, 0.8, "F");

  // Título principal
  doc.setTextColor(...NEGRO);
  setFont(22, "bold");
  doc.text("SOLICITUD DE DATOS PERSONALES", margin, margin + 38);


  // Información de la solicitud
  let y = margin + 62;

  doc.setFillColor(248, 248, 247);
  doc.rect(margin, y, contentW, 36, "F");
  doc.setDrawColor(...GRIS_CLARO);
  doc.rect(margin, y, contentW, 36, "S");

  y += 8;
  setFont(7.5, "bold");
  doc.setTextColor(...GRIS_TEXTO);
  doc.text("PROPIEDAD", margin + 6, y);
  setFont(11, "bold");
  doc.setTextColor(...NEGRO);
  doc.text(solicitud.direccion, margin + 6, y + 6);

  setFont(7.5, "normal");
  doc.setTextColor(...GRIS_TEXTO);
  doc.text(`Fecha de solicitud: ${formatFecha(solicitud.created_at)}`, margin + 6, y + 14);
  if (solicitud.fecha_completada) {
    doc.text(
      `Fecha de completado: ${formatFecha(solicitud.fecha_completada)}`,
      margin + 6,
      y + 19
    );
  }
  doc.text(
    `Cantidad de personas: ${solicitud.cantidad_personas}`,
    margin + 6,
    y + 24
  );

  y += 42;

  // Índice de personas
  setFont(8, "bold");
  doc.setTextColor(...NEGRO);
  doc.text("PERSONAS INCLUIDAS EN ESTA SOLICITUD:", margin, y);
  y += 6;

  fichas.forEach((f, i) => {
    setFont(8, "normal");
    doc.setTextColor(...GRIS_TEXTO);
    const nombre = `${f.nombre} ${f.apellido}`.trim() || `Persona ${i + 1}`;
    doc.text(`${i + 1}. ${nombre} — DNI ${val(f.dni)}`, margin + 3, y);
    y += 5;
  });

  // Footer portada
  y = pageH - margin - 15;
  drawHRule(y);
  y += 5;
  setFont(7, "normal");
  doc.setTextColor(...GRIS_TEXTO);
  doc.text(
    "Nivel Propiedades · Documento generado automáticamente · Para uso exclusivo de la inmobiliaria",
    pageW / 2,
    y,
    { align: "center" }
  );

  // ─── FICHAS POR PERSONA ───────────────────────────────────────
  for (let p = 0; p < fichas.length; p++) {
    const ficha = fichas[p];
    const personaNum = p + 1;

    doc.addPage();
    y = margin;

    // Cabecera persona
    doc.setFillColor(...NEGRO);
    doc.rect(0, 0, pageW, 14, "F");
    setFont(9, "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(
      `PERSONA ${personaNum} DE ${solicitud.cantidad_personas}  ·  ${solicitud.direccion}`,
      pageW / 2,
      9,
      { align: "center" }
    );
    y = 22;

    const nombre = `${ficha.nombre} ${ficha.apellido}`.trim();
    setFont(14, "bold");
    doc.setTextColor(...NEGRO);
    doc.text(nombre || `Persona ${personaNum}`, margin, y);
    y += 4;
    drawHRule(y);
    y += 6;

    // ── Datos personales ─────────────────────────
    y = sectionHeader(y, "Datos Personales");
    y = dataGrid(y + 2, [
      ["Nombre", val(ficha.nombre)],
      ["Apellido", val(ficha.apellido)],
      ["DNI", val(ficha.dni)],
      ["CUIT/CUIL", val(ficha.cuit_cuil)],
      ["Fecha de nacimiento", formatFecha(ficha.fecha_nacimiento)],
      ["Lugar de nacimiento", val(ficha.lugar_nacimiento)],
      ["Nacionalidad", val(ficha.nacionalidad)],
      ["Profesión", val(ficha.profesion)],
    ]);
    y = dataGrid(y, [
      ["Estado civil", getEstadoCivilLabel(ficha.estado_civil)],
      [
        ficha.estado_civil === "casado" || ficha.estado_civil === "union_convivencial"
          ? "Cónyuge"
          : "",
        ficha.nombre_conyuge
          ? `${ficha.nombre_conyuge} ${ficha.apellido_conyuge}`.trim()
          : "-",
      ],
    ]);
    y += 4;

    // ── Domicilio ────────────────────────────────
    y = checkPageBreak(y, 45);
    y = sectionHeader(y, "Domicilio Particular");
    const domicilio = [
      ficha.dom_calle,
      ficha.dom_numero,
      ficha.dom_piso && `Piso ${ficha.dom_piso}`,
      ficha.dom_depto && `Dpto. ${ficha.dom_depto}`,
    ]
      .filter(Boolean)
      .join(", ");
    const domicilioCompleto = `${domicilio} · ${val(ficha.dom_localidad)}, ${val(ficha.dom_provincia)} (${val(ficha.dom_cp)})`;

    y = dataGrid(y + 2, [
      ["Dirección", domicilioCompleto],
      ["", ""],
      ["Teléfono particular", val(ficha.telefono_particular)],
      ["Celular", val(ficha.celular)],
      ["Email", val(ficha.email)],
      ["", ""],
    ]);
    y += 4;

    // ── Datos laborales ──────────────────────────
    y = checkPageBreak(y, 35);
    y = sectionHeader(y, "Datos Laborales");
    y += 2;
    setFont(8.5, "normal");
    doc.setTextColor(...NEGRO);
    doc.text(
      ficha.trabaja === null ? "-" : ficha.trabaja ? "Trabaja actualmente: Sí" : "Trabaja actualmente: No",
      margin,
      y
    );
    y += 5;
    if (ficha.trabaja) {
      y = dataGrid(y, [
        ["Empresa / Empleador", val(ficha.empresa)],
        ["Cargo", val(ficha.cargo)],
        ["Domicilio laboral", val(ficha.dom_laboral)],
        ["Teléfono laboral", val(ficha.tel_laboral)],
      ]);
    }
    y += 4;

    // ── Situación habitacional ───────────────────
    y = checkPageBreak(y, 35);
    y = sectionHeader(y, "Situación Habitacional");
    y += 2;
    doc.setTextColor(...NEGRO);
    setFont(8.5, "normal");
    doc.text(
      ficha.alquila === null ? "-" : ficha.alquila ? "¿Alquila actualmente?: Sí" : "¿Alquila actualmente?: No",
      margin,
      y
    );
    y += 5;
    if (ficha.alquila) {
      const mediaante =
        ficha.alquila_mediante === "inmobiliaria"
          ? `Inmobiliaria: ${val(ficha.nombre_inmobiliaria)}`
          : `Propietario particular: ${val(ficha.nombre_propietario)}`;
      setFont(8.5, "normal");
      doc.setTextColor(...NEGRO);
      doc.text(`Alquila mediante: ${mediaante}`, margin, y);
      y += 5;
    }
    y += 4;

    // ── Documentación DNI ────────────────────────
    y = checkPageBreak(y, 80);
    y = sectionHeader(y, "Documentación — DNI");
    y += 4;

    const dniImages = await Promise.all([
      ficha.dni_frente_url ? fetchImageAsDataUrl(ficha.dni_frente_url) : null,
      ficha.dni_dorso_url ? fetchImageAsDataUrl(ficha.dni_dorso_url) : null,
    ]);

    const [frenteData, dorsoData] = dniImages;
    const imgW = (contentW - 6) / 2;
    const imgH = imgW * 0.63; // relación de aspecto DNI ~1.58:1

    // Labels
    setFont(7.5, "bold");
    doc.setTextColor(...GRIS_TEXTO);
    doc.text("DNI FRENTE", margin, y);
    doc.text("DNI DORSO", margin + imgW + 6, y);
    y += 4;

    y = checkPageBreak(y, imgH + 5);

    if (frenteData) {
      doc.addImage(frenteData, "JPEG", margin, y, imgW, imgH);
      doc.setDrawColor(...GRIS_CLARO);
      doc.rect(margin, y, imgW, imgH, "S");
    } else {
      doc.setFillColor(245, 245, 244);
      doc.rect(margin, y, imgW, imgH, "F");
      doc.setTextColor(...GRIS_TEXTO);
      setFont(8, "normal");
      doc.text("Sin imagen", margin + imgW / 2, y + imgH / 2, { align: "center" });
    }

    if (dorsoData) {
      doc.addImage(dorsoData, "JPEG", margin + imgW + 6, y, imgW, imgH);
      doc.setDrawColor(...GRIS_CLARO);
      doc.rect(margin + imgW + 6, y, imgW, imgH, "S");
    } else {
      doc.setFillColor(245, 245, 244);
      doc.rect(margin + imgW + 6, y, imgW, imgH, "F");
      doc.setTextColor(...GRIS_TEXTO);
      setFont(8, "normal");
      doc.text("Sin imagen", margin + imgW + 6 + imgW / 2, y + imgH / 2, { align: "center" });
    }

    y += imgH + 6;

    // Footer por página
    const fY = pageH - margin - 5;
    drawHRule(fY - 3);
    setFont(6.5, "normal");
    doc.setTextColor(...GRIS_TEXTO);
    doc.text(
      `Nivel Propiedades  ·  Persona ${personaNum} de ${solicitud.cantidad_personas}`,
      pageW / 2,
      fY,
      { align: "center" }
    );
  }

  return doc.output("blob");
}
