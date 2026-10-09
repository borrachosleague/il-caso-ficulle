// IL CASO FICULLE - VIEWER.JS
// Pagina invitati - versione corretta

(() => {
  "use strict";

  const config = window.FICULLE_CONFIG;

  const vid = document.getElementById("film");
  const ready = document.getElementById("ready");
  const rs = document.getElementById("readyStatus");
  const ps = document.getElementById("playStatus");
  const cd = document.getElementById("countdown");
  const manual = document.getElementById("manualPlay");

  let enabled = false;
  let lastRev = -1;

  // Identificativo dell'invitato
  let token = sessionStorage.getItem("ficulle_guest");

  if (!token) {
    token = crypto.randomUUID();
    sessionStorage.setItem("ficulle_guest", token);
  }

  // Imposta il video
  vid.src = config.videoFile;
  vid.load();

  // Visualizzazione errori
  window.addEventListener("error", function (event) {
    rs.textContent = "Errore pagina: " + event.message;
  });

  // Conferma invitato
  ready.addEventListener("click", async function () {
    rs.textContent = "Collegamento a Supabase in corso...";
    ready.disabled = true;

    try {
      await rpc("ficulle_heartbeat", {
        p_guest: token
      });

      enabled = true;

      ready.textContent = "SEI PRONTO";
      rs.textContent =
        "Sei collegato. Aspetta il via della regia.";

      // Prepara il video senza avviarlo definitivamente
      vid.muted = true;

      try {
        await vid.play();
        vid.pause();
        vid.currentTime = 0;
      } catch (e) {
        // Il video potrebbe non essere disponibile
      }

      vid.muted = false;

    } catch (error) {
      rs.textContent = "ERRORE: " + error.message;
      ready.disabled = false;
    }
  });

  // Avvio manuale
  manual.addEventListener("click", async function () {
    try {
      await vid.play();
      manual.classList.add("hide");
    } catch (error) {
      ps.textContent =
        "Premi Play direttamente sul video.";
    }
  });

  // Sincronizzazione con la regia
  async function tick() {
    if (!enabled) return;

    try {
      await rpc("ficulle_heartbeat", {
        p_guest: token
      });

      const s = await rpc("ficulle_status");

      const now = Date.now() / 1000;
      const origin = Number(s.start_epoch || 0);
      const offset = Number(s.offset_seconds || 0);

      if (s.revision !== lastRev) {
        lastRev = s.revision;
      }

      if (s.mode === "waiting") {
        cd.textContent = "";
        ps.textContent = "In attesa della regia";

        if (!vid.paused) vid.pause();
        return;
      }

      if (s.mode === "paused") {
        cd.textContent = "IN PAUSA";

        if (!vid.paused) vid.pause();

        if (Math.abs(vid.currentTime - offset) > 1) {
          vid.currentTime = offset;
        }

        return;
      }

      const remaining = origin - now;

      if (remaining > 0) {
        cd.textContent = Math.ceil(remaining);
        ps.textContent = "Il film sta per iniziare";

        if (!vid.paused) vid.pause();
        return;
      }

      cd.textContent = "";

      const target = Math.max(
        0,
        offset + now - origin
      );

      if (
        vid.readyState >= 1 &&
        Math.abs(vid.currentTime - target) > 1.8
      ) {
        vid.currentTime = target;
      }

      if (vid.paused && !vid.ended) {
        try {
          await vid.play();

          manual.classList.add("hide");
          ps.textContent = "Proiezione in corso";

        } catch (error) {
          manual.classList.remove("hide");
          ps.textContent =
            "Il telefono richiede un tocco per avviare il video";
        }
      }

    } catch (error) {
      ps.textContent =
        "Errore connessione: " + error.message;
    }
  }

  // Controllo periodico
  setInterval(
    tick,
    Math.max(900, config.pollMs || 1200)
  );

  rs.textContent =
    "Pagina pronta. Premi SONO PRONTO.";

})();