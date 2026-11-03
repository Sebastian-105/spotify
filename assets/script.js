   (function () {
      // ---------- THEME ----------

      const root = document.documentElement;

      const themeToggle = document.getElementById("themeToggle");

      const themeLabel = document.getElementById("themeLabel");

      let theme =
        window.matchMedia &&
          window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

      function applyTheme() {
        if (theme === "dark") {
          root.setAttribute("data-theme", "dark");
          themeLabel.textContent = "Light";
        } else {
          root.removeAttribute("data-theme");
          themeLabel.textContent = "Dark";
        }
      }

      themeToggle.addEventListener("click", () => {
        theme = theme === "dark" ? "light" : "dark";
        applyTheme();
      });

      applyTheme();

      // ---------- DURATION FORMATTING ----------

      // Formats any millisecond duration as a combined m / h / d string,

      // e.g. 45m, 12h 30m, 297d 4h — used everywhere a listening time is shown.

      function formatDuration(ms) {
        const totalMinutes = Math.round(ms / 60000);

        const totalHours = Math.floor(totalMinutes / 60);

        const totalDays = Math.floor(totalHours / 24);

        const days = Math.floor(totalMinutes / 1440);

        const hours = Math.floor((totalMinutes % 1440) / 60);

        const minutes = totalMinutes % 60;

        return `${totalMinutes.toLocaleString()}m / ${totalHours.toLocaleString()}h / ${totalDays.toLocaleString()}d`;

        if (days > 0) return `${days}d ${hours}h`;

        if (hours > 0) return `${hours}h ${minutes}m`;

        return `${minutes}m`;
      }

      function formatTextDuration(ms) {
        const totalMinutes = Math.round(ms / 60000);

        const days = Math.floor(totalMinutes / 1440);

        const hours = Math.floor((totalMinutes % 1440) / 60);

        const minutes = totalMinutes % 60;

        if (days > 0) return `${days}d ${hours}h`;

        if (hours > 0) return `${hours}h ${minutes}m`;

        return `${minutes}m`;
      }

      // ---------- DATE HELPERS ----------

      function toInputDate(d) {
        const yyyy = d.getFullYear();

        const mm = String(d.getMonth() + 1).padStart(2, "0");

        const dd = String(d.getDate()).padStart(2, "0");

        return `${yyyy}-${mm}-${dd}`;
      }

      function formatDateLabel(d) {
        return d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }

      // ---------- MODE SWITCHING ----------

      const panels = {
        upload: document.getElementById("panel-upload"),
        live: document.getElementById("panel-live"),
      };
      const explanationPanel = document.getElementById("explanationPanel");
      const mainLayout = document.querySelector(".layout");

      document.querySelectorAll(".mode-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          document
            .querySelectorAll(".mode-btn")
            .forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          Object.values(panels).forEach((p) => p.classList.remove("active"));
          explanationPanel.classList.remove("active");
          mainLayout.classList.toggle(
            "explanation-mode",
            btn.dataset.mode === "explanation",
          );

          if (btn.dataset.mode === "explanation") {
            explanationPanel.classList.add("active");
          } else {
            panels[btn.dataset.mode].classList.add("active");
          }
          resetDisplay();
        });
      });

      function resetDisplay() {
        document.getElementById("statCard").style.display = "none";
        document.getElementById("resultsTabs").style.display = "none";
        document.getElementById("results").classList.remove("patterns-view");
        document.getElementById("results").dataset.view = "overview";
        document
          .querySelectorAll(".results-tab")
          .forEach((tab, i) => tab.classList.toggle("active", i === 0));

        document.getElementById("bigstat").style.display = "none";

        document.getElementById("searchWrap").style.display = "none";

        document.getElementById("controls").style.display = "none";

        document.getElementById("uploadControls").style.display = "none";

        document.getElementById("artistsTitle").style.display = "none";

        document.getElementById("tracksTitle").style.display = "none";

        document.getElementById("yearsTitle").style.display = "none";

        document.getElementById("artistsList").innerHTML = "";

        document.getElementById("tracksList").innerHTML = "";

        document.getElementById("yearsList").innerHTML = "";

        document.getElementById("liveList").innerHTML = "";

        document.getElementById("stamp").style.display = "none";

        document.getElementById("footNote").textContent = "";
      }

      // ---------- UPLOAD MODE: parse export ----------

      const dropzone = document.getElementById("dropzone");

      const fileInput = document.getElementById("fileInput");

      const uploadProgress = document.getElementById("uploadProgress");

      const uploadError = document.getElementById("uploadError");

      const stampEl = document.getElementById("stamp");

      const uploadControls = document.getElementById("uploadControls");

      const dateFromInput = document.getElementById("dateFrom");

      const dateToInput = document.getElementById("dateTo");

      const applyDateBtn = document.getElementById("applyDateBtn");

      const presetTabs = document.querySelectorAll(".preset-tab");

      let artistMs = {},
        artistPlays = {},
        trackMs = {},
        yearMs = {},
        totalMs = 0,
        totalRecords = 0;

      let allRecords = [],
        dataMinTs = null,
        dataMaxTs = null;
      let currentFilteredRecords = [];

      dropzone.addEventListener("click", () => fileInput.click());

      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("drag");
      });

      dropzone.addEventListener("dragleave", () =>
        dropzone.classList.remove("drag"),
      );

      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("drag");

        handleFiles(e.dataTransfer.files);
      });

      fileInput.addEventListener("change", () =>
        handleFiles(fileInput.files),
      );

      async function handleFiles(fileList) {
        uploadError.style.display = "none";

        const files = Array.from(fileList);

        if (!files.length) return;

        uploadProgress.style.display = "block";

        uploadProgress.textContent = "Reading files…";

        allRecords = [];
        dataMinTs = null;
        dataMaxTs = null;

        artistMs = {};
        artistPlays = {};
        trackMs = {};
        yearMs = {};
        totalMs = 0;
        totalRecords = 0;

        try {
          const jsonBlobs = [];

          for (const file of files) {
            if (file.name.toLowerCase().endsWith(".zip")) {
              const zip = await JSZip.loadAsync(file);

              const entries = Object.values(zip.files).filter(
                (f) =>
                  !f.dir && /Streaming_History_Audio.*\.json$/i.test(f.name),
              );

              for (const entry of entries) {
                const text = await entry.async("string");

                jsonBlobs.push(text);
              }
            } else if (file.name.toLowerCase().endsWith(".json")) {
              const text = await file.text();

              jsonBlobs.push(text);
            }
          }

          if (!jsonBlobs.length) {
            uploadError.textContent =
              "Couldn't find any Streaming_History_Audio json files in what you uploaded.";

            uploadError.style.display = "block";

            uploadProgress.style.display = "none";

            return;
          }

          uploadProgress.textContent =
            "Crunching " + jsonBlobs.length + " file(s)…";

          for (const text of jsonBlobs) {
            let data;

            try {
              data = JSON.parse(text);
            } catch (e) {
              continue;
            }

            for (const r of data) {
              const ms = r.ms_played || 0;

              const artist = r.master_metadata_album_artist_name;

              const track = r.master_metadata_track_name;

              if (!r.ts) continue;

              const d = new Date(r.ts);

              if (isNaN(d.getTime())) continue;

              allRecords.push({ ts: d, ms, artist, track });
            }
          }

          if (!allRecords.length) {
            uploadError.textContent =
              "Those files parsed, but none of the entries had a readable timestamp.";

            uploadError.style.display = "block";

            uploadProgress.style.display = "none";

            return;
          }

          allRecords.sort((a, b) => a.ts - b.ts);

          dataMinTs = allRecords[0].ts;

          dataMaxTs = allRecords[allRecords.length - 1].ts;

          dateFromInput.min = toInputDate(dataMinTs);

          dateFromInput.max = toInputDate(dataMaxTs);

          dateToInput.min = toInputDate(dataMinTs);

          dateToInput.max = toInputDate(dataMaxTs);

          uploadControls.style.display = "block";

          applyPreset("all");

          uploadProgress.style.display = "none";
        } catch (e) {
          uploadError.textContent =
            "Could not read that file. Make sure it's the export zip or the Streaming_History_Audio json files.";

          uploadError.style.display = "block";

          uploadProgress.style.display = "none";
        }
      }

      // ---------- DATE RANGE FILTERING (upload mode) ----------

      function setActivePreset(preset) {
        presetTabs.forEach((t) =>
          t.classList.toggle("active", t.dataset.preset === preset),
        );
      }

      function applyPreset(preset) {
        let from,
          to = new Date(dataMaxTs);

        if (preset === "all") {
          from = new Date(dataMinTs);
        } else {
          from = new Date(dataMaxTs);

          if (preset === "4w") from.setDate(from.getDate() - 28);

          if (preset === "3m") from.setMonth(from.getMonth() - 3);

          if (preset === "6m") from.setMonth(from.getMonth() - 6);

          if (preset === "1y") from.setFullYear(from.getFullYear() - 1);

          if (from < dataMinTs) from = new Date(dataMinTs);
        }

        dateFromInput.value = toInputDate(from);

        dateToInput.value = toInputDate(to);

        setActivePreset(preset);

        computeAndRender(from, to);
      }

      presetTabs.forEach((btn) =>
        btn.addEventListener("click", () => applyPreset(btn.dataset.preset)),
      );

      applyDateBtn.addEventListener("click", () => {
        if (!allRecords.length) return;

        const fromVal = dateFromInput.value,
          toVal = dateToInput.value;

        if (!fromVal || !toVal) {
          uploadError.textContent = "Pick both a start and an end date.";

          uploadError.style.display = "block";

          return;
        }

        const from = new Date(fromVal + "T00:00:00");

        const to = new Date(toVal + "T23:59:59");

        if (from > to) {
          uploadError.textContent =
            "Start date has to be before the end date.";

          uploadError.style.display = "block";

          return;
        }

        uploadError.style.display = "none";

        setActivePreset("custom");

        computeAndRender(from, to);
      });

      function computeAndRender(from, to) {
        const filtered = allRecords.filter((r) => r.ts >= from && r.ts <= to);
        currentFilteredRecords = filtered;

        artistMs = {};
        artistPlays = {};
        trackMs = {};
        yearMs = {};
        totalMs = 0;
        totalRecords = 0;

        for (const r of filtered) {
          totalMs += r.ms;

          totalRecords++;

          const year = r.ts.getFullYear().toString();

          yearMs[year] = (yearMs[year] || 0) + r.ms;

          if (r.artist) {
            artistMs[r.artist] = (artistMs[r.artist] || 0) + r.ms;

            artistPlays[r.artist] = (artistPlays[r.artist] || 0) + 1;
          }

          if (r.artist && r.track) {
            const key = r.artist + " — " + r.track;

            trackMs[key] = (trackMs[key] || 0) + r.ms;
          }
        }

        stampEl.style.display = "block";

        stampEl.textContent =
          "Range: " + formatDateLabel(from) + " – " + formatDateLabel(to);

        renderUploadResults();
        renderListeningPatterns();
        renderExtras(from, to);
      }

      function renderUploadResults() {
        document.getElementById("statCard").style.display = "block";
        document.getElementById("resultsTabs").style.display = "flex";

        document.getElementById("bigstat").style.display = "block";

        document.getElementById("bigstatNum").title = formatDuration(totalMs);

        document.getElementById("bigstatNum").textContent =
          formatTextDuration(totalMs);

        document.getElementById("bigstatSub").textContent =
          totalRecords.toLocaleString() + " plays logged";

        document.getElementById("searchWrap").style.display = "block";

        document.getElementById("artistsTitle").style.display = "block";

        document.getElementById("tracksTitle").style.display = "block";

        document.getElementById("yearsTitle").style.display = "block";

        document.getElementById("footNote").textContent =
          "Time comes straight from Spotify's ms_played field in your export — this is your real listening time.";

        const topArtists = Object.entries(artistMs)
          .sort((a, b) => b[1] - a[1])
          .slice(0, topN);

        const maxArtistMs = topArtists.length ? topArtists[0][1] : 1;

        const artistsList = document.getElementById("artistsList");

        artistsList.innerHTML = "";

        if (!topArtists.length) {
          artistsList.innerHTML =
            '<div class="placeholder">Nothing in this date range.</div>';
        }

        topArtists.forEach(([name, ms], i) => {
          const row = document.createElement("div");

          row.className = "item";

          row.innerHTML = `

        <span class="rank">${String(i + 1).padStart(2, "0")}</span>

        <div class="meta"><div class="name">${escapeHtml(name)}</div><div class="sub">${artistPlays[name].toLocaleString()} plays</div></div>

        <div class="affinity">

          <span class="affinity-num" style="cursor: help;" title="${formatDuration(ms)}">${formatTextDuration(ms)}</span>

          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (ms / maxArtistMs) * 100)}%"></div></div>

        </div>`;

          artistsList.appendChild(row);
        });

        const topTracks = Object.entries(trackMs)
          .sort((a, b) => b[1] - a[1])
          .slice(0, topN);

        const maxTrackMs = topTracks.length ? topTracks[0][1] : 1;

        const tracksList = document.getElementById("tracksList");

        tracksList.innerHTML = "";

        if (!topTracks.length) {
          tracksList.innerHTML =
            '<div class="placeholder">Nothing in this date range.</div>';
        }

        topTracks.forEach(([label, ms], i) => {
          const parts = label.split(" — ");

          const artist = parts[0],
            track = parts.slice(1).join(" — ");

          const row = document.createElement("div");

          row.className = "item";

          row.innerHTML = `

        <span class="rank">${String(i + 1).padStart(2, "0")}</span>

        <div class="meta"><div class="name">${escapeHtml(track)}</div><div class="sub">${escapeHtml(artist)}</div></div>

        <div class="affinity">

          <span class="affinity-num">${formatDuration(ms)}</span>

          <div class="bar-track"><div class="bar-fill" style="width:${Math.max(4, (ms / maxTrackMs) * 100)}%"></div></div>

        </div>`;

          tracksList.appendChild(row);
        });

        const years = Object.keys(yearMs).sort();

        const maxYearMs = Math.max(...years.map((y) => yearMs[y]), 1);

        const yearsList = document.getElementById("yearsList");

        yearsList.innerHTML = "";

        years.forEach((y) => {
          const row = document.createElement("div");

          row.className = "year-row";

          row.innerHTML = `

        <span class="year-label">${y}</span>

        <div class="year-bar-track"><div class="year-bar-fill" style="width:${Math.max(2, (yearMs[y] / maxYearMs) * 100)}%"></div></div>

        <span class="year-val">${formatDuration(yearMs[y])}</span>`;

          yearsList.appendChild(row);
        });
      }

      // ---------- LISTENING PATTERNS (upload mode) ----------
      function dateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      }

      function startOfWeek(date) {
        const d = new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
        );
        const day = (d.getDay() + 6) % 7; // Monday-based week
        d.setDate(d.getDate() - day);
        return d;
      }

      function renderPatternRows(elementId, entries, formatter, limit = 10) {
        const el = document.getElementById(elementId);
        const rows = entries.slice(0, limit);
        if (!rows.length) {
          el.innerHTML =
            '<div class="placeholder">No listening recorded in this range.</div>';
          return;
        }
        const max = rows[0][1] || 1;
        el.innerHTML = rows
          .map(
            ([key, ms]) => `
          <div class="pattern-row">
            <div class="pattern-name" title="${escapeHtml(formatter(key))}">${escapeHtml(formatter(key))}</div>
            <div class="pattern-track"><div class="pattern-fill" style="width:${Math.max(2, (ms / max) * 100)}%"></div></div>
            <div class="pattern-time">${formatTextDuration(ms)}</div>
          </div>
        `,
          )
          .join("");
      }

      function renderListeningPatterns() {
        const months = {},
          days = {},
          weeks = {};
        for (const record of currentFilteredRecords) {
          if (!record.ms || record.ms <= 0) continue;
          const d = record.ts;
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          const dayKey = dateKey(d);
          const weekKey = dateKey(startOfWeek(d));
          months[monthKey] = (months[monthKey] || 0) + record.ms;
          days[dayKey] = (days[dayKey] || 0) + record.ms;
          weeks[weekKey] = (weeks[weekKey] || 0) + record.ms;
        }

        const monthEntries = Object.entries(months).sort(
          (a, b) => b[1] - a[1],
        );
        const dayEntries = Object.entries(days).sort((a, b) => b[1] - a[1]);
        const weekEntries = Object.entries(weeks).sort((a, b) => b[1] - a[1]);

        const monthLabel = (key) => {
          const [y, m] = key.split("-").map(Number);
          return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
            month: "long",
            year: "numeric",
          });
        };
        const dayLabel = (key) => {
          const [y, m, d] = key.split("-").map(Number);
          return new Date(y, m - 1, d).toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        };
        const weekLabel = (key) => {
          const [y, m, d] = key.split("-").map(Number);
          const start = new Date(y, m - 1, d);
          const end = new Date(start);
          end.setDate(end.getDate() + 6);
          return `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
        };

        const highlights = [
          {
            label: "Most listened month",
            entry: monthEntries[0],
            format: monthLabel,
          },
          {
            label: "Most listened day",
            entry: dayEntries[0],
            format: dayLabel,
          },
          {
            label: "Most listened week",
            entry: weekEntries[0],
            format: weekLabel,
          },
        ];

        document.getElementById("patternHighlights").innerHTML = highlights
          .map(
            (item) => `
          <div class="pattern-card">
            <div class="pattern-label">${item.label}</div>
            <div class="pattern-value">${item.entry ? escapeHtml(item.format(item.entry[0])) : "—"}</div>
            <div class="pattern-detail">${item.entry ? formatTextDuration(item.entry[1]) + " listened" : "No data for this range"}</div>
          </div>
        `,
          )
          .join("");

        renderPatternRows("monthBreakdown", monthEntries, monthLabel, 12);
        renderPatternRows("dayBreakdown", dayEntries, dayLabel, 10);
        renderPatternRows("weekBreakdown", weekEntries, weekLabel, 10);
      }

      // Switch between the existing overview and the new time-pattern view.
      document.querySelectorAll(".results-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          const results = document.getElementById("results");
          const patterns = btn.dataset.view === "patterns";
          results.classList.toggle("patterns-view", patterns);
          document
            .querySelectorAll(".results-tab")
            .forEach((tab) => tab.classList.toggle("active", tab === btn));
        });
      });

      // ---------- ADDED: top-N, unique counts, streak, heat map, taste, compare, records ----------
      let topN = 10;
      const $ = (id) => document.getElementById(id);
      const PLAY = 30000;
      const O = () => Object.create(null);
      const sortDesc = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
      const dayNum = (k) => {
        const [y, m, d] = k.split("-").map(Number);
        return Math.round(Date.UTC(y, m - 1, d) / 864e5);
      };
      const fmtDay = (k) => {
        const [y, m, d] = k.split("-").map(Number);
        return new Date(y, m - 1, d).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      };
      const fmtMonth = (k) => {
        const [y, m] = k.split("-").map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
          month: "long",
          year: "numeric",
        });
      };
      const card = (l, v, d) =>
        `<div class="pattern-card"><div class="pattern-label">${l}</div><div class="pattern-value">${escapeHtml(String(v))}</div><div class="pattern-detail">${escapeHtml(String(d || ""))}</div></div>`;
      let cache = { f: null },
        cmpFor = null;
      function memo(key, fn) {
        if (cache.f !== allRecords) cache = { f: allRecords };
        return key in cache ? cache[key] : (cache[key] = fn());
      }

      document.querySelectorAll(".topn-btn").forEach((b) =>
        b.addEventListener("click", () => {
          topN = +b.dataset.n;
          document
            .querySelectorAll(".topn-btn")
            .forEach((t) => t.classList.toggle("active", t === b));
          if (allRecords.length) renderUploadResults();
        }),
      );
      document.querySelectorAll(".results-tab").forEach((b) =>
        b.addEventListener("click", () => {
          $("results").dataset.view = b.dataset.view;
        }),
      );

      function streakOf(keys) {
        const ks = [...keys].sort();
        let best = { len: 0 },
          s = 0,
          prev = null,
          len = 0;
        ks.forEach((k, i) => {
          const n = dayNum(k);
          if (prev !== null && n === prev + 1) len++;
          else {
            s = i;
            len = 1;
          }
          prev = n;
          if (len > best.len) best = { len, start: ks[s], end: k };
        });
        return best;
      }

      function stats(recs) {
        const days = O(),
          songs = new Set(),
          arts = new Set(),
          am = O(),
          tm = O();
        let ms = 0;
        for (const r of recs) {
          ms += r.ms;
          if (r.ms <= 0) continue;
          const k = dateKey(r.ts);
          days[k] = (days[k] || 0) + r.ms;
          if (r.artist) {
            am[r.artist] = (am[r.artist] || 0) + r.ms;
            if (r.ms >= PLAY) arts.add(r.artist);
            if (r.track) {
              const t = r.artist + " — " + r.track;
              tm[t] = (tm[t] || 0) + r.ms;
              if (r.ms >= PLAY) songs.add(t);
            }
          }
        }
        const dk = Object.keys(days);
        return {
          ms,
          plays: recs.length,
          songs: songs.size,
          artists: arts.size,
          days,
          activeDays: dk.length,
          streak: streakOf(dk),
          topA: sortDesc(am),
          topT: sortDesc(tm),
        };
      }
      const allS = () => memo("all", () => stats(allRecords));

      function renderExtras(from, to) {
        $("topNTabs").style.display = "flex";
        const s = stats(currentFilteredRecords);
        $("bigstatSub").innerHTML =
          `${s.plays.toLocaleString()} plays logged<br>${s.songs.toLocaleString()} unique songs<br>${s.artists.toLocaleString()} unique artists`;
        const sl = s.streak.len;
        $("streakBox").innerHTML =
          card(
            "Longest listening streak",
            sl ? sl + (sl === 1 ? " day" : " days") : "—",
            sl
              ? fmtDay(s.streak.start) + " – " + fmtDay(s.streak.end)
              : "No data in this range",
          ) +
          card(
            "Unique songs",
            s.songs.toLocaleString(),
            "played 30s+ in this range",
          ) +
          card(
            "Unique artists",
            s.artists.toLocaleString(),
            "played 30s+ in this range",
          );
        renderHeat(s.days, from, to);
        renderTaste(s, from, to);
        initCompare();
        renderRecords();
      }

      function renderHeat(days, from, to) {
        const vals = Object.values(days).sort((a, b) => a - b);
        const q = (p) =>
          vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] || 0;
        const th = [q(0.25), q(0.5), q(0.75)];
        const lvl = (ms) =>
          !ms ? 0 : ms <= th[0] ? 1 : ms <= th[1] ? 2 : ms <= th[2] ? 3 : 4;
        let html = "";
        for (let y = from.getFullYear(); y <= to.getFullYear(); y++) {
          const a = new Date(Math.max(from, new Date(y, 0, 1))),
            b = new Date(Math.min(to, new Date(y, 11, 31, 23, 59)));
          a.setHours(0, 0, 0, 0);
          let cells = "",
            labels = "",
            n = a.getDay(),
            lastM = -1,
            total = 0;
          for (let i = 0; i < a.getDay(); i++)
            cells += '<i class="hm-c hm-e"></i>';
          for (
            const d = new Date(a);
            d <= b;
            d.setDate(d.getDate() + 1), n++
          ) {
            const k = dateKey(d),
              ms = days[k] || 0;
            total += ms;
            if (d.getMonth() !== lastM) {
              lastM = d.getMonth();
              labels += `<span style="left:${Math.floor(n / 7) * 15}px">${d.toLocaleDateString(undefined, { month: "short" })}</span>`;
            }
            cells += `<i class="hm-c hm-${lvl(ms)}" title="${fmtDay(k)}: ${ms ? formatTextDuration(ms) : "no listening"}"></i>`;
          }
          html += `<div class="hm-year">${y} <span class="sub" style="display:inline">· ${formatTextDuration(total)}</span></div><div class="hm-scroll" ><div class="hm-months" style="width:${Math.ceil(n / 7) * 15}px">${labels}</div><div class="hm-grid">${cells}</div></div>`;
        }
        html +=
          '<div class="hm-legend">Less <i class="hm-c hm-0"></i><i class="hm-c hm-1"></i><i class="hm-c hm-2"></i><i class="hm-c hm-3"></i><i class="hm-c hm-4"></i> More</div>';
        $("heatBox").innerHTML = html;
      }

      function renderTaste(s, from, to) {
        const cols = [
          "var(--accent)",
          "var(--accent-2)",
          "var(--ink)",
          "var(--ink-soft)",
          "var(--border)",
        ];
        const t5 = s.topA.slice(0, 5),
          sum = t5.reduce((a, e) => a + e[1], 0),
          pct = (x) => (s.ms ? (x / s.ms) * 100 : 0);
        $("domBox").innerHTML = t5.length
          ? `<p class="pattern-intro">Your top 5 artists make up <strong>${pct(sum).toFixed(1)}%</strong> of your listening time in this range.</p>
             <div class="dom-bar">${t5.map((e, i) => `<span style="width:${pct(e[1])}%;background:${cols[i]}" title="${escapeHtml(e[0])}"></span>`).join("")}</div>
             <div class="pattern-list">${t5.map((e, i) => `<div class="pattern-row"><div class="pattern-name" title="${escapeHtml(e[0])}"><i class="dom-sw" style="background:${cols[i]}"></i>${escapeHtml(e[0])}</div><div class="pattern-track"><div class="pattern-fill" style="width:${(e[1] / t5[0][1]) * 100}%"></div></div><div class="pattern-time">${pct(e[1]).toFixed(1)}%</div></div>`).join("")}</div>`
          : '<div class="placeholder">No data in this range.</div>';

        const ya = {},
          yt = {};
        for (const r of currentFilteredRecords) {
          if (r.ms <= 0) continue;
          const y = r.ts.getFullYear();
          yt[y] = (yt[y] || 0) + r.ms;
          if (r.artist) {
            ya[y] = ya[y] || O();
            ya[y][r.artist] = (ya[y][r.artist] || 0) + r.ms;
          }
        }
        $("yearArtistBox").innerHTML =
          Object.keys(ya)
            .sort()
            .map((y) => {
              const [n, ms] = sortDesc(ya[y])[0];
              return `<div class="pattern-row"><div class="pattern-name" title="${escapeHtml(n)}">${y} · ${escapeHtml(n)}</div><div class="pattern-track"><div class="pattern-fill" style="width:${(ms / yt[y]) * 100}%"></div></div><div class="pattern-time">${formatTextDuration(ms)}</div></div>`;
            })
            .join("") ||
          '<div class="placeholder">No data in this range.</div>';

        const fs = memo("first", () => {
          const f = O();
          for (const r of allRecords)
            if (r.artist && r.ms >= PLAY && !f[r.artist]) f[r.artist] = r.ts;
          return f;
        });
        const am = memo("allMap", () => new Map(allS().topA));
        const g = {};
        for (const [a, ts] of Object.entries(fs)) {
          if (ts < from || ts > to) continue;
          const k =
            ts.getFullYear() +
            "-" +
            String(ts.getMonth() + 1).padStart(2, "0");
          (g[k] = g[k] || []).push(a);
        }
        const keys = Object.keys(g).sort().reverse(),
          mx = Math.max(1, ...keys.map((k) => g[k].length));
        $("discBox").innerHTML = keys.length
          ? keys
            .map((k) => {
              const l = g[k].sort((a, b) => am.get(b) - am.get(a));
              return `<div class="tl-item"><div class="name">${fmtMonth(k)} · ${l.length} new artist${l.length > 1 ? "s" : ""}</div><div class="bar-track" style="margin:6px 0"><div class="bar-fill" style="width:${(l.length / mx) * 100}%"></div></div><div class="sub" style="white-space:normal">${l
                .slice(0, 5)
                .map((x) => escapeHtml(x))
                .join(", ")}${l.length > 5 ? " …" : ""}</div></div>`;
            })
            .join("")
          : '<div class="placeholder">No new artists discovered in this range.</div>';
      }

      // ----- Compare -----
      function yrDates(y) {
        return [
          toInputDate(new Date(Math.max(new Date(y, 0, 1), dataMinTs))),
          toInputDate(new Date(Math.min(new Date(y, 11, 31), dataMaxTs))),
        ];
      }
      function setYear(p, y) {
        const [f, t] = yrDates(y);
        $("cmp" + p + "From").value = f;
        $("cmp" + p + "To").value = t;
      }
      ["A", "B"].forEach((p) =>
        $("cmpYear" + p).addEventListener("change", (e) => {
          if (e.target.value) setYear(p, +e.target.value);
        }),
      );
      $("cmpBtn").addEventListener("click", runCompare);
      function initCompare() {
        if (cmpFor === allRecords) return;
        cmpFor = allRecords;
        const y1 = dataMinTs.getFullYear(),
          y2 = dataMaxTs.getFullYear();
        let opts = '<option value="">Custom range</option>';
        for (let y = y2; y >= y1; y--)
          opts += `<option value="${y}">${y}</option>`;
        ["A", "B"].forEach((p) => {
          $("cmpYear" + p).innerHTML = opts;
        });
        const ya = Math.max(y1, y2 - 1);
        setYear("A", ya);
        setYear("B", y2);
        $("cmpYearA").value = ya;
        $("cmpYearB").value = y2;
        $("cmpOut").innerHTML = "";
      }
      function runCompare() {
        const rd = (f, t) => [
          new Date($(f).value + "T00:00:00"),
          new Date($(t).value + "T23:59:59"),
        ];
        const [a1, a2] = rd("cmpAFrom", "cmpATo"),
          [b1, b2] = rd("cmpBFrom", "cmpBTo");
        if ([a1, a2, b1, b2].some((d) => isNaN(d))) {
          $("cmpOut").innerHTML =
            '<div class="placeholder">Pick all four dates.</div>';
          return;
        }
        const A = stats(allRecords.filter((r) => r.ts >= a1 && r.ts <= a2)),
          B = stats(allRecords.filter((r) => r.ts >= b1 && r.ts <= b2));
        const avg = (s) => (s.activeDays ? s.ms / s.activeDays : 0),
          nm = (s, i) => (s.topA[i] ? s.topA[i][0] : "—");
        const L = (n) => n.toLocaleString();
        const rows = [
          [
            "Time listened",
            formatTextDuration(A.ms),
            formatTextDuration(B.ms),
            A.ms,
            B.ms,
          ],
          ["Plays", L(A.plays), L(B.plays), A.plays, B.plays],
          ["Unique songs", L(A.songs), L(B.songs), A.songs, B.songs],
          [
            "Unique artists",
            L(A.artists),
            L(B.artists),
            A.artists,
            B.artists,
          ],
          [
            "Active days",
            L(A.activeDays),
            L(B.activeDays),
            A.activeDays,
            B.activeDays,
          ],
          [
            "Avg / active day",
            formatTextDuration(avg(A)),
            formatTextDuration(avg(B)),
            avg(A),
            avg(B),
          ],
          [
            "Longest streak",
            A.streak.len + " d",
            B.streak.len + " d",
            A.streak.len,
            B.streak.len,
          ],
          [
            "Top track",
            A.topT[0] ? A.topT[0][0] : "—",
            B.topT[0] ? B.topT[0][0] : "—",
          ],
          ...[0, 1, 2, 3, 4].map((i) => [
            "Artist #" + (i + 1),
            nm(A, i),
            nm(B, i),
          ]),
        ];
        const dl = (a, b) => {
          if (a === undefined || !(a > 0)) return "";
          const p = ((b - a) / a) * 100;
          return `<span class="${p >= 0 ? "cmp-up" : "cmp-down"}">${p >= 0 ? "+" : ""}${Math.round(p)}%</span>`;
        };
        const lab = (x, y) =>
          x.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          }) +
          " – " +
          y.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        $("cmpOut").innerHTML =
          `<div class="cmp-table"><div class="cmp-row head"><div></div><div>A · ${lab(a1, a2)}</div><div>B · ${lab(b1, b2)}</div><div>Change</div></div>` +
          rows
            .map(
              (r) =>
                `<div class="cmp-row"><div>${r[0]}</div><div>${escapeHtml(r[1])}</div><div>${escapeHtml(r[2])}</div><div>${dl(r[3], r[4])}</div></div>`,
            )
            .join("") +
          "</div>";
      }

      // ----- Records (always all-time) -----
      function renderRecords() {
        const s = allS();
        if (!s.activeDays) {
          $("recordsBox").innerHTML = "";
          return;
        }
        const R = memo("rec", () => {
          const m = O(),
            w = O(),
            dp = O(),
            da = O(),
            pl = O(),
            ap = O();
          let longest = null;
          for (const r of allRecords) {
            if (r.ms <= 0) continue;
            const k = dateKey(r.ts);
            m[k.slice(0, 7)] = (m[k.slice(0, 7)] || 0) + r.ms;
            const wk = dateKey(startOfWeek(r.ts));
            w[wk] = (w[wk] || 0) + r.ms;
            if (r.ms >= PLAY) {
              dp[k] = (dp[k] || 0) + 1;
              if (r.artist) {
                (da[k] = da[k] || new Set()).add(r.artist);
                ap[r.artist] = (ap[r.artist] || 0) + 1;
              }
              if (r.artist && r.track) {
                const t = r.artist + " — " + r.track;
                pl[t] = (pl[t] || 0) + 1;
              }
            }
            if (!longest || r.ms > longest.ms) longest = r;
          }
          const ds = O();
          for (const k in da) ds[k] = da[k].size;
          return { m, w, dp, ds, pl, ap, longest };
        });
        const mx = (o) => sortDesc(o)[0] || ["", 0];
        const day = mx(s.days),
          wk = mx(R.w),
          mo = mx(R.m),
          sg = mx(R.dp),
          ar = mx(R.ds),
          sp = mx(R.pl),
          pa = mx(R.ap),
          lg = R.longest;
        $("recordsBox").innerHTML = [
          card(
            "Longest listening streak",
            s.streak.len + " days",
            fmtDay(s.streak.start) + " – " + fmtDay(s.streak.end),
          ),
          card("Busiest day", formatTextDuration(day[1]), fmtDay(day[0])),
          card(
            "Busiest week",
            formatTextDuration(wk[1]),
            "Week of " + fmtDay(wk[0]),
          ),
          card("Busiest month", formatTextDuration(mo[1]), fmtMonth(mo[0])),
          card(
            "Most songs in a day",
            sg[1].toLocaleString() + " plays",
            fmtDay(sg[0]),
          ),
          card(
            "Most artists in a day",
            ar[1].toLocaleString(),
            fmtDay(ar[0]),
          ),
          card(
            "Longest single listen",
            formatTextDuration(lg.ms),
            (lg.artist || "Unknown") +
            " — " +
            (lg.track || "Unknown") +
            " · " +
            dateKey(lg.ts),
          ),
          card("Most-played song", sp[1].toLocaleString() + " plays", sp[0]),
          card(
            "Most-played artist",
            pa[1].toLocaleString() + " plays",
            pa[0],
          ),
          card(
            "All-time listening",
            formatTextDuration(s.ms),
            s.songs.toLocaleString() +
            " unique songs · " +
            s.artists.toLocaleString() +
            " unique artists",
          ),
        ].join("");
      }

      // ---------- ADDED: colour palettes ----------
      // order: bg, surface, surface-2, ink, ink-soft, accent, accent-2, border

      const PAL = {
        ocean: {
          n: "Ocean",
          l: [
            "#edf2f6",
            "#f8fafc",
            "#e1e9f0",
            "#263541",
            "#71818e",
            "#397fc0",
            "#3b9c8a",
            "#cbd7e0",
          ],
          d: [
            "#1c252d",
            "#252f39",
            "#303d49",
            "#bbc3c9",
            "#a0afbb",
            "#76a9d8",
            "#72b9a8",
            "#3c4b58",
          ],
        },

        ember: {
          n: "Ember (default)",
          l: [
            "#f0eee8",
            "#faf8f2",
            "#e7e3da",
            "#292925",
            "#77746d",
            "#d96b3f",
            "#478f7d",
            "#d3cec3",
          ],
          d: [
            "#20211f",
            "#292a27",
            "#32332f",
            "#e5e1d8",
            "#a6a197",
            "#d9825b",
            "#79a895",
            "#41413b",
          ],
        },

        forest: {
          n: "Forest",
          l: [
            "#eef1e9",
            "#fafbf7",
            "#e1e7d9",
            "#30392d",
            "#77816e",
            "#57845b",
            "#ad914c",
            "#d0d8c6",
          ],
          d: [
            "#20271f",
            "#293226",
            "#343e30",
            "#e2e8dc",
            "#a6b19c",
            "#83aa7c",
            "#c5a969",
            "#465342",
          ],
        },

        // grape: {
        //   n: 'Grape',
        //   l: [
        //     '#f1eef5', '#faf8fc', '#e7e0ed', '#342c3d',
        //     '#82758e', '#8765bb', '#bd6e9a', '#d5cbdc'
        //   ],
        //   d: [
        //     '#25202b', '#2e2836', '#3a3243', '#e8e0ed',
        //     '#b2a6bd', '#ad91d2', '#d18bab', '#4a4053'
        //   ]
        // },

        // rose: {
        //   n: 'Rose',
        //   l: [
        //     '#f5eeee', '#fcf8f7', '#eddfdf', '#3b2d30',
        //     '#8b7376', '#c85e75', '#57958a', '#ddcaca'
        //   ],
        //   d: [
        //     '#292123', '#33282b', '#403235', '#eee2e1',
        //     '#bba5a5', '#d77d91', '#83b8aa', '#504044'
        //   ]
        // },

        // mono: {
        //   n: 'Mono',
        //   l: [
        //     '#f0f0ee', '#fafaf9', '#e5e5e2', '#30302e',
        //     '#777774', '#555552', '#85857d', '#d0d0cb'
        //   ],
        //   d: [
        //     '#222220', '#2c2c2a', '#383835', '#e5e5e0',
        //     '#a8a8a1', '#aaaaa3', '#c1c1b8', '#484843'
        //   ]
        // }
      };

      const PVARS = [
        "--bg",
        "--surface",
        "--surface-2",
        "--ink",
        "--ink-soft",
        "--accent",
        "--accent-2",
        "--border",
      ];
      let palette = "ocean";
      try {
        palette = localStorage.getItem("spotifyPalette") || "ocean";
      } catch (e) { }
      if (!PAL[palette]) palette = "ocean";
      function applyPalette() {
        const p = PAL[palette],
          dark = root.getAttribute("data-theme") === "dark",
          arr = p.l && (dark ? p.d : p.l);
        PVARS.forEach((v, i) =>
          arr
            ? root.style.setProperty(v, arr[i])
            : root.style.removeProperty(v),
        );
        if (arr)
          root.style.setProperty(
            "--shadow",
            "8px 8px 0 rgba(" + (dark ? "0,0,0,.32" : "22,22,22,.10") + ")",
          );
        else root.style.removeProperty("--shadow");
        document
          .querySelectorAll(".swatch")
          .forEach((b) =>
            b.classList.toggle("active", b.dataset.p === palette),
          );
      }
      Object.keys(PAL).forEach((k) => {
        const b = document.createElement("button");
        b.className = "swatch";
        b.dataset.p = k;
        b.title = PAL[k].n;
        b.setAttribute("aria-label", PAL[k].n + " theme");
        b.style.background = PAL[k].c || PAL[k].l[5];
        b.addEventListener("click", () => {
          palette = k;
          try {
            localStorage.setItem("spotifyPalette", k);
          } catch (e) { }
          applyPalette();
        });
        document.getElementById("palettePicker").appendChild(b);
      });
      themeToggle.addEventListener("click", applyPalette);
      applyPalette();

      function escapeHtml(s) {
        const div = document.createElement("div");

        div.textContent = s;

        return div.innerHTML;
      }

      const artistSearch = document.getElementById("artistSearch");

      const searchResult = document.getElementById("searchResult");

      artistSearch.addEventListener("input", () => {
        const q = artistSearch.value.trim().toLowerCase();

        if (!q) {
          searchResult.style.display = "none";
          return;
        }

        const match =
          Object.keys(artistMs).find((a) => a.toLowerCase() === q) ||
          Object.keys(artistMs).find((a) => a.toLowerCase().includes(q));

        if (match) {
          searchResult.style.display = "block";

          searchResult.textContent = `${match}: ${formatDuration(artistMs[match])}, ${artistPlays[match].toLocaleString()} plays`;
        } else {
          searchResult.style.display = "block";

          searchResult.textContent = "No matching artist in this data.";
        }
      });

      // ---------- LIVE MODE: Spotify API via PKCE ----------

      const SPOTIFY_CLIENT_ID = "f6a0b259b3c747299c585e16f0291583";

      const connectBtn = document.getElementById("connectBtn");

      const liveError = document.getElementById("liveError");

      const disconnectBtn = document.getElementById("disconnectBtn");

      const redirectUri = location.origin + location.pathname;

      let accessToken = null;

      let currentType = "artists";

      let currentRange = "short_term";

      const rangeLabels = {
        short_term: "4 Weeks",
        medium_term: "6 Months",
        long_term: "All Time",
      };

      function showLiveError(msg) {
        liveError.textContent = msg;
        liveError.style.display = "block";
      }

      function b64urlFromBytes(bytes) {
        let str = btoa(String.fromCharCode(...new Uint8Array(bytes)));

        return str
          .replace(/\+/g, "-")
          .replace(/\//g, "\_")
          .replace(/=+$/, "");
      }

      function randomVerifier(len) {
        const chars =
          "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-.\_\~";

        const arr = new Uint8Array(len);

        crypto.getRandomValues(arr);

        let out = "";

        for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];

        return out;
      }

      async function sha256(plain) {
        return await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(plain),
        );
      }

      function encodeState(obj) {
        return btoa(JSON.stringify(obj))
          .replace(/\+/g, "-")
          .replace(/\//g, "\_")
          .replace(/=+$/, "");
      }

      function decodeState(str) {
        let s = str.replace(/-/g, "+").replace(/\_/g, "/");

        while (s.length % 4) s += "=";

        return JSON.parse(atob(s));
      }

      connectBtn.addEventListener("click", async () => {
        liveError.style.display = "none";

        const verifier = randomVerifier(64);

        const challenge = b64urlFromBytes(await sha256(verifier));

        const state = encodeState({ v: verifier, c: SPOTIFY_CLIENT_ID });

        const params = new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          response_type: "code",
          redirect_uri: redirectUri,

          scope: "user-top-read",
          code_challenge_method: "S256",
          code_challenge: challenge,
          state: state,
        });

        location.href =
          "https://accounts.spotify.com/authorize?" + params.toString();
      });

      disconnectBtn.addEventListener("click", () => {
        location.href = redirectUri;
      });

      async function exchangeToken(code, state) {
        let decoded;

        try {
          decoded = decodeState(state);
        } catch (e) {
          showLiveError("Could not read auth state. Try again.");
          return;
        }

        const body = new URLSearchParams({
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,

          client_id: decoded.c,
          code_verifier: decoded.v,
        });

        try {
          const res = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
          });

          const data = await res.json();

          if (!res.ok) {
            showLiveError(
              "Auth failed: " +
              (data.error_description || data.error || "unknown"),
            );
            return;
          }

          accessToken = data.access_token;

          history.replaceState(null, "", redirectUri);

          document.querySelector('.mode-btn[data-mode="live"]').click();

          document
            .getElementById("panel-live")
            .querySelectorAll("button.primary, .note")
            .forEach((el) => (el.style.display = "none"));

          document.getElementById("statCard").style.display = "block";

          document.getElementById("controls").style.display = "block";

          disconnectBtn.style.display = "inline";

          stampEl.style.display = "block";

          document.getElementById("footNote").textContent =
            "Live data shows Spotify's ranked order only — popularity and genre fields were removed from this API tier in Feb 2026.";

          fetchTop();
        } catch (e) {
          showLiveError(
            "Request failed: " +
            e.message +
            " — check the browser console for details.",
          );
        }
      }

      function pct(n) {
        if (typeof n !== "number") return 0;
        return Math.max(2, Math.min(100, n));
      }

      async function fetchTop() {
        if (!accessToken) return;

        const liveList = document.getElementById("liveList");

        liveList.innerHTML = '<div class="placeholder">Printing…</div>';

        stampEl.textContent = "Range: " + rangeLabels[currentRange];

        try {
          const res = await fetch(
            `https://api.spotify.com/v1/me/top/${currentType}?time_range=${currentRange}&limit=20`,
            {
              headers: { Authorization: "Bearer " + accessToken },
            },
          );

          if (!res.ok) {
            if (res.status === 401) {
              showLiveError("Session expired. Reconnect.");
              location.href = redirectUri;
              return;
            }

            liveList.innerHTML =
              '<div class="placeholder">Could not load (' +
              res.status +
              ").</div>";

            return;
          }

          const data = await res.json();

          renderLiveList(data.items || []);
        } catch (e) {
          liveList.innerHTML =
            '<div class="placeholder">Request failed: ' +
            escapeHtml(e.message) +
            " — check the console.</div>";
        }
      }

      function renderLiveList(items) {
        const liveList = document.getElementById("liveList");

        if (!items.length) {
          liveList.innerHTML =
            '<div class="placeholder">Nothing here for this range.</div>';
          return;
        }

        liveList.innerHTML = "";

        items.forEach((item, i) => {
          const isTrack = currentType === "tracks";

          const img = isTrack
            ? item.album &&
            item.album.images &&
            item.album.images.slice(-1)[0]
            : item.images && item.images.slice(-1)[0];

          const sub = isTrack
            ? (item.artists || []).map((a) => a.name).join(", ")
            : "ranked by your listening";

          const row = document.createElement("div");

          row.className = "item";

          row.innerHTML = `

        <span class="rank">${String(i + 1).padStart(2, "0")}</span>

        ${img ? `<img class="art" src="${img.url}" alt="" />` : `<div class="art"></div>`}

        <div class="meta"><div class="name">${escapeHtml(item.name)}</div><div class="sub">${escapeHtml(sub)}</div></div>`;

          liveList.appendChild(row);
        });
      }

      document.querySelectorAll(".type-tab").forEach((btn) =>
        btn.addEventListener("click", () => {
          document
            .querySelectorAll(".type-tab")
            .forEach((b) => b.classList.remove("active"));

          btn.classList.add("active");
          currentType = btn.dataset.type;
          fetchTop();
        }),
      );

      document.querySelectorAll(".range-tab").forEach((btn) =>
        btn.addEventListener("click", () => {
          document
            .querySelectorAll(".range-tab")
            .forEach((b) => b.classList.remove("active"));

          btn.classList.add("active");
          currentRange = btn.dataset.range;
          fetchTop();
        }),
      );

      const urlParams = new URLSearchParams(location.search);

      if (urlParams.has("code") && urlParams.has("state")) {
        exchangeToken(urlParams.get("code"), urlParams.get("state"));
      } else if (urlParams.has("error")) {
        showLiveError("Spotify denied access: " + urlParams.get("error"));

        history.replaceState(null, "", redirectUri);
      }
    })();