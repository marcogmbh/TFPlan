document.addEventListener("DOMContentLoaded", () => {
  
  document.body.classList.remove("preload");
  document.body.classList.add("loaded");
 
  const params = new URLSearchParams(window.location.search);
  const klasse = params.get("klasse");
  const classNameEl = document.getElementById("class-name");
  classNameEl.textContent = klasse || "Unbekannt";

  const dayOrder = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

  // WICHTIG: Variablen im DOMContentLoaded-Scope deklarieren
  let currentDay = 0; 
  let currentEnlargedSubject = null; // MUSS HIER DEKLARIERT SEIN!

  // Basis-Raster: 30 Minuten
  const BASE_SLOT_MINUTES = 30;
  const BASE_SLOT_HEIGHT_PX = 30; // Beibehalten, falls nicht anders gewünscht
  const COLUMN_GAP_PX = 14;

  function formatTimeFromMinutes(totalMinutes) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  function parseRange(range) {
    const [start, end] = range.split("-");
    const [sh, sm] = start.split(":").map(n => parseInt(n, 10));
    const [eh, em] = end.split(":").map(n => parseInt(n, 10));
    return { sh, sm, eh, em };
  }
  
  function updateDayView() {
    const dayTabs = document.querySelectorAll(".day-tabs button");
    const dayColumns = document.querySelectorAll(".day-column");

    dayColumns.forEach((col, idx) => {
      const isActive = idx === currentDay; 
      col.classList.toggle("active", isActive);
    });
    dayTabs.forEach((btn, idx) => {
      btn.classList.toggle("active", idx === currentDay);
    });
  }

  async function ladeStundenplan() {
    try {
      const res = await fetch("../JSON/data-times.json");
      if (!res.ok) throw new Error(`fetch fehlgeschlagen: ${res.status}`);
      const data = await res.json();

      const plan = data?.stundenplan?.[klasse];
      const subjectsContainer = document.querySelector(".subjects");
      const timesContainer = document.querySelector(".times");
      
      // ... (Code zur Berechnung der Zeiten und Erstellung der Zeitleiste bleibt unverändert) ...

      // --- Zeitleisten-Berechnung übersprungen zur Übersicht ---

      // Früheste / späteste Zeit bestimmen
      let earliest = Infinity;
      let latest = -Infinity;
      let specialLines = new Set();
      dayOrder.forEach(day => {
        (plan[day] || []).forEach(entry => {
          const { sh, sm, eh, em } = parseRange(entry.stunde);
          const s = sh * 60 + sm;
          const e = eh * 60 + em;
          if (s < earliest) earliest = s;
          if (e > latest) latest = e;
          specialLines.add(s);
          specialLines.add(e);
        });
      });
      if (!isFinite(earliest) || !isFinite(latest)) {
        earliest = 7 * 60;
        latest = 18 * 60;
      }
      const startMinuteBase = Math.floor(earliest / BASE_SLOT_MINUTES) * BASE_SLOT_MINUTES;
      const endMinuteRounded = Math.ceil(latest / BASE_SLOT_MINUTES) * BASE_SLOT_MINUTES;
      const totalMinutes = endMinuteRounded - startMinuteBase;
      const pixelsPerMinute = BASE_SLOT_HEIGHT_PX / BASE_SLOT_MINUTES;
      const containerHeightPx = totalMinutes * pixelsPerMinute;
      
      // Zeitleiste erstellen (Times)
      timesContainer.innerHTML = "";
      timesContainer.style.position = "relative";
      timesContainer.style.height = `${containerHeightPx}px`;
      timesContainer.style.padding = "0 8px";
      timesContainer.style.boxSizing = "border-box";
      // Standard-Linien alle 30 Min
      for (let t = startMinuteBase; t <= endMinuteRounded; t += BASE_SLOT_MINUTES) {
        const topPx = (t - startMinuteBase) * pixelsPerMinute;
        const label = document.createElement("div");
        label.className = "time";
        label.textContent = formatTimeFromMinutes(t);
        label.style.position = "absolute";
        label.style.left = "0";
        label.style.top = `${topPx.toFixed(2)}px`;
        label.style.width = "100%";
        label.style.borderTop = "1px dashed #eee";
        timesContainer.appendChild(label);
      }
      // Extra-Linien für JSON-Zeiten
      specialLines.forEach(minute => {
        if (minute < startMinuteBase || minute > endMinuteRounded) return;
        const topPx = (minute - startMinuteBase) * pixelsPerMinute;
        const line = document.createElement("div");
        line.className = "time special-line";
        line.textContent = formatTimeFromMinutes(minute);
        line.style.position = "absolute";
        line.style.left = "0";
        line.style.top = `${topPx.toFixed(2)}px`;
        line.style.width = "100%";
        line.style.borderTop = "1px solid #999"; 
        line.style.color = "#000"; 
        timesContainer.appendChild(line);
      });


      // Tages-Spalten (Subjects)
      subjectsContainer.innerHTML = "";
      subjectsContainer.style.display = "flex";
      subjectsContainer.style.gap = `${COLUMN_GAP_PX}px`;
      subjectsContainer.style.alignItems = "flex-start";
      subjectsContainer.style.height = `${containerHeightPx}px`;
      subjectsContainer.style.boxSizing = "border-box";

      dayOrder.forEach(tag => {
        const col = document.createElement("div");
        col.className = "day-column";
        col.style.flex = "1 1 0";
        col.style.position = "relative";
        col.style.minWidth = "150px";
        col.style.height = `${containerHeightPx}px`;
        subjectsContainer.appendChild(col);

        (plan[tag] || []).forEach(entry => {
          const { sh, sm, eh, em } = parseRange(entry.stunde);
          const startMinutes = sh * 60 + sm;
          const endMinutes = eh * 60 + em;

          if (endMinutes <= startMinuteBase || startMinutes >= endMinuteRounded) return;

          const top = (startMinutes - startMinuteBase) * pixelsPerMinute;
          const height = Math.max(18, (endMinutes - startMinutes) * pixelsPerMinute);

          const box = document.createElement("div");
          box.className = "subject";
          box.style.position = "absolute";
          box.style.left = "50%";
          box.style.transform = "translateX(-50%)";
          box.style.width = "calc(100% - 12px)";
          box.style.top = `${top.toFixed(2)}px`;
          box.style.height = `${height.toFixed(2)}px`;
          box.style.boxSizing = "border-box";
          box.innerHTML = `
            <div class="subject-title">${entry.fach}</div>
            <div class="subject-time">${entry.stunde}</div>
            <div class="subject-room">${entry.raum}</div>
            <div class="subject-teacher">${entry.lehrer}</div>
          `;
          col.appendChild(box);
          
          // <--- START DES KORRIGIERTEN KLICK-HANDLERS --->
          box.addEventListener("click", () => {
            const isClickedBoxEnlarged = box.classList.contains('enlarged');

            // 1. Minimiere das zuvor vergrösserte Fach.
            if (currentEnlargedSubject && currentEnlargedSubject !== box) {
                currentEnlargedSubject.classList.remove('enlarged');
            }
            
            // 2. Schalte den vergrösserten Zustand für die geklickte Box um
            box.classList.toggle('enlarged');

            // 3. Verfolge den neuen Zustand
            if (!isClickedBoxEnlarged) {
                currentEnlargedSubject = box;
                // Scrollt das Fach in die Mitte der Ansicht (wichtig für Mobile)
                box.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                currentEnlargedSubject = null;
            }
          });
          // <--- ENDE DES KORRIGIERTEN KLICK-HANDLERS --->

        });
      });
      
      // FIX: Mobile Ansicht initialisieren, nachdem die Spalten im DOM sind
      updateDayView(); 

    } catch (err) {
      console.error(err);
      const subjectsContainer = document.querySelector(".subjects");
      if (subjectsContainer) {
        subjectsContainer.innerHTML = `<p>Fehler beim Laden der Daten. Überprüfe den Server oder die data-times.json Datei. Fehlermeldung: ${err.message}</p>`;
      }
    }
  }
  
  // Die Funktionen/Variablen müssen vor dem Aufruf von ladeStundenplan() deklariert sein.
  ladeStundenplan(); 

  // Klick-Handler für die Mobile Tabs
  document.querySelectorAll(".day-tabs button").forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      currentDay = idx;
      updateDayView();
    });
  });

  // Swipe-Logik für Handy
  let touchStartX = 0;
  document.addEventListener("touchstart", e => {
    touchStartX = e.touches[0].clientX;
  });
  document.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx > 50 && currentDay > 0) {
      currentDay--;
    } else if (dx < -50 && currentDay < 4) {
      currentDay++;
    }
    updateDayView();
  });
});