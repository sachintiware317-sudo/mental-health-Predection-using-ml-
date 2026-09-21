/* ============================================================
   Mindscope — Mental Health Prediction Dashboard
   Vanilla JS: validation, API calls, UI state management
   ============================================================ */

(function () {
  "use strict";

  const API_BASE = "https://mental-health-predection-using-ml-1.onrender.com";
  const PREDICT_URL = API_BASE + "/predict";

  // ---- Element references -------------------------------------------------
  const form = document.getElementById("predictForm");
  const predictBtn = document.getElementById("predictBtn");

  const stateEmpty = document.getElementById("stateEmpty");
  const stateLoading = document.getElementById("stateLoading");
  const stateError = document.getElementById("stateError");
  const stateSuccess = document.getElementById("stateSuccess");
  const loadingText = document.getElementById("loadingText");
  const errorText = document.getElementById("errorText");
  const retryBtn = document.getElementById("retryBtn");

  const scoreRing = document.getElementById("scoreRing");
  const scoreValue = document.getElementById("scoreValue");
  const resultMeta = document.getElementById("resultMeta");

  const statusDot = document.getElementById("apiStatusDot");
  const statusLabel = document.getElementById("apiStatusLabel");

  // ---- Field configuration: name -> validation rules -----------------------
  // Matches the FastAPI `StudentData` Pydantic model exactly.
  const NUMERIC_FIELDS = {
    age: { min: 10, max: 100, type: "int", label: "Age" },
    avg_daily_usage_hours: { min: 0, max: 24, type: "float", label: "Avg. daily usage" },
    daily_unlocks: { min: 0, max: null, type: "int", label: "Daily unlocks" },
    study_hours: { min: 0, max: 24, type: "float", label: "Study hours" },
    physical_activity_hours: { min: 0, max: 24, type: "float", label: "Physical activity hours" },
    sleep_hours_per_night: { min: 0, max: 24, type: "float", label: "Sleep hours" },
  };

  const SELECT_FIELDS = [
    "gender",
    "academic_level",
    "most_used_platform",
    "purpose_of_use",
    "stress_level",
  ];

  const TEXT_FIELDS = ["country"];

  // ---- Backend health check -------------------------------------------------
  function checkBackend() {
    fetch(API_BASE + "/", { method: "GET" })
      .then((res) => {
        if (res.ok) {
          setStatus(true);
        } else {
          setStatus(false);
        }
      })
      .catch(() => setStatus(false));
  }

  function setStatus(online) {
    statusDot.classList.remove("online", "offline");
    statusDot.classList.add(online ? "online" : "offline");
    statusLabel.textContent = online ? "Backend connected" : "Backend unreachable";
  }

  // ---- Validation -------------------------------------------------------
  function clearFieldError(name) {
    const errorEl = document.getElementById(name + "-error");
    const field = document.getElementById(name);
    if (errorEl) errorEl.textContent = "";
    if (field) field.closest(".field")?.classList.remove("has-error");
  }

  function setFieldError(name, message) {
    const errorEl = document.getElementById(name + "-error");
    const field = document.getElementById(name);
    if (errorEl) errorEl.textContent = message;
    if (field) field.closest(".field")?.classList.add("has-error");
  }

  function validateForm() {
    let isValid = true;
    const values = {};

    // Numeric fields
    Object.keys(NUMERIC_FIELDS).forEach((name) => {
      const rule = NUMERIC_FIELDS[name];
      const el = document.getElementById(name);
      const raw = el.value.trim();
      clearFieldError(name);

      if (raw === "") {
        setFieldError(name, rule.label + " is required.");
        isValid = false;
        return;
      }

      const num = Number(raw);
      if (Number.isNaN(num)) {
        setFieldError(name, "Enter a valid number.");
        isValid = false;
        return;
      }
      if (rule.type === "int" && !Number.isInteger(num)) {
        setFieldError(name, "Whole numbers only.");
        isValid = false;
        return;
      }
      if (num < rule.min || (rule.max !== null && num > rule.max)) {
        const range = rule.max !== null ? `${rule.min}–${rule.max}` : `${rule.min}+`;
        setFieldError(name, `Must be between ${range}.`);
        isValid = false;
        return;
      }

      values[name] = num;
    });

    // Select fields
    SELECT_FIELDS.forEach((name) => {
      const el = document.getElementById(name);
      clearFieldError(name);
      if (!el.value) {
        setFieldError(name, "Please select an option.");
        isValid = false;
        return;
      }
      values[name] = el.value;
    });

    // Text fields
    TEXT_FIELDS.forEach((name) => {
      const el = document.getElementById(name);
      clearFieldError(name);
      const raw = el.value.trim();
      if (!raw) {
        setFieldError(name, "Please enter a country.");
        isValid = false;
        return;
      }
      values[name] = raw;
    });

    return { isValid, values };
  }

  // ---- UI state management -----------------------------------------------
  function showState(name) {
    stateEmpty.hidden = name !== "empty";
    stateLoading.hidden = name !== "loading";
    stateError.hidden = name !== "error";
    stateSuccess.hidden = name !== "success";
  }

  function setLoading(isLoading) {
    predictBtn.disabled = isLoading;
    predictBtn.classList.toggle("is-loading", isLoading);
    predictBtn.querySelector(".btn-label").textContent = isLoading
      ? "Analyzing…"
      : "Run prediction";
  }

  function renderSuccess(score, submittedValues) {
    const clamped = Math.max(0, Math.min(10, score));
    const degrees = (clamped / 10) * 360;
    scoreRing.style.setProperty("--score-deg", degrees + "deg");
    scoreValue.textContent = score.toFixed(2);

    resultMeta.innerHTML = "";
    const metaItems = [
      ["Stress level", submittedValues.stress_level],
      ["Sleep / night", submittedValues.sleep_hours_per_night + " hrs"],
      ["Daily usage", submittedValues.avg_daily_usage_hours + " hrs"],
      ["Platform", submittedValues.most_used_platform],
    ];
    metaItems.forEach(([label, value]) => {
      const wrap = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = value;
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      resultMeta.appendChild(wrap);
    });

    showState("success");
  }

  function renderError(message) {
    errorText.textContent = message;
    showState("error");
  }

  // ---- Submit handler -----------------------------------------------------
  async function handleSubmit(event) {
    event.preventDefault();

    const { isValid, values } = validateForm();
    if (!isValid) return;

    const payload = {
      age: values.age,
      gender: values.gender,
      country: values.country,
      academic_level: values.academic_level,
      most_used_platform: values.most_used_platform,
      purpose_of_use: values.purpose_of_use,
      avg_daily_usage_hours: values.avg_daily_usage_hours,
      daily_unlocks: values.daily_unlocks,
      study_hours: values.study_hours,
      physical_activity_hours: values.physical_activity_hours,
      sleep_hours_per_night: values.sleep_hours_per_night,
      stress_level: values.stress_level,
    };

    setLoading(true);
    loadingText.textContent = "Analyzing your data…";
    showState("loading");

    try {
      const response = await fetch(PREDICT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 422) {
          let detailMsg = "The server rejected some of the submitted values.";
          try {
            const errJson = await response.json();
            if (errJson && errJson.detail && errJson.detail.length) {
              const first = errJson.detail[0];
              const fieldName = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "field";
              detailMsg = `Invalid value for "${fieldName}": ${first.msg}`;
            }
          } catch (_) {
            /* fall back to generic message */
          }
          throw new Error(detailMsg);
        }
        throw new Error(`Server responded with status ${response.status}.`);
      }

      const data = await response.json();
      if (typeof data.predicted_mental_health_score !== "number") {
        throw new Error("Unexpected response shape from the prediction API.");
      }

      setStatus(true);
      renderSuccess(data.predicted_mental_health_score, values);
    } catch (err) {
      setStatus(false);
      if (err instanceof TypeError) {
        // fetch() throws a TypeError on network failure / CORS / server down
        renderError("Unable to connect to the prediction server. Please make sure FastAPI is running on http://127.0.0.1:8000.");
      } else {
        renderError(err.message || "Something went wrong while getting your prediction.");
      }
    } finally {
      setLoading(false);
    }
  }

  // ---- Wire up events -------------------------------------------------------
  form.addEventListener("submit", handleSubmit);
  retryBtn.addEventListener("click", () => showState("empty"));

  // Clear a field's error as soon as the user edits it
  [...Object.keys(NUMERIC_FIELDS), ...SELECT_FIELDS, ...TEXT_FIELDS].forEach((name) => {
    const el = document.getElementById(name);
    if (el) el.addEventListener("input", () => clearFieldError(name));
  });

  // ---- Init -----------------------------------------------------------------
  showState("empty");
  checkBackend();
})();
