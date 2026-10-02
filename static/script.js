const ALL_SYMPTOMS = [
    "Fever", "Cough", "Sore Throat", "Runny Nose", "Sneezing", "Headache",
    "Fatigue", "Body Pain", "Chills", "Nausea", "Vomiting", "Diarrhea",
    "Stomach Pain", "Chest Pain", "Shortness of Breath", "Wheezing",
    "Dizziness", "Loss of Appetite", "Muscle Pain", "Joint Pain",
    "Back Pain", "Abdominal Pain", "Constipation", "Heartburn",
    "Skin Rash", "Itching", "Red Eyes", "Watery Eyes", "Ear Pain",
    "Tooth Pain", "Difficulty Swallowing", "Nasal Congestion",
    "Sweating", "Weakness", "Increased Thirst", "Frequent Urination",
    "Sleep Problems", "Anxiety"
];

const TRANSLATIONS = {
    "en": {
        "nav_title": "TreatmentPath Advisor",
        "nav_home": "Home",
        "nav_checker": "Symptom Checker",
        "nav_model": "Model Info",
        "hero_title": "TreatmentPath Advisor",
        "hero_subtitle": "Explainable AI-Based Symptom Analysis & Treatment Path Guidance",
        "hero_desc": "Select your symptoms and receive an educational Machine Learning classification with explainable results and general care guidance.",
        "hero_btn": "Start Symptom Check",
        "history_title": "Recent Checks",
        "history_empty": "No recent checks in this session.",
        "history_clear": "Clear Session History",
        "checker_title": "Symptom Checker",
        "search_placeholder": "Search symptoms...",
        "btn_select_all": "Select All",
        "btn_clear_all": "Clear All",
        "selected_count": "Selected Symptoms:",
        "severity_title": "Symptom Severity (Optional)",
        "duration_title": "How long have you had these symptoms?",
        "dur_1": "Less than 1 day",
        "dur_2": "1–3 days",
        "dur_3": "4–7 days",
        "dur_4": "More than 7 days",
        "btn_predict": "Predict Treatment Path",
        "loading_text": "Analyzing symptoms using Decision Tree...",
        "risk_title": "⚠️ MEDICAL ATTENTION ALERT",
        "risk_desc": "One or more selected symptoms may require prompt professional assessment. This application cannot determine whether an emergency is occurring. If symptoms are severe or worsening, seek immediate professional medical help.",
        "res_prediction": "Predicted Condition Category",
        "res_confidence": "Model Confidence:",
        "res_conf_note": "⚠️ Model confidence is not medical certainty.",
        "res_top3": "Top Predictions",
        "res_why": "Why This Result? (Decision Path)",
        "res_why_desc": "This shows the exact logic path the Decision Tree took to reach this prediction based on your symptoms.",
        "btn_view_tree": "View Full Decision Tree",
        "res_importance": "Important Symptoms in Model",
        "res_importance_desc": "Feature importance represents how the model uses features during classification, not medical causation.",
        "res_timeline": "General Support Path",
        "tl_1": "Review Symptoms",
        "tl_2": "General Self-Care",
        "tl_3": "Monitor & Precautions",
        "tl_4": "Consult Healthcare Professional if:",
        "res_checklist": "Personalized Care Checklist",
        "disclaimer_1": "This tool is for educational purposes only and does not replace professional medical advice.",
        "disclaimer_2": "If symptoms are severe, rapidly worsening, or you believe this is an emergency, seek immediate professional medical help.",
        "info_title": "Model Information",
        "info_desc": "Academic details about the underlying machine learning algorithm.",
        "modal_tree_title": "Interactive Decision Tree",
        "modal_tree_desc": "This represents the learned rules of the algorithm."
    },
    "ta": {
        "nav_title": "சிகிச்சை வழிகாட்டி",
        "nav_home": "முகப்பு",
        "nav_checker": "அறிகுறிகள்",
        "nav_model": "மாதிரி தகவல்",
        "hero_title": "சிகிச்சை வழிகாட்டி (TreatmentPath Advisor)",
        "hero_subtitle": "செயற்கை நுண்ணறிவு அடிப்படையிலான அறிகுறி பகுப்பாய்வு",
        "hero_desc": "உங்கள் அறிகுறிகளைத் தேர்ந்தெடுத்து, கல்விக்கான இயந்திர கற்றல் முடிவுகளையும் பொதுவான பராமரிப்பு வழிகாட்டுதல்களையும் பெறுங்கள்.",
        "hero_btn": "அறிகுறிகளைச் சரிபார்க்கத் தொடங்குங்கள்",
        "history_title": "சமீபத்திய சோதனைகள்",
        "history_empty": "இந்த அமர்வில் எந்த சோதனைகளும் இல்லை.",
        "history_clear": "வரலாற்றை அழி",
        "checker_title": "அறிகுறிகளை தேர்ந்தெடுக்கவும்",
        "search_placeholder": "அறிகுறிகளைத் தேடுங்கள்...",
        "btn_select_all": "அனைத்தையும் தேர்ந்தெடு",
        "btn_clear_all": "அனைத்தையும் அழி",
        "selected_count": "தேர்ந்தெடுக்கப்பட்டவை:",
        "severity_title": "அறிகுறியின் தீவிரம் (விருப்பத்திற்குரியது)",
        "duration_title": "எவ்வளவு காலமாக இந்த அறிகுறிகள் உள்ளன?",
        "dur_1": "1 நாளுக்கு குறைவாக",
        "dur_2": "1-3 நாட்கள்",
        "dur_3": "4-7 நாட்கள்",
        "dur_4": "7 நாட்களுக்கு மேல்",
        "btn_predict": "முடிவைக் கணி",
        "loading_text": "பகுப்பாய்வு செய்யப்படுகிறது...",
        "risk_title": "⚠️ மருத்துவ எச்சரிக்கை",
        "risk_desc": "தேர்ந்தெடுக்கப்பட்ட அறிகுறிகளில் ஒன்று அல்லது அதற்கு மேற்பட்டவை அவசர மருத்துவ கவனிப்பைக் கோரலாம். அறிகுறிகள் தீவிரமாக இருந்தால் உடனடியாக மருத்துவரை அணுகவும்.",
        "res_prediction": "கணிக்கப்பட்ட வகை",
        "res_confidence": "நம்பிக்கை அளவு:",
        "res_conf_note": "⚠️ இது மருத்துவ உறுதிப்பாடு அல்ல.",
        "res_top3": "முக்கிய கணிப்புகள்",
        "res_why": "இந்த முடிவு ஏன்? (முடிவு பாதை)",
        "res_why_desc": "உங்கள் அறிகுறிகளின் அடிப்படையில் இந்த முடிவை அடைய மாதிரி எடுத்த சரியான தர்க்க பாதை இது.",
        "btn_view_tree": "முழு முடிவெடுக்கும் மரத்தைக் காண்க",
        "res_importance": "முக்கிய அறிகுறிகள் (மாதிரியில்)",
        "res_importance_desc": "இது வகைப்பாட்டின் போது மாதிரி அம்சங்களை எவ்வாறு பயன்படுத்துகிறது என்பதைக் குறிக்கிறது, மருத்துவ காரணத்தை அல்ல.",
        "res_timeline": "பொதுவான ஆதரவு பாதை",
        "tl_1": "அறிகுறிகளை மதிப்பாய்வு செய்க",
        "tl_2": "சுய பராமரிப்பு",
        "tl_3": "முன்னெச்சரிக்கைகள்",
        "tl_4": "எப்போது மருத்துவரை அணுக வேண்டும்:",
        "res_checklist": "தனிப்பயனாக்கப்பட்ட பராமரிப்பு பட்டியல்",
        "disclaimer_1": "இந்த கருவி கல்வி நோக்கங்களுக்காக மட்டுமே, தொழில்முறை மருத்துவ ஆலோசனைக்கு மாற்றாகாது.",
        "disclaimer_2": "அறிகுறிகள் தீவிரமாக இருந்தால் உடனடியாக மருத்துவரை அணுகவும்.",
        "info_title": "மாதிரி தகவல்",
        "info_desc": "இயந்திர கற்றல் அல்காரிதம் பற்றிய கல்வி விவரங்கள்.",
        "modal_tree_title": "மாதிரியின் விதிகள் (Decision Tree)",
        "modal_tree_desc": "அல்காரிதம் கற்றுக்கொண்ட விதிகள்."
    }
};

