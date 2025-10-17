async function ladeKlassen() {
    const res = await fetch("../JSON/data-times.json");
    const data = await res.json();
    const klassen = Object.keys(data.stundenplan);
    const liste = document.getElementById("klassenListe");
    klassen.forEach(klasse => {
      const option = document.createElement("option");
      option.value = klasse;
      liste.appendChild(option);
    });
  }
  
  ladeKlassen();
  
  document.getElementById("selectClass").addEventListener("click", async () => {
    const klasse = document.getElementById("classSearch").value.trim();
    const res = await fetch("../JSON/data-times.json");
    const data = await res.json();
  
    if (!data.stundenplan[klasse]) {
      alert("Klasse nicht gefunden!");
      return;
    }

    const overlay = document.getElementById("loadingOverlay");
  if (overlay) {
    overlay.classList.add("active");
  }

  // Button deaktivieren / Text ändern (optional, aber nice)
  const btn = document.getElementById("selectClass");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Lade…";
  }

  // Nach kurzer Wartezeit weiterleiten (z.B. 1200ms). Passe Zeit an.
  setTimeout(() => {
    window.location.href = `../Main/main.html?klasse=${encodeURIComponent(klasse)}`;
  }, 4000);
});