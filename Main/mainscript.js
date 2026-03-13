document.addEventListener("DOMContentLoaded", () => {
  
  // 1. SETUP & INITIALISIERUNG
  document.body.classList.remove("preload");
  document.body.classList.add("loaded");

  const params = new URLSearchParams(window.location.search);
  const klasse = params.get("klasse");
  const classNameEl = document.getElementById("class-name");

  let activeClass = klasse;
  if (!activeClass) {
      activeClass = localStorage.getItem("gespeicherteKlasse");
  }
  if (activeClass) {
      localStorage.setItem("gespeicherteKlasse", activeClass);
      classNameEl.textContent = activeClass;
  } else {
      classNameEl.textContent = "Unbekannt";
  }

  let globalData = null;
  let currentWeekStart = getMonday(new Date()); 
  let currentEnlargedSubject = null;
  
  // ===============================================
  // INIT DAY LOGIC & TODAY GLOBALS
  // ===============================================

  let now = new Date();
  let dayOfWeek = now.getDay(); 
  let hours = now.getHours();
  let initialDayIndex = dayOfWeek - 1; 
  let currentDay = 0; 

  if (initialDayIndex >= 0 && initialDayIndex <= 4) {
      currentDay = initialDayIndex;
      if (initialDayIndex === 4 && hours >= 17) {
          currentDay = 0; 
      }
  }
  
  const todayIso = formatIsoDate(now); 
  function formatIsoDate(date) {
    return date.toISOString().split('T')[0];
  }

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
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
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
    const ausnahmen = globalData.ausnahmen || {}; 

    if (!plan) {
        document.querySelector(".subjects").innerHTML = "<p style='padding:20px;'>Keine Daten für diese Klasse gefunden.</p>";
        return;
    }

    const dayColumns = document.querySelectorAll(".day-column");
    const dayHeaders = document.querySelectorAll(".days .day"); 
    const tabButtons = document.querySelectorAll(".day-tabs button"); 
    const weekRangeEl = document.getElementById("week-range");

    const friday = new Date(currentWeekStart);
    friday.setDate(friday.getDate() + 4);
    if (weekRangeEl) {
        weekRangeEl.textContent = `${formatDateShort(currentWeekStart)} - ${formatDateShort(friday)}`;
    }

    const startMinuteBase = 7 * 60; 
    const endMinuteRounded = 18 * 60; 
    const pixelsPerMinute = BASE_SLOT_HEIGHT_PX / BASE_SLOT_MINUTES;
    const containerHeightPx = (endMinuteRounded - startMinuteBase) * pixelsPerMinute;

    const subjectsContainer = document.querySelector(".subjects");
    const timesContainer = document.querySelector(".times");
    
    if(subjectsContainer) subjectsContainer.style.height = `${containerHeightPx}px`;
    
    if (timesContainer) {
        timesContainer.innerHTML = "";
        timesContainer.style.height = `${containerHeightPx}px`;
        for (let t = startMinuteBase; t <= endMinuteRounded; t += BASE_SLOT_MINUTES) {
            const topPx = (t - startMinuteBase) * pixelsPerMinute;
            const label = document.createElement("div");
            label.className = "time";
            label.textContent = formatTimeFromMinutes(t);
            label.style.top = `${topPx.toFixed(2)}px`;
            label.style.borderTop = "1px dashed var(--shadow-color)"; 
            timesContainer.appendChild(label);
        }
    }

    dayColumns.forEach(col => {
        col.innerHTML = "";
        col.style.height = `${containerHeightPx}px`;
    });

    dayOrder.forEach((wochentagName, index) => {
      const currentDate = new Date(currentWeekStart);
      currentDate.setDate(currentDate.getDate() + index);
      const dateString = formatDateShort(currentDate);
      const isoDate = formatIsoDate(currentDate); 

      const isToday = isoDate === todayIso; 

      if(dayHeaders[index + 1]) {
        dayHeaders[index + 1].innerHTML = `${wochentagName} <br><small style="font-weight:400; opacity:0.7">${dateString}</small>`;
        dayHeaders[index + 1].classList.remove('is-today'); 
        if (isToday) dayHeaders[index + 1].classList.add('is-today'); 
        dayHeaders[index + 1].classList.remove('active-day'); 
     }

     if(tabButtons[index]) {
       tabButtons[index].classList.remove('is-today'); 
       if (isToday) tabButtons[index].classList.add('is-today'); 
     }

      const col = dayColumns[index];
      if (!col) return;

      if (ausnahmen[isoDate]) {
        const holidayBox = document.createElement("div");
        holidayBox.className = "subject";
        holidayBox.style.top = "20px"; 
        holidayBox.style.width = "90%";
        holidayBox.style.background = "var(--bg-alexa)"; 
        holidayBox.style.color = "var(--text-alexa)";
        holidayBox.style.position = "relative";
        holidayBox.style.transform = "none";
        holidayBox.style.left = "0";
        holidayBox.style.margin = "0 auto";
        holidayBox.innerHTML = `<div class="subject-title">FREI</div><div>${ausnahmen[isoDate]}</div>`;
        col.appendChild(holidayBox);
        return; 
      }

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

          box.style.position = "absolute";
          box.style.top = `${top.toFixed(2)}px`;
          box.style.height = `${height.toFixed(2)}px`;
          
          box.innerHTML = `
            <div class="subject-title">${entry.fach}</div>
            <div class="subject-time">${entry.stunde}</div>
            <div class="subject-room">${entry.raum}</div>
            <div class="subject-teacher">${entry.lehrer}</div>
          `;

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

    updateDayView(); 
  }
  
  ladeStundenplan(); 

  // ============================================================
  // 5. MOBILE VIEW LOGIK (Tabs & Swipe)
  // ============================================================

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

    const dayHeaders = document.querySelectorAll(".days .day:not(.placeholder)");
    dayHeaders.forEach((header, index) => {
        header.classList.remove('active-day'); 
        if (index === currentDay) {
            header.classList.add('active-day'); 
        }
    });
  }

  document.querySelectorAll(".day-tabs button").forEach((btn, idx) => {
    btn.addEventListener("click", () => {
      currentDay = idx;
      updateDayView();
    });
  });

  let touchStartX = 0;
  document.addEventListener("touchstart", e => {
    touchStartX = e.touches[0].clientX;
  });
  document.addEventListener("touchend", e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx > 50 && currentDay > 0) { 
      currentDay--;
      updateDayView();
    } else if (dx < -50 && currentDay < 4) { 
      currentDay++;
      updateDayView();
    }
  });

  // ============================================================
  // 6. MENÜ, DARK MODE & DRUCKEN
  // ============================================================

  const menuBtn = document.getElementById("menu-btn");
  const dropdown = document.getElementById("dropdown-menu");
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const printBtn = document.getElementById("print-btn"); 

  if (menuBtn && dropdown) {
    menuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        dropdown.classList.toggle("show");
    });

    document.addEventListener("click", () => {
        dropdown.classList.remove("show");
    });
  }

  if (printBtn) {
    printBtn.addEventListener("click", () => {
        window.print();
        if (dropdown) dropdown.classList.remove("show");
    });
  }

  if (localStorage.getItem("darkMode") === "enabled") {
    document.body.classList.add("dark-mode");
    if(darkModeToggle) darkModeToggle.innerHTML = "☀️ Light Mode";
  }

  if (darkModeToggle) {
    darkModeToggle.addEventListener("click", () => {
        document.body.classList.toggle("dark-mode");
        
        if (document.body.classList.contains("dark-mode")) {
          localStorage.setItem("darkMode", "enabled");
          darkModeToggle.innerHTML = "☀️ Light Mode";
        } else {
          localStorage.setItem("darkMode", "disabled");
          darkModeToggle.innerHTML = "🌙 Dark Mode";
        }
    });
  }
});