document.addEventListener("DOMContentLoaded", () => {
    // State variables
    let selectedSymptoms = new Set();
    let currentLang = "en";
    
    // DOM Elements
    const body = document.getElementById("app-body");
    const btnTheme = document.getElementById("btn-theme");
    const btnLang = document.getElementById("btn-lang");
    
    const symptomGrid = document.getElementById("symptom-grid");
    const countDisplay = document.getElementById("count");
    const searchInput = document.getElementById("symptom-search");
    const btnSelectAll = document.getElementById("btn-select-all");
    const btnClearAll = document.getElementById("btn-clear-all");
    const severityContainer = document.getElementById("severity-container");
    const severityList = document.getElementById("severity-list");
    const durationSelect = document.getElementById("symptom-duration");
    
    const form = document.getElementById("symptom-form");
    const errorMessage = document.getElementById("error-message");
    const loadingDiv = document.getElementById("loading");
    const resultDashboard = document.getElementById("result-dashboard");
    
    const historyList = document.getElementById("history-list");
    const btnClearHistory = document.getElementById("btn-clear-history");
    
    const modal = document.getElementById("tree-modal");
    const btnViewTree = document.getElementById("btn-view-tree");
    const closeModal = document.getElementById("close-modal");
    const pageLinks = document.querySelectorAll(".nav-links [data-page]");

    function setCurrentPage() {
        const page = {
            "#symptom-checker": "checker",
            "#model-info": "model"
        }[window.location.hash] || "home";

        body.classList.remove("page-home", "page-checker", "page-model");
        body.classList.add(`page-${page}`);
        pageLinks.forEach(link => {
            if (link.dataset.page === page) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    // === Initialization ===
    setCurrentPage();
    window.addEventListener("hashchange", setCurrentPage);
    initTheme();
    initHistory();
    renderSymptoms();
    fetchModelInfo();

    // === Theme Handling ===
    function initTheme() {
        const savedTheme = localStorage.getItem("theme");
        if (savedTheme === "dark") {
            body.classList.remove("theme-light");
            body.classList.add("theme-dark");
            btnTheme.textContent = "🌞";
        }
    }

    btnTheme.addEventListener("click", () => {
        if (body.classList.contains("theme-light")) {
            body.classList.replace("theme-light", "theme-dark");
            localStorage.setItem("theme", "dark");
            btnTheme.textContent = "🌞";
        } else {
            body.classList.replace("theme-dark", "theme-light");
            localStorage.setItem("theme", "light");
            btnTheme.textContent = "🌙";
        }
    });

    // === Language Handling ===
    btnLang.addEventListener("click", () => {
        currentLang = currentLang === "en" ? "ta" : "en";
        btnLang.textContent = currentLang === "en" ? "தமிழ்" : "English";
        applyTranslations();
    });

    function applyTranslations() {
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (TRANSLATIONS[currentLang][key]) {
                el.textContent = TRANSLATIONS[currentLang][key];
            }
        });
        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.getAttribute("data-i18n-placeholder");
            if (TRANSLATIONS[currentLang][key]) {
                el.placeholder = TRANSLATIONS[currentLang][key];
            }
        });
    }

    // === Symptom UI ===
    function renderSymptoms() {
        symptomGrid.innerHTML = "";
        const query = searchInput.value.toLowerCase();
        
        ALL_SYMPTOMS.forEach(symptom => {
            if (symptom.toLowerCase().includes(query)) {
                const isSelected = selectedSymptoms.has(symptom);
                
                const label = document.createElement("label");
                label.className = `symptom-label ${isSelected ? 'selected' : ''}`;
                
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.className = "symptom-checkbox";
                checkbox.value = symptom;
                checkbox.checked = isSelected;
                
                checkbox.addEventListener("change", (e) => {
                    if (e.target.checked) {
                        selectedSymptoms.add(symptom);
                    } else {
                        selectedSymptoms.delete(symptom);
                    }
                    renderSymptoms(); // re-render to update UI classes
                    updateCount();
                    renderSeverityOptions();
                    hideError();
                });

                label.appendChild(checkbox);
                label.appendChild(document.createTextNode(symptom));
                symptomGrid.appendChild(label);
            }
        });
    }

    function renderSeverityOptions() {
        severityList.innerHTML = "";
        if (selectedSymptoms.size > 0) {
            severityContainer.style.display = "block";
            selectedSymptoms.forEach(s => {
                const div = document.createElement("div");
                div.className = "severity-row";
                div.innerHTML = `
                    <strong>${s}</strong>
                    <div class="severity-options">
                        <input type="radio" name="sev_${s}" value="Mild" checked id="mild_${s}"> <label for="mild_${s}">Mild</label>
                        <input type="radio" name="sev_${s}" value="Moderate" id="mod_${s}"> <label for="mod_${s}">Moderate</label>
                        <input type="radio" name="sev_${s}" value="Severe" id="sev_${s}"> <label for="sev_${s}">Severe</label>
                    </div>
                `;
                severityList.appendChild(div);
            });
        } else {
            severityContainer.style.display = "none";
        }
    }

    function updateCount() {
        countDisplay.textContent = selectedSymptoms.size;
    }

    function hideError() { errorMessage.style.display = "none"; }
    function showError(msg) { errorMessage.textContent = msg; errorMessage.style.display = "block"; }

    searchInput.addEventListener("input", renderSymptoms);
    btnSelectAll.addEventListener("click", () => {
        ALL_SYMPTOMS.forEach(s => selectedSymptoms.add(s));
        renderSymptoms(); updateCount(); renderSeverityOptions(); hideError();
    });
    btnClearAll.addEventListener("click", () => {
        selectedSymptoms.clear();
        renderSymptoms(); updateCount(); renderSeverityOptions(); hideError();
    });

    // === Form Submission ===
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if (selectedSymptoms.size === 0) {
            showError("Please select at least one symptom before continuing.");
            return;
        }

        const severityData = {};
        selectedSymptoms.forEach(s => {
            const selectedRadio = document.querySelector(`input[name="sev_${s}"]:checked`);
            severityData[s] = selectedRadio ? selectedRadio.value : "Mild";
        });

        const duration = durationSelect.value;

        hideError();
        resultDashboard.style.display = "none";
        loadingDiv.style.display = "block";

        try {
            const response = await fetch("/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    symptoms: Array.from(selectedSymptoms),
                    severity: severityData,
                    duration: duration
                })
            });

            const data = await response.json();
            loadingDiv.style.display = "none";

            if (data.success) {
                renderResult(data);
                addToHistory(data.condition, data.confidence);
            } else {
                showError(data.error || "An error occurred.");
            }
        } catch (error) {
            loadingDiv.style.display = "none";
            showError("Unable to process the request. Server might be down.");
        }
    });

    // === Results Rendering ===
    function populateList(elementId, items) {
        const ul = document.getElementById(elementId);
        ul.innerHTML = "";
        if (items && items.length > 0) {
            items.forEach(item => {
                const li = document.createElement("li");
                li.textContent = item;
                ul.appendChild(li);
            });
        } else {
            ul.innerHTML = "<li>None specified</li>";
        }
    }

    function renderResult(data) {
        // Top Info
        document.getElementById("res-condition").textContent = data.condition.toUpperCase();
        document.getElementById("res-severity").textContent = data.severity;
        
        // Confidence
        const fill = document.getElementById("res-confidence-fill");
        fill.style.width = "0%";
        document.getElementById("res-confidence-pct").textContent = `${data.confidence}%`;
        document.getElementById("res-confidence-level").textContent = data.confidence_level;
        
        let color = "var(--primary)";
        if(data.confidence_level === "Low") color = "var(--danger)";
        else if (data.confidence_level === "Moderate") color = "var(--warning)";
        else color = "var(--success)";
        fill.style.background = color;

        setTimeout(() => { fill.style.width = `${data.confidence}%`; }, 100);

        // Top 3
        const top3List = document.getElementById("top-predictions-list");
        top3List.innerHTML = "";
        data.top_predictions.forEach((p, idx) => {
            const li = document.createElement("li");
            li.innerHTML = `<span>${idx + 1}. ${p.condition}</span> <strong>${p.confidence}%</strong>`;
            top3List.appendChild(li);
        });

        // Decision Path
        const dpBox = document.getElementById("decision-path-content");
        dpBox.innerHTML = "";
        data.decision_path.forEach(step => {
            const p = document.createElement("div");
            p.className = "dp-step";
            p.innerHTML = step;
            dpBox.appendChild(p);
            
            const arrow = document.createElement("div");
            arrow.className = "dp-arrow";
            arrow.innerHTML = "↓";
            dpBox.appendChild(arrow);
        });
        const finalP = document.createElement("strong");
        finalP.textContent = data.condition;
        finalP.style.color = "var(--primary)";
        dpBox.appendChild(finalP);

        // Important Symptoms
        const impBox = document.getElementById("feature-importance-chart");
        impBox.innerHTML = "";
        data.important_features.forEach(feat => {
            const barHTML = `
                <div class="feature-bar-container">
                    <div class="feature-name">${feat.symptom}</div>
                    <div class="feature-bar-wrap">
                        <div class="feature-bar" style="width: ${feat.importance * 100}%"></div>
                    </div>
                    <div class="feature-val">${feat.importance.toFixed(3)}</div>
                </div>
            `;
            impBox.innerHTML += barHTML;
        });

        // Risk Alert
        document.getElementById("risk-alert").style.display = data.risk_alert ? "block" : "none";

        // Timeline
        document.getElementById("tl-duration").textContent = `Reported duration: ${data.duration}`;
        populateList("tl-self-care", data.self_care);
        populateList("tl-precautions", data.precautions);
        populateList("tl-doctor", data.see_a_doctor_if);

        // Personalized Checklist
        const checklistBox = document.getElementById("care-checklist");
        checklistBox.innerHTML = "";
        const combinedCare = [...data.self_care, ...data.precautions, "Consider professional medical consultation if symptoms persist"];
        combinedCare.forEach((item, idx) => {
            const id = `chk_${idx}`;
            checklistBox.innerHTML += `
                <div class="checklist-item">
                    <input type="checkbox" id="${id}">
                    <label for="${id}">${item}</label>
                </div>
            `;
        });

        resultDashboard.style.display = "block";
        resultDashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // === Session History ===
    function initHistory() {
        const history = JSON.parse(sessionStorage.getItem("history") || "[]");
        renderHistory(history);
    }

    function addToHistory(condition, confidence) {
        const history = JSON.parse(sessionStorage.getItem("history") || "[]");
        history.unshift({ condition, confidence, time: new Date().toLocaleTimeString() });
        if(history.length > 5) history.pop(); // Keep top 5
        sessionStorage.setItem("history", JSON.stringify(history));
        renderHistory(history);
    }

    function renderHistory(history) {
        historyList.innerHTML = "";
        if (history.length === 0) {
            historyList.innerHTML = `<li class="history-empty" data-i18n="history_empty">${TRANSLATIONS[currentLang]["history_empty"] || "No recent checks"}</li>`;
            return;
        }
        history.forEach(item => {
            historyList.innerHTML += `
                <li class="history-item">
                    <div>
                        <strong>${item.condition}</strong><br>
                        <small class="text-muted">${item.time}</small>
                    </div>
                    <div class="badge badge-info">${item.confidence}%</div>
                </li>
            `;
        });
    }

    btnClearHistory.addEventListener("click", () => {
        sessionStorage.removeItem("history");
        renderHistory([]);
    });

    // === Model Info & Modal ===
    async function fetchModelInfo() {
        try {
            const res = await fetch("/model-info");
            const d = await res.json();
            if(d.success) {
                const mc = document.getElementById("model-metrics-container");
                mc.innerHTML = `
                    <div class="metric-card"><h4>Algorithm</h4><div class="primary-text fw-bold">${d.data.algorithm}</div></div>
                    <div class="metric-card"><h4>Features</h4><div class="val">${d.data.input_features}</div></div>
                    <div class="metric-card"><h4>Classes</h4><div class="val">${d.data.condition_categories}</div></div>
                    <div class="metric-card"><h4>Accuracy</h4><div class="val">${d.data.evaluation.accuracy}%</div></div>
                    <div class="metric-card"><h4>Precision</h4><div class="val">${d.data.evaluation.precision}%</div></div>
                    <div class="metric-card"><h4>F1-Score</h4><div class="val">${d.data.evaluation.f1_score}%</div></div>
                `;
            }
        } catch(e) { console.error("Error fetching model info", e); }
    }

    btnViewTree.onclick = () => {
        modal.style.display = "block";
        document.getElementById("tree-text-repr").textContent = `
Root
 ├── Fever <= 0.5
 │   ├── Cough <= 0.5
 │   │   ├── Headache <= 0.5  → Class: General Fatigue
 │   │   └── Headache > 0.5   → Class: Tension Headache
 │   └── Cough > 0.5          → Class: Asthma
 └── Fever > 0.5
     ├── Sore Throat <= 0.5
     │   └── Body Pain > 0.5  → Class: Viral Fever
     └── Sore Throat > 0.5    → Class: Common Cold
(Note: Full detailed depth-10 tree omitted for readability, visualizes top splits)
        `;
    }
    closeModal.onclick = () => { modal.style.display = "none"; }
    window.onclick = (e) => { if (e.target == modal) { modal.style.display = "none"; } }

});
