document.addEventListener("DOMContentLoaded", () => {
  
  // 1. SETUP & INITIALISIERUNG
  document.body.classList.remove("preload");
  document.body.classList.add("loaded");

  const params = new URLSearchParams(window.location.search);
  const klasse = params.get("klasse");
  const classNameEl = document.getElementById("class-name");

  // Versuche, Klasse aus LocalStorage zu laden, falls nicht in URL
  let activeClass = klasse;
  if (!activeClass) {
      activeClass = localStorage.getItem("gespeicherteKlasse");
  }
  // Wenn vorhanden, speichern für nächsten Besuch
  if (activeClass) {
      localStorage.setItem("gespeicherteKlasse", activeClass);
      classNameEl.textContent = activeClass;
  } else {
      classNameEl.textContent = "Unbekannt";
  }

  // Globale Variablen
  let globalData = null;
  let currentWeekStart = getMonday(new Date()); // Startet mit aktuellem Montag
  let currentEnlargedSubject = null;
  
  // ===============================================
  // NEU: INIT DAY LOGIC & TODAY GLOBALS
  // ===============================================

  let now = new Date();
  let dayOfWeek = now.getDay(); // 0=So, 1=Mo, ..., 5=Fr, 6=Sa
  let hours = now.getHours();
  
  // 0 = Montag. Wenn es ein Schultag ist, initialisiere mit dem Tag.
  let initialDayIndex = dayOfWeek - 1; 

  let currentDay = 0; // Standard-Starttag (Montag)

  // Wenn heute ein Wochentag (1-5) ist:
  if (initialDayIndex >= 0 && initialDayIndex <= 4) {
      currentDay = initialDayIndex;
      
      // Zusätzliche Logik: Wenn es Freitag nach 17 Uhr ist, springe zu Montag (0)
      if (initialDayIndex === 4 && hours >= 17) {
          currentDay = 0; 
      }
  }
  
  // Wichtig: Heute-Datum als ISO String speichern für den Vergleich in renderTimetable()
  const todayIso = formatIsoDate(now); 
  function formatIsoDate(date) {
    // Gibt das Datum im Format YYYY-MM-DD zurück (für exakten Vergleich)
    return date.toISOString().split('T')[0];
  }
  // ===============================================

  const dayOrder = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];
  const BASE_SLOT_MINUTES = 30;
  const BASE_SLOT_HEIGHT_PX = 30; 

  // ============================================================
  // 2. HELPER FUNKTIONEN
  // ============================================================
  
  function getMonday(d) {
    d = new Date(d);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    return new Date(d.setDate(diff));
  }

  function formatDateShort(date) {
    // Gibt z.B. "24.11." zurück
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  }
  
  function formatIsoDate(date) {
    // Gibt "2025-11-24" zurück (für JSON Vergleich)
    return date.toISOString().split('T')[0];
  }

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

  function generateSubjectClass(subjectName) {
    if (!subjectName) return 'fach-default';
    return 'fach-' + subjectName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  // ============================================================
  // 3. WOCHEN-NAVIGATION LOGIK
  // ============================================================

  // Buttons events
  const prevBtn = document.getElementById("prev-week");
  const nextBtn = document.getElementById("next-week");

  if (prevBtn && nextBtn) {
    prevBtn.addEventListener("click", () => changeWeek(-7));
    nextBtn.addEventListener("click", () => changeWeek(7));
  }

  function changeWeek(days) {
    currentWeekStart.setDate(currentWeekStart.getDate() + days);
    renderTimetable();
  }

  // Echtzeit-Datum im Header aktualisieren
  function updateHeaderDate() {
    const dateEl = document.getElementById("current-date");
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('de-DE', options);
    }
  }
  updateHeaderDate();
  setInterval(updateHeaderDate, 60000);

  // ============================================================
  // 4. DATA LOADING & RENDERING
  // ============================================================

  async function ladeStundenplan() {
    try {
      const res = await fetch("../JSON/data-times.json");
      if (!res.ok) throw new Error(`fetch fehlgeschlagen: ${res.status}`);
      globalData = await res.json();
      
      renderTimetable();

    } catch (err) {
      console.error(err);
      const subjectsContainer = document.querySelector(".subjects");
      if (subjectsContainer) {
        subjectsContainer.innerHTML = `<p style="padding:20px;">Fehler beim Laden: ${err.message}</p>`;
      }
    }
  }

  function renderTimetable() {
    if (!globalData || !activeClass) return;

    const plan = globalData.stundenplan[activeClass];
    const ausnahmen = globalData.ausnahmen || {}; // Für Feiertage

    if (!plan) {
        document.querySelector(".subjects").innerHTML = "<p style='padding:20px;'>Keine Daten für diese Klasse gefunden.</p>";
        return;
    }

    // Elemente holen
    const dayColumns = document.querySelectorAll(".day-column");
    const dayHeaders = document.querySelectorAll(".days .day"); 
    const tabButtons = document.querySelectorAll(".day-tabs button"); 
    const weekRangeEl = document.getElementById("week-range");

    // 1. Wochen-Anzeige oben aktualisieren
    const friday = new Date(currentWeekStart);
    friday.setDate(friday.getDate() + 4);
    if (weekRangeEl) {
        weekRangeEl.textContent = `${formatDateShort(currentWeekStart)} - ${formatDateShort(friday)}`;
    }

    // 2. Zeitleisten-Parameter berechnen (Festgelegt auf 07:00 - 18:00 für Konsistenz)
    const startMinuteBase = 7 * 60; // 07:00 Start
    const endMinuteRounded = 18 * 60; // 18:00 Ende
    const pixelsPerMinute = BASE_SLOT_HEIGHT_PX / BASE_SLOT_MINUTES;
    const containerHeightPx = (endMinuteRounded - startMinuteBase) * pixelsPerMinute;

    // Container-Höhe setzen
    const subjectsContainer = document.querySelector(".subjects");
    const timesContainer = document.querySelector(".times");
    
    if(subjectsContainer) subjectsContainer.style.height = `${containerHeightPx}px`;
    
    // Zeitleiste neu zeichnen (Links)
    if (timesContainer) {
        timesContainer.innerHTML = "";
        timesContainer.style.height = `${containerHeightPx}px`;
        for (let t = startMinuteBase; t <= endMinuteRounded; t += BASE_SLOT_MINUTES) {
            const topPx = (t - startMinuteBase) * pixelsPerMinute;
            const label = document.createElement("div");
            label.className = "time";
            label.textContent = formatTimeFromMinutes(t);
            label.style.top = `${topPx.toFixed(2)}px`;
            label.style.borderTop = "1px dashed var(--shadow-color)"; // Variable nutzen
            timesContainer.appendChild(label);
        }
    }

    // 3. Spalten leeren & Tage rendern
    dayColumns.forEach(col => {
        col.innerHTML = "";
        col.style.height = `${containerHeightPx}px`;
    });

    dayOrder.forEach((wochentagName, index) => {
      // Datum berechnen
      const currentDate = new Date(currentWeekStart);
      currentDate.setDate(currentDate.getDate() + index);
      const dateString = formatDateShort(currentDate);
      const isoDate = formatIsoDate(currentDate); // Jetzt haben wir das ISO Datum der Spalte

      // NEU: Ist dieser Tag HEUTE?
      const isToday = isoDate === todayIso; 

      // A) Desktop Header Update (Index + 1 wegen Platzhalter)
      if(dayHeaders[index + 1]) {
        dayHeaders[index + 1].innerHTML = `${wochentagName} <br><small style="font-weight:400; opacity:0.7">${dateString}</small>`;
        
        // FIX 1: is-today Klasse setzen/entfernen (Die Rote Markierung)
        dayHeaders[index + 1].classList.remove('is-today'); // <-- MUSS HIER SEIN!
        if (isToday) {
            dayHeaders[index + 1].classList.add('is-today'); 
        }
        // active-day wird in updateDayView() behandelt, entfernen hier nur die alte Klasse
        dayHeaders[index + 1].classList.remove('active-day'); 
     }
     // ...
     // B) Mobile Tabs Update
     if(tabButtons[index]) {
       // ...
       // FIX 2: is-today Klasse setzen/entfernen (Die Rote Markierung)
       tabButtons[index].classList.remove('is-today'); // <-- MUSS HIER SEIN!
       if (isToday) {
           tabButtons[index].classList.add('is-today'); 
       }
     }

      const col = dayColumns[index];
      if (!col) return;

      // C) PRÜFUNG: Ist heute Ausnahme/Urlaub?
      if (ausnahmen[isoDate]) {
        const holidayBox = document.createElement("div");
        holidayBox.className = "subject";
        holidayBox.style.top = "20px"; 
        holidayBox.style.width = "90%";
        holidayBox.style.background = "var(--bg-alexa)"; // Rotlich
        holidayBox.style.color = "var(--text-alexa)";
        holidayBox.style.position = "relative";
        holidayBox.style.transform = "none";
        holidayBox.style.left = "0";
        holidayBox.style.margin = "0 auto";
        holidayBox.innerHTML = `<div class="subject-title">FREI</div><div>${ausnahmen[isoDate]}</div>`;
        col.appendChild(holidayBox);
        return; // Keine weiteren Fächer laden
      }

      // D) Fächer rendern
      (plan[wochentagName] || []).forEach(entry => {
          const { sh, sm, eh, em } = parseRange(entry.stunde);
          const startMinutes = sh * 60 + sm;
          const endMinutes = eh * 60 + em;

          if (endMinutes <= startMinuteBase || startMinutes >= endMinuteRounded) return;

          const top = (startMinutes - startMinuteBase) * pixelsPerMinute;
          const height = Math.max(18, (endMinutes - startMinutes) * pixelsPerMinute);

          const box = document.createElement("div");
          box.className = "subject";
          box.classList.add(generateSubjectClass(entry.fach));

          // Styling
          box.style.position = "absolute";
          box.style.top = `${top.toFixed(2)}px`;
          box.style.height = `${height.toFixed(2)}px`;
          
          box.innerHTML = `
            <div class="subject-title">${entry.fach}</div>
            <div class="subject-time">${entry.stunde}</div>
            <div class="subject-room">${entry.raum}</div>
            <div class="subject-teacher">${entry.lehrer}</div>
          `;

          // Klick Event (Vergrössern)
          box.addEventListener("click", () => {
            const isClickedBoxEnlarged = box.classList.contains('enlarged');

            if (currentEnlargedSubject && currentEnlargedSubject !== box) {
                currentEnlargedSubject.classList.remove('enlarged');
            }
            
            box.classList.toggle('enlarged');

            if (!isClickedBoxEnlarged) {
                currentEnlargedSubject = box;
                box.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
                currentEnlargedSubject = null;
            }
          });

          col.appendChild(box);
      });
    });

    updateDayView(); // Mobile Ansicht aktualisieren
  }
  
  // Starten
  ladeStundenplan(); 

  // ============================================================
  // 5. MOBILE VIEW LOGIK (Tabs & Swipe)
  // ============================================================

  function updateDayView() {
    const dayTabs = document.querySelectorAll(".day-tabs button");
    const dayColumns = document.querySelectorAll(".day-column");

    // 1. Mobile Spalte anzeigen/ausblenden
    dayColumns.forEach((col, idx) => {
      const isActive = idx === currentDay; 
      col.classList.toggle("active", isActive);
    });
    
    // 2. Mobile Tabs Selection markieren
    dayTabs.forEach((btn, idx) => {
      // Setzt die active-Klasse für die Auswahl (wird in CSS neutral/blau gestylt)
      btn.classList.toggle("active", idx === currentDay);
    });

    // 3. Desktop Header Selection markieren
    const dayHeaders = document.querySelectorAll(".days .day:not(.placeholder)");
    dayHeaders.forEach((header, index) => {
        // Entferne die alte Selection-Klasse
        header.classList.remove('active-day'); 
        
        // Selection-Klasse setzen, wenn der Tag ausgewählt wurde.
        if (index === currentDay) {
            header.classList.add('active-day'); 
        }
    });
  }

  // Tab Klicks
  document.querySelectorAll(".day-tabs button").forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      currentDay = idx;
      updateDayView();
    });
  });

  // Swipe Logik
  let touchStartX = 0;
  document.addEventListener("touchstart", e => {
    touchStartX = e.touches[0].clientX;
  });
  document.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx > 50 && currentDay > 0) { // Swipe Rechts -> Tag zurück
      currentDay--;
      updateDayView();
    } else if (dx < -50 && currentDay < 4) { // Swipe Links -> Tag vor
      currentDay++;
      updateDayView();
    }
  });

  // ============================================================
  // 6. MENÜ & DARK MODE LOGIK
  // ============================================================

  const menuBtn = document.getElementById("menu-btn");
  const dropdown = document.getElementById("dropdown-menu");
  const darkModeToggle = document.getElementById("dark-mode-toggle");

  if (menuBtn && dropdown) {
    menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("show");
    });

    document.addEventListener("click", () => {
        dropdown.classList.remove("show");
    });
  }

  // Dark Mode Init
  if (localStorage.getItem("darkMode") === "enabled") {
    document.body.classList.add("dark-mode");
    if(darkModeToggle) darkModeToggle.textContent = "☀️ Light Mode";
  }

  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        
        if (document.body.classList.contains("dark-mode")) {
        localStorage.setItem("darkMode", "enabled");
        darkModeToggle.textContent = "☀️ Light Mode";
        } else {
        localStorage.setItem("darkMode", "disabled");
        darkModeToggle.textContent = "🌙 Dark Mode";
        }
    });
  }
